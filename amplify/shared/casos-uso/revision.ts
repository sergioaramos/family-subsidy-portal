import { GetCommand, TransactWriteCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { claveBloqueoKit } from '../dominio/bloqueos';
import { validarMotivoRechazo } from '../dominio/motivos';
import { ErrorNegocio } from './radicar-solicitud';

export interface DepsRevision {
  db: DynamoDBDocumentClient;
  tablaSolicitud: string;
  /** Tabla Control: al rechazar se libera el bloqueo del niño (FR-20, Q8). */
  tablaControl: string;
  reloj: () => Date;
}

const NO_ASIGNADA = 'La solicitud no está asignada a ti o ya fue decidida';

/** Alias cortos usados en las condiciones. El resto de #nombre corresponde al atributo del mismo nombre. */
const ALIAS: Record<string, string> = { '#asignado': 'analistaAsignado' };

/**
 * Actualización CONDICIONAL: DynamoDB evalúa la condición y escribe en una sola operación.
 * Si la condición falla, nadie escribió: se traduce a un mensaje de negocio.
 */
async function actualizarSi(
  d: DepsRevision,
  id: string,
  condicion: string,
  cambios: Record<string, unknown>,
  valoresCondicion: Record<string, unknown>,
  mensajeSiFalla: string,
) {
  const sets = Object.keys(cambios).map((k) => `#${k} = :${k}`);
  const valores = Object.fromEntries(Object.entries(cambios).map(([k, v]) => [`:${k}`, v]));
  const actualizacion = `SET ${[...sets, '#updatedAt = :ahora', '#version = #version + :uno'].join(', ')}`;
  // DynamoDB rechaza nombres declarados que no se usen: se declaran solo los que aparecen.
  const usados = new Set(`${actualizacion} ${condicion}`.match(/#\w+/g));
  const nombres = Object.fromEntries([...usados].map((n) => [n, ALIAS[n] ?? n.slice(1)]));
  try {
    await d.db.send(
      new UpdateCommand({
        TableName: d.tablaSolicitud,
        Key: { id },
        UpdateExpression: actualizacion,
        ConditionExpression: condicion,
        ExpressionAttributeNames: nombres,
        ExpressionAttributeValues: { ...valores, ...valoresCondicion, ':ahora': d.reloj().toISOString(), ':uno': 1 },
      }),
    );
  } catch (e) {
    if ((e as { name?: string }).name === 'ConditionalCheckFailedException') throw new ErrorNegocio(mensajeSiFalla);
    throw e;
  }
}

/** FR-33, FR-34: toma una RADICADA sin asignar. Si dos la toman a la vez, solo una condición se cumple. */
export async function tomarSolicitud(e: { sub: string; id: string }, d: DepsRevision) {
  await actualizarSi(
    d,
    e.id,
    '#estado = :radicada AND attribute_not_exists(#asignado)',
    { estado: 'EN_REVISION', analistaAsignado: e.sub },
    { ':radicada': 'RADICADA' },
    'Ya fue tomada por otro analista',
  );
  return { id: e.id, estado: 'EN_REVISION' as const };
}

/** FR-35, FR-38: solo el analista asignado aprueba; en F1, solo kits (el computador llega en F4). */
export async function aprobarSolicitud(e: { sub: string; id: string }, d: DepsRevision) {
  await actualizarSi(
    d,
    e.id,
    '#estado = :enRevision AND #asignado = :sub AND #tipo = :kit',
    { estado: 'APROBADA' },
    { ':enRevision': 'EN_REVISION', ':sub': e.sub, ':kit': 'KIT_ESCOLAR' },
    NO_ASIGNADA,
  );
  return { id: e.id, estado: 'APROBADA' as const };
}

/**
 * FR-35, FR-41: rechazo con motivo del catálogo y observación ("Otro" la exige).
 * TRANSACCIÓN: marca RECHAZADA y libera el bloqueo del niño, para que se pueda volver a radicar (Q8, AC-26).
 */
export async function rechazarSolicitud(
  e: { sub: string; id: string; motivo: string; observacion: string },
  d: DepsRevision,
) {
  const error = validarMotivoRechazo(e.motivo, e.observacion);
  if (error) throw new ErrorNegocio(error);

  const { Item: s } = await d.db.send(new GetCommand({ TableName: d.tablaSolicitud, Key: { id: e.id } }));
  if (!s) throw new ErrorNegocio(NO_ASIGNADA);

  try {
    await d.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: d.tablaSolicitud,
              Key: { id: e.id },
              UpdateExpression:
                'SET #estado = :rechazada, motivoRechazo = :motivo, observacion = :obs, updatedAt = :ahora, #version = #version + :uno',
              // La condición se vuelve a evaluar AQUÍ: lo leído arriba solo sirve para armar la llave del bloqueo.
              ConditionExpression: '#estado = :enRevision AND analistaAsignado = :sub',
              ExpressionAttributeNames: { '#estado': 'estado', '#version': 'version' },
              ExpressionAttributeValues: {
                ':rechazada': 'RECHAZADA',
                ':motivo': e.motivo,
                ':obs': e.observacion.trim(),
                ':ahora': d.reloj().toISOString(),
                ':uno': 1,
                ':enRevision': 'EN_REVISION',
                ':sub': e.sub,
              },
            },
          },
          {
            Delete: {
              TableName: d.tablaControl,
              Key: { pk: claveBloqueoKit(s.convocatoriaId, s.beneficiarioDocumento) },
              // Solo se borra si es el bloqueo DE ESTA solicitud (o si no existe: datos anteriores a los bloqueos).
              ConditionExpression: 'attribute_not_exists(pk) OR solicitudId = :id',
              ExpressionAttributeValues: { ':id': e.id },
            },
          },
        ],
      }),
    );
  } catch (err) {
    if ((err as { name?: string }).name === 'TransactionCanceledException') throw new ErrorNegocio(NO_ASIGNADA);
    throw err;
  }
  return { id: e.id, estado: 'RECHAZADA' as const };
}
