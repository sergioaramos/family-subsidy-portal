import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

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
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
