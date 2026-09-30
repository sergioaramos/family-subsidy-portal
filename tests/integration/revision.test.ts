import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { clienteLocal, crearTablaTemporal } from './helpers/dynamo';
import { aprobarSolicitud, rechazarSolicitud, tomarSolicitud } from '../../amplify/shared/casos-uso/revision';
import { MOTIVOS_RECHAZO } from '../../amplify/shared/dominio/motivos';

describe('revisión del analista (F1)', () => {
  let tabla: Awaited<ReturnType<typeof crearTablaTemporal>>;
  const reloj = () => new Date('2027-01-18T15:00:00Z');
  const deps = () => ({ db: clienteLocal, tablaSolicitud: tabla.nombre, reloj });
  const leer = async (id: string) =>
    (await clienteLocal.send(new GetCommand({ TableName: tabla.nombre, Key: { id } }))).Item!;
  const sembrar = (id: string, extra: Record<string, unknown> = {}) =>
    clienteLocal.send(new PutCommand({
      TableName: tabla.nombre,
      Item: { id, tipo: 'KIT_ESCOLAR', estado: 'RADICADA', version: 1, fechaRadicacion: '2027-01-15T19:05:00.000Z', ...extra },
    }));

  beforeAll(async () => {
    tabla = await crearTablaTemporal('solicitud', {
      clave: [{ AttributeName: 'id', KeyType: 'HASH' }],
      atributos: [{ AttributeName: 'id', AttributeType: 'S' }],
    });
  });
  afterAll(async () => tabla?.borrar());
  beforeEach(async () => {
    await sembrar('s1');
  });

  it('@AC-33 tomar: queda EN_REVISION asignada al analista, con versión y fecha actualizadas', async () => {
    const r = await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    expect(r).toEqual({ id: 's1', estado: 'EN_REVISION' });
    expect(await leer('s1')).toMatchObject({
      estado: 'EN_REVISION', analistaAsignado: 'analista-A', version: 2, updatedAt: '2027-01-18T15:00:00.000Z',
    });
  });

  it('@AC-33 tomar una que ya tomó otro: "Ya fue tomada por otro analista"', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    await expect(tomarSolicitud({ sub: 'analista-B', id: 's1' }, deps())).rejects.toThrow('Ya fue tomada por otro analista');
  });

  it('@AC-38 aprobar un kit asignado: queda APROBADA', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    const r = await aprobarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    expect(r).toEqual({ id: 's1', estado: 'APROBADA' });
    expect((await leer('s1')).estado).toBe('APROBADA');
  });

  it('solo decide el analista asignado: otro analista no puede aprobar', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    await expect(aprobarSolicitud({ sub: 'analista-B', id: 's1' }, deps())).rejects.toThrow(
      'La solicitud no está asignada a ti o ya fue decidida',
    );
    expect((await leer('s1')).estado).toBe('EN_REVISION');
  });

  it('no se puede aprobar sin haberla tomado', async () => {
    await expect(aprobarSolicitud({ sub: 'analista-A', id: 's1' }, deps())).rejects.toThrow(
      'La solicitud no está asignada a ti o ya fue decidida',
    );
  });

  it('@AC-40 rechazar sin motivo: se impide', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    await expect(rechazarSolicitud({ sub: 'analista-A', id: 's1', motivo: '', observacion: '' }, deps())).rejects.toThrow(
      'Debes elegir un motivo de la lista',
    );
    await expect(
      rechazarSolicitud({ sub: 'analista-A', id: 's1', motivo: 'Me cae mal', observacion: '' }, deps()),
    ).rejects.toThrow('Debes elegir un motivo de la lista');
  });

  it('el motivo "Otro" exige observación', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    await expect(rechazarSolicitud({ sub: 'analista-A', id: 's1', motivo: 'Otro', observacion: '  ' }, deps())).rejects.toThrow(
      'El motivo "Otro" requiere una observación',
    );
  });

  it('@AC-41 rechazar con motivo y observación: queda RECHAZADA con ambos', async () => {
    await tomarSolicitud({ sub: 'analista-A', id: 's1' }, deps());
    const r = await rechazarSolicitud(
      { sub: 'analista-A', id: 's1', motivo: MOTIVOS_RECHAZO[0], observacion: 'El certificado es de 2025' },
      deps(),
    );
    expect(r).toEqual({ id: 's1', estado: 'RECHAZADA' });
    expect(await leer('s1')).toMatchObject({
      estado: 'RECHAZADA', motivoRechazo: 'Certificado no corresponde al año en curso', observacion: 'El certificado es de 2025',
    });
  });
});
