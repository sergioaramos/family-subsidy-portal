import { randomUUID } from 'node:crypto';
import { GetCommand, TransactWriteCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CoreAfiliaciones } from '../puertos/core-afiliaciones';
import { fechaEnBogota, verificarAfiliado, verificarKitEscolar } from '../dominio/elegibilidad';
import { formatoRadicado } from '../dominio/radicado';
import { claveBloqueoKit, MENSAJE_BENEFICIARIO_CON_SOLICITUD } from '../dominio/bloqueos';

/** Almacén de soportes (S3 en producción, un fake en las pruebas). */
export interface AlmacenSoportes {
  existe(clave: string): Promise<boolean>;
  mover(origen: string, destino: string): Promise<void>;
}

export interface DepsRadicar {
  core: CoreAfiliaciones;
  db: DynamoDBDocumentClient;
  tablas: { control: string; convocatoria: string; solicitud: string };
  almacen: AlmacenSoportes;
  /** El reloj se inyecta: las pruebas fijan la fecha (ADR-14). */
  reloj: () => Date;
}

export interface EntradaRadicar {
  /** sub de Cognito, del token (nunca del cliente). */
  sub: string;
  /** Documento del afiliado, resuelto desde Cognito por el handler. */
  documentoAfiliado: string;
  tipo: 'KIT_ESCOLAR' | 'COMPUTADOR';
  beneficiarioDocumento: string;
  /** Claves S3 devueltas por solicitarCargaSoporte (pendientes/<sub>/...). */
  soportes: string[];
}

/** Error con mensaje apto para el afiliado (regla de negocio incumplida). */
export class ErrorNegocio extends Error {}

/**
 * Caso de uso "radicar" (F1: kit escolar). Orquesta reglas, core, datos y soportes.
 * F2 agrega: computador, bloqueos de unicidad en transacción y validación fina de soportes.
 */
export async function radicarSolicitud(e: EntradaRadicar, d: DepsRadicar) {
  const ahora = d.reloj();
  const hoy = fechaEnBogota(ahora);

  // 1. Convocatoria abierta (FR-12)
  const marcador = await d.db.send(new GetCommand({ TableName: d.tablas.control, Key: { pk: 'CONVOCATORIA_ACTIVA' } }));
  const convocatoriaId = marcador.Item?.convocatoriaId as string | undefined;
  const conv = convocatoriaId
    ? (await d.db.send(new GetCommand({ TableName: d.tablas.convocatoria, Key: { id: convocatoriaId } }))).Item
    : undefined;
  const t = ahora.getTime();
  if (!conv || conv.estado !== 'ABIERTA' || t < Date.parse(conv.apertura) || t > Date.parse(conv.cierre)) {
    throw new ErrorNegocio('No hay una convocatoria abierta');
  }

  // 2. Alcance de F1
  if (e.tipo !== 'KIT_ESCOLAR') throw new ErrorNegocio('Por ahora solo se puede radicar el kit escolar');

  // 3. Afiliado apto, consultado al core EN ESTE MOMENTO (FR-17, FR-18)
  const afiliado = await d.core.consultarAfiliado(e.documentoAfiliado);
  const apto = verificarAfiliado(afiliado);
  if (!apto.ok) throw new ErrorNegocio(apto.mensaje);

  // 4. Beneficiario registrado a su nombre y con la edad del kit (FR-19)
  const beneficiario = (await d.core.listarBeneficiarios(e.documentoAfiliado)).find(
    (b) => b.documento === e.beneficiarioDocumento,
  );
  if (!beneficiario) throw new ErrorNegocio('El beneficiario no está registrado a tu nombre');
  const kit = verificarKitEscolar(beneficiario, hoy);
  if (!kit.ok) throw new ErrorNegocio(kit.mensaje);

  // 5. Soportes: al menos uno, en SU carpeta y existente (validación fina en T44)
  if (e.soportes.length === 0) throw new ErrorNegocio('El certificado de estudio es obligatorio');
  const prefijo = `pendientes/${e.sub}/`;
  for (const clave of e.soportes) {
    if (!clave.startsWith(prefijo) || !(await d.almacen.existe(clave))) throw new ErrorNegocio('Soporte no válido');
  }

  // 5b. Aviso temprano: si el niño ya tiene solicitud, no se gasta un consecutivo.
  //     (La GARANTÍA la da la transacción del paso 7; esto solo evita huecos en el caso común.)
  const bloqueo = claveBloqueoKit(convocatoriaId!, beneficiario.documento);
  const yaTiene = await d.db.send(new GetCommand({ TableName: d.tablas.control, Key: { pk: bloqueo } }));
  if (yaTiene.Item) throw new ErrorNegocio(MENSAJE_BENEFICIARIO_CON_SOLICITUD);

  // 6. Consecutivo ATÓMICO: DynamoDB suma y devuelve el nuevo valor en una sola operación (FR-27)
  const anio = fechaEnBogota(new Date(conv.apertura)).slice(0, 4);
  const contador = await d.db.send(
    new UpdateCommand({
      TableName: d.tablas.control,
      Key: { pk: `SEQ#${anio}` },
      UpdateExpression: 'ADD valor :uno',
      ExpressionAttributeValues: { ':uno': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  const radicado = formatoRadicado(anio, contador.Attributes!.valor as number);

  // Campos que AppSync exige al leer un ítem escrito con el SDK (R-1)
  const id = randomUUID();
  const destinos = e.soportes.map((c) => `solicitudes/${id}/${c.split('/').pop()}`);
  const iso = ahora.toISOString();
  // 7. TRANSACCIÓN (todo o nada): bloqueo del niño + solicitud (FR-20, NFR-7).
  //    Si dos padres radican al mismo tiempo, solo una transacción cumple "el bloqueo no existe".
  try {
    await d.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: d.tablas.control,
              Item: { pk: bloqueo, solicitudId: id, creado: iso },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: d.tablas.solicitud,
              Item: {
                id,
                __typename: 'Solicitud',
                radicado,
                convocatoriaId,
                tipo: e.tipo,
                estado: 'RADICADA',
                owner: e.sub,
                afiliadoDocumento: afiliado!.documento,
                afiliadoNombre: afiliado!.nombre,
                categoria: afiliado!.categoria,
                beneficiarioDocumento: beneficiario.documento,
                beneficiarioNombre: beneficiario.nombre,
                beneficiarioFechaNacimiento: beneficiario.fechaNacimiento,
                soportes: destinos,
                devuelta: false,
                diasMetaAcumulados: 0,
                inicioConteoMeta: hoy,
                fechaRadicacion: iso,
                createdAt: iso,
                updatedAt: iso,
                version: 1,
              },
              ConditionExpression: 'attribute_not_exists(id)',
            },
          },
        ],
      }),
    );
  } catch (error) {
    if (esBloqueoOcupado(error)) throw new ErrorNegocio(MENSAJE_BENEFICIARIO_CON_SOLICITUD);
    throw error;
  }

  // 8. Mover los soportes a su carpeta definitiva
  for (let i = 0; i < e.soportes.length; i++) await d.almacen.mover(e.soportes[i], destinos[i]);

  return { id, radicado, estado: 'RADICADA' as const, fechaRadicacion: iso };
}

/** La transacción se canceló porque el PRIMER ítem (el bloqueo) no cumplió la condición. */
function esBloqueoOcupado(error: unknown): boolean {
  const e = error as { name?: string; CancellationReasons?: { Code?: string }[] };
  return e.name === 'TransactionCanceledException' && e.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed';
}
