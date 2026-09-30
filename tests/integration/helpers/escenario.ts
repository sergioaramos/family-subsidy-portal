import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { clienteLocal, crearTablaTemporal } from './dynamo';
import { CoreFake } from '../../fakes/core-fake';
import type { AlmacenSoportes, DepsRadicar } from '../../../amplify/shared/casos-uso/radicar-solicitud';
import type { Beneficiario } from '../../../amplify/shared/puertos/core-afiliaciones';

/** Almacén de soportes en memoria: simula S3 (existencia y traslado). */
export class AlmacenFake implements AlmacenSoportes {
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
  /** Crea un soporte "subido" por el afiliado y devuelve su clave. */
  subir(sub: string, nombre: string) {
    const clave = `pendientes/${sub}/${nombre}`;
    this.objetos.add(clave);
    return clave;
  }
}

/** 20 hijos de 8 años para pruebas de volumen (documentos 40000..40019). */
export const HIJOS_VOLUMEN: Beneficiario[] = Array.from({ length: 20 }, (_, i) => ({
  documento: String(40000 + i),
  nombre: `Hijo ${i}`,
  parentesco: 'HIJO',
  fechaNacimiento: '2018-03-15',
}));

/**
 * Escenario estándar de integración: tablas temporales en DynamoDB Local, convocatoria 2027 ABIERTA,
 * y un core con Ana (10010001) y Julián (10050005), padres de Tomás (30010) y de 20 hijos más.
 */
export async function crearEscenario() {
  const porPk = (n: string) => ({
    clave: [{ AttributeName: n, KeyType: 'HASH' as const }],
    atributos: [{ AttributeName: n, AttributeType: 'S' as const }],
  });
  const control = await crearTablaTemporal('control', porPk('pk'));
  const convocatoria = await crearTablaTemporal('convocatoria', porPk('id'));
  const solicitud = await crearTablaTemporal('solicitud', porPk('id'));

  await clienteLocal.send(new PutCommand({
    TableName: convocatoria.nombre,
    Item: { id: 'conv-2027', estado: 'ABIERTA', apertura: '2027-01-12T05:00:00.000Z', cierre: '2027-02-23T04:59:59.000Z' },
  }));
  await clienteLocal.send(new PutCommand({ TableName: control.nombre, Item: { pk: 'CONVOCATORIA_ACTIVA', convocatoriaId: 'conv-2027' } }));

  const tomas: Beneficiario = { documento: '30010', nombre: 'Tomás', parentesco: 'HIJO', fechaNacimiento: '2018-03-15' };
  const core = new CoreFake({
    afiliados: [
      { documento: '10010001', nombre: 'Ana Gómez', activo: true, categoria: 'B' },
      { documento: '10050005', nombre: 'Julián Arango', activo: true, categoria: 'B' },
    ],
    beneficiarios: { '10010001': [tomas, ...HIJOS_VOLUMEN], '10050005': [tomas, ...HIJOS_VOLUMEN] },
  });
  const almacen = new AlmacenFake();
  const deps: DepsRadicar = {
    core,
    db: clienteLocal,
    tablas: { control: control.nombre, convocatoria: convocatoria.nombre, solicitud: solicitud.nombre },
    almacen,
    reloj: () => new Date('2027-01-15T19:05:00Z'),
  };
  return {
    deps,
    almacen,
    tablas: { control, convocatoria, solicitud },
    borrar: () => Promise.all([control.borrar(), convocatoria.borrar(), solicitud.borrar()]),
  };
}
