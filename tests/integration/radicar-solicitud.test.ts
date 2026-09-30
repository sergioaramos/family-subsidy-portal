import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { clienteLocal, crearTablaTemporal } from './helpers/dynamo';
import { radicarSolicitud, type AlmacenSoportes } from '../../amplify/shared/casos-uso/radicar-solicitud';
import { CoreFake } from '../fakes/core-fake';

/** Almacén de soportes en memoria: simula S3 (existencia y traslado de objetos). */
class AlmacenFake implements AlmacenSoportes {
  readonly objetos = new Set<string>();
  readonly movidos: [string, string][] = [];
  async existe(clave: string) {
    return this.objetos.has(clave);
  }
  async mover(origen: string, destino: string) {
    this.objetos.delete(origen);
    this.objetos.add(destino);
    this.movidos.push([origen, destino]);
  }
}

const core = new CoreFake({
  afiliados: [{ documento: '10010001', nombre: 'Ana Gómez', activo: true, categoria: 'B' }],
  beneficiarios: {
    '10010001': [
      { documento: '30010', nombre: 'Tomás', parentesco: 'HIJO', fechaNacimiento: '2018-03-15' },
      { documento: '30099', nombre: 'Luisa', parentesco: 'HIJO', fechaNacimiento: '2016-05-05' },
    ],
  },
});

describe('@AC-16 radicarSolicitud: radicación exitosa de un kit escolar', () => {
  const tablas: Record<'control' | 'convocatoria' | 'solicitud', Awaited<ReturnType<typeof crearTablaTemporal>>> =
    {} as never;
  const almacen = new AlmacenFake();
  const reloj = () => new Date('2027-01-15T19:05:00Z'); // 2:05 p. m. en Bogotá

  const deps = () => ({
    core,
    db: clienteLocal,
    tablas: { control: tablas.control.nombre, convocatoria: tablas.convocatoria.nombre, solicitud: tablas.solicitud.nombre },
    almacen,
    reloj,
  });

  beforeAll(async () => {
    const porPk = (n: string) => ({ clave: [{ AttributeName: n, KeyType: 'HASH' as const }], atributos: [{ AttributeName: n, AttributeType: 'S' as const }] });
    tablas.control = await crearTablaTemporal('control', porPk('pk'));
    tablas.convocatoria = await crearTablaTemporal('convocatoria', porPk('id'));
    tablas.solicitud = await crearTablaTemporal('solicitud', porPk('id'));
    await clienteLocal.send(new PutCommand({
      TableName: tablas.convocatoria.nombre,
      Item: { id: 'conv-2027', estado: 'ABIERTA', apertura: '2027-01-12T05:00:00.000Z', cierre: '2027-02-23T04:59:59.000Z' },
    }));
    await clienteLocal.send(new PutCommand({ TableName: tablas.control.nombre, Item: { pk: 'CONVOCATORIA_ACTIVA', convocatoriaId: 'conv-2027' } }));
    almacen.objetos.add('pendientes/sub-ana/u1-certificado.pdf');
    almacen.objetos.add('pendientes/sub-ana/u2-certificado.pdf');
  });

  afterAll(async () => {
    await Promise.all(Object.values(tablas).map((t) => t?.borrar()));
  });

  it('queda RADICADA con radicado SUB-2027-000001, fecha y hora, dueño y campos que AppSync exige', async () => {
    const r = await radicarSolicitud(
      { sub: 'sub-ana', documentoAfiliado: '10010001', tipo: 'KIT_ESCOLAR', beneficiarioDocumento: '30010', soportes: ['pendientes/sub-ana/u1-certificado.pdf'] },
      deps(),
    );
    expect(r.radicado).toBe('SUB-2027-000001');
    expect(r.estado).toBe('RADICADA');

    const { Item } = await clienteLocal.send(new GetCommand({ TableName: tablas.solicitud.nombre, Key: { id: r.id } }));
    expect(Item).toMatchObject({
      id: r.id,
      __typename: 'Solicitud',
      radicado: 'SUB-2027-000001',
      convocatoriaId: 'conv-2027',
      tipo: 'KIT_ESCOLAR',
      estado: 'RADICADA',
      owner: 'sub-ana',
      afiliadoDocumento: '10010001',
      afiliadoNombre: 'Ana Gómez',
      categoria: 'B',
      beneficiarioDocumento: '30010',
      beneficiarioNombre: 'Tomás',
      beneficiarioFechaNacimiento: '2018-03-15',
      devuelta: false,
      diasMetaAcumulados: 0,
      inicioConteoMeta: '2027-01-15',
      fechaRadicacion: '2027-01-15T19:05:00.000Z',
      createdAt: '2027-01-15T19:05:00.000Z',
      updatedAt: '2027-01-15T19:05:00.000Z',
      version: 1,
    });
  });

  it('mueve los soportes de pendientes/ a solicitudes/<id>/ y guarda las claves definitivas', async () => {
    const [origen, destino] = almacen.movidos[0];
    expect(origen).toBe('pendientes/sub-ana/u1-certificado.pdf');
    expect(destino).toMatch(/^solicitudes\/[0-9a-f-]{36}\/u1-certificado\.pdf$/);
  });

  it('el consecutivo sigue: la segunda radicación recibe SUB-2027-000002', async () => {
    const r = await radicarSolicitud(
      { sub: 'sub-ana', documentoAfiliado: '10010001', tipo: 'KIT_ESCOLAR', beneficiarioDocumento: '30099', soportes: ['pendientes/sub-ana/u2-certificado.pdf'] },
      deps(),
    );
    expect(r.radicado).toBe('SUB-2027-000002');
  });

  // En F1 no hay bloqueo de "un kit por niño" (llega en T39-T40); por eso aquí se repite el beneficiario.
  it('20 radicaciones simultáneas reciben 20 consecutivos distintos (contador atómico)', async () => {
    const claves = Array.from({ length: 20 }, (_, i) => `pendientes/sub-ana/c${i}-cert.pdf`);
    claves.forEach((c) => almacen.objetos.add(c));
    const resultados = await Promise.all(
      claves.map((c) =>
        radicarSolicitud({ sub: 'sub-ana', documentoAfiliado: '10010001', tipo: 'KIT_ESCOLAR', beneficiarioDocumento: '30010', soportes: [c] }, deps()),
      ),
    );
    const radicados = resultados.map((r) => r.radicado);
    expect(new Set(radicados).size).toBe(20);
  });

  it('rechaza un soporte que no está en la carpeta del afiliado', async () => {
    await expect(
      radicarSolicitud(
        { sub: 'sub-ana', documentoAfiliado: '10010001', tipo: 'KIT_ESCOLAR', beneficiarioDocumento: '30010', soportes: ['pendientes/sub-OTRO/x.pdf'] },
        deps(),
      ),
    ).rejects.toThrow('Soporte no válido');
  });
});
