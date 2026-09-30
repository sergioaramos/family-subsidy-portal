import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { consultas } from '../functions/consultas/resource';
import { comandos } from '../functions/comandos/resource';

/**
 * Modelos de SOLO LECTURA (ADR-2, CQRS liviano): la API expone get/list e índices, pero no
 * create/update/delete. Toda escritura pasa por comandos (Lambdas) que validan reglas de negocio
 * y escriben con el SDK en transacciones condicionales (ADR-3).
 *
 * DynamoDB se diseña por PATRONES DE ACCESO: cada índice secundario existe para una consulta concreta.
 */
const schema = a.schema({
  TipoSubsidio: a.enum(['KIT_ESCOLAR', 'COMPUTADOR']),
  EstadoSolicitud: a.enum(['RADICADA', 'EN_REVISION', 'DEVUELTA', 'PREAPROBADA', 'APROBADA', 'RECHAZADA', 'DESISTIDA']),
  Categoria: a.enum(['A', 'B', 'C']),
  EstadoConvocatoria: a.enum(['PROGRAMADA', 'ABIERTA', 'CERRADA']),

  Solicitud: a
    .model({
      radicado: a.string().required(),
      convocatoriaId: a.id().required(),
      tipo: a.ref('TipoSubsidio').required(),
      estado: a.ref('EstadoSolicitud').required(),
      /** `sub` de Cognito del afiliado: dueño de la solicitud (R-1). */
      owner: a.string().required(),
      afiliadoDocumento: a.string().required(),
      afiliadoNombre: a.string().required(),
      categoria: a.ref('Categoria').required(),
      beneficiarioDocumento: a.string().required(),
      beneficiarioNombre: a.string().required(),
      beneficiarioFechaNacimiento: a.date().required(),
      /** Claves S3 de los soportes (ADR-10). */
      soportes: a.string().array().required(),
      analistaAsignado: a.string(),
      devuelta: a.boolean().required(),
      indicacionCorreccion: a.string(),
      fechaLimiteCorreccion: a.date(),
      /** Meta de 5 días hábiles: días acumulados y desde cuándo corre el conteo actual (FR-51, FR-60). */
      diasMetaAcumulados: a.integer().required(),
      inicioConteoMeta: a.date(),
      motivoRechazo: a.string(),
      observacion: a.string(),
      fechaRadicacion: a.datetime().required(),
      /** Control de concurrencia optimista. */
      version: a.integer().required(),
    })
    .secondaryIndexes((index) => [
      index('estado').sortKeys(['fechaRadicacion']).queryField('solicitudesPorEstado'), // bandeja y preaprobadas
      index('owner').sortKeys(['fechaRadicacion']).queryField('solicitudesPorAfiliado'), // "mis solicitudes"
      index('analistaAsignado').sortKeys(['fechaRadicacion']).queryField('solicitudesPorAnalista'),
      index('estado').sortKeys(['fechaLimiteCorreccion']).queryField('solicitudesPorVencimiento'), // barrido diario
    ])
    .disableOperations(['mutations', 'subscriptions'])
    .authorization((allow) => [
      allow.owner().identityClaim('sub').to(['read']),
      allow.groups(['ANALISTA', 'COORDINADOR']).to(['read']),
    ]),

  Convocatoria: a
    .model({
      nombre: a.string().required(),
      apertura: a.datetime().required(),
      cierre: a.datetime().required(),
      estado: a.ref('EstadoConvocatoria').required(),
      cupoPC: a.integer().required(),
      aprobadosPC: a.integer().required(),
      preaprobadosPC: a.integer().required(),
      /** Totales por estado y tipo, actualizados en cada transacción (FR-52, sin Scan). */
      conteos: a.json().required(),
    })
    .secondaryIndexes((index) => [index('estado').queryField('convocatoriasPorEstado')])
    .disableOperations(['mutations', 'subscriptions'])
    .authorization((allow) => [allow.authenticated().to(['read'])]),

  // ── Consultas personalizadas (datos que no están en un modelo, p. ej. los del core) ──────────
  BeneficiarioElegible: a.customType({
    documento: a.string().required(),
    nombre: a.string().required(),
    fechaNacimiento: a.date().required(),
    edad: a.integer().required(),
    elegibleKit: a.boolean().required(),
    motivoKit: a.string(),
  }),

  /** FR-16: hijos del afiliado autenticado según el core. El documento lo resuelve el servidor. */
  misBeneficiarios: a
    .query()
    .returns(a.ref('BeneficiarioElegible').array())
    .authorization((allow) => [allow.group('AFILIADO')])
    .handler(a.handler.function(consultas)),

  // ── Comandos (escrituras de negocio, ADR-2) ────────────────────────────────────────────────
  CargaSoporte: a.customType({
    url: a.string().required(),
    /** Campos de la POST prefirmada (JSON): se envían tal cual en el formulario multipart. */
    campos: a.json().required(),
    /** Clave S3 donde quedará el archivo; se envía después en radicarSolicitud. */
    clave: a.string().required(),
  }),

  /** FR-25/26 (ADR-10): firma una carga directa a S3 con límites que S3 hace cumplir. */
  solicitarCargaSoporte: a
    .mutation()
    .arguments({
      nombreArchivo: a.string().required(),
      tipoContenido: a.string().required(),
      tamanoBytes: a.integer().required(),
    })
    .returns(a.ref('CargaSoporte'))
    .authorization((allow) => [allow.group('AFILIADO')])
    .handler(a.handler.function(comandos)),

  SolicitudRadicada: a.customType({
    id: a.id().required(),
    radicado: a.string().required(),
    estado: a.ref('EstadoSolicitud').required(),
    fechaRadicacion: a.datetime().required(),
  }),

  /** FR-17 a FR-27: radica una solicitud. El afiliado y su documento salen del token, no de los argumentos. */
  radicarSolicitud: a
    .mutation()
    .arguments({
      tipo: a.ref('TipoSubsidio').required(),
      beneficiarioDocumento: a.string().required(),
      soportes: a.string().array().required(),
    })
    .returns(a.ref('SolicitudRadicada'))
    .authorization((allow) => [allow.group('AFILIADO')])
    .handler(a.handler.function(comandos)),

  // ── Revisión del analista (FR-33 a FR-41) ─────────────────────────────────────────────────
  ResultadoDecision: a.customType({
    id: a.id().required(),
    estado: a.ref('EstadoSolicitud').required(),
  }),

  tomarSolicitud: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('ResultadoDecision'))
    .authorization((allow) => [allow.group('ANALISTA')])
    .handler(a.handler.function(comandos)),

  aprobarSolicitud: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('ResultadoDecision'))
    .authorization((allow) => [allow.group('ANALISTA')])
    .handler(a.handler.function(comandos)),

  rechazarSolicitud: a
    .mutation()
    .arguments({ id: a.id().required(), motivo: a.string().required(), observacion: a.string() })
    .returns(a.ref('ResultadoDecision'))
    .authorization((allow) => [allow.group('ANALISTA')])
    .handler(a.handler.function(comandos)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
