import { UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { validarMotivoRechazo } from '../dominio/motivos';
import { ErrorNegocio } from './radicar-solicitud';

export interface DepsRevision {
  db: DynamoDBDocumentClient;
  tablaSolicitud: string;
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

/** FR-35, FR-41: rechazo con motivo del catálogo y observación ("Otro" la exige). */
export async function rechazarSolicitud(
  e: { sub: string; id: string; motivo: string; observacion: string },
  d: DepsRevision,
) {
  const error = validarMotivoRechazo(e.motivo, e.observacion);
  if (error) throw new ErrorNegocio(error);
  await actualizarSi(
    d,
    e.id,
    '#estado = :enRevision AND #asignado = :sub',
    { estado: 'RECHAZADA', motivoRechazo: e.motivo, observacion: e.observacion.trim() },
    { ':enRevision': 'EN_REVISION', ':sub': e.sub },
    NO_ASIGNADA,
  );
  return { id: e.id, estado: 'RECHAZADA' as const };
}
