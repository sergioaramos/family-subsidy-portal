import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { clienteLocal } from './helpers/dynamo';
import { crearEscenario } from './helpers/escenario';
import { radicarSolicitud } from '../../amplify/shared/casos-uso/radicar-solicitud';
import { rechazarSolicitud, tomarSolicitud } from '../../amplify/shared/casos-uso/revision';

const MENSAJE = 'Este beneficiario ya tiene una solicitud';

describe('un kit por niño en la convocatoria (FR-20, NFR-7)', () => {
  let esc: Awaited<ReturnType<typeof crearEscenario>>;
  let solicitudDeAnaParaTomas: string;

  beforeAll(async () => {
    esc = await crearEscenario();
  });
  afterAll(async () => esc?.borrar());

  const radicarPor = (quien: 'ana' | 'julian', beneficiarioDocumento: string) =>
    radicarSolicitud(
      {
        sub: `sub-${quien}`,
        documentoAfiliado: quien === 'ana' ? '10010001' : '10050005',
        tipo: 'KIT_ESCOLAR',
        beneficiarioDocumento,
        soportes: [esc.almacen.subir(`sub-${quien}`, `${beneficiarioDocumento}-${crypto.randomUUID()}.pdf`)],
      },
      esc.deps,
    );

  const bloqueo = async (documento: string) =>
    (await clienteLocal.send(new GetCommand({ TableName: esc.deps.tablas.control, Key: { pk: `LOCK#KIT#conv-2027#${documento}` } }))).Item;

  it('@AC-19 si la madre ya radicó el kit de Tomás, el padre no puede', async () => {
    const r = await radicarPor('ana', '30010');
    solicitudDeAnaParaTomas = r.id;
    expect(await bloqueo('30010')).toMatchObject({ solicitudId: r.id });
    await expect(radicarPor('julian', '30010')).rejects.toThrow(MENSAJE);
  });

  it('@AC-20 madre y padre radican el mismo niño en el mismo instante: solo UNA queda (20 veces seguidas)', async () => {
    for (let i = 0; i < 20; i++) {
      const nino = String(40000 + i);
      const resultados = await Promise.allSettled([radicarPor('ana', nino), radicarPor('julian', nino)]);
      const ok = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok, `ronda ${i}`).toHaveLength(1);
      expect(fallidos[0].reason.message, `ronda ${i}`).toBe(MENSAJE);
    }
  });

  it('@AC-26 al rechazar la solicitud se libera el niño y el otro padre puede radicar de nuevo', async () => {
    const revision = { db: clienteLocal, tablaSolicitud: esc.deps.tablas.solicitud, tablaControl: esc.deps.tablas.control, reloj: esc.deps.reloj };
    await tomarSolicitud({ sub: 'analista-A', id: solicitudDeAnaParaTomas }, revision);
    await rechazarSolicitud(
      { sub: 'analista-A', id: solicitudDeAnaParaTomas, motivo: 'Documento ilegible o incompleto', observacion: '' },
      revision,
    );
    expect(await bloqueo('30010')).toBeUndefined();

    const nueva = await radicarPor('julian', '30010');
    expect(nueva.estado).toBe('RADICADA');
    expect(await bloqueo('30010')).toMatchObject({ solicitudId: nueva.id });
  });
});
