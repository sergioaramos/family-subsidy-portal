import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { clienteLocal, crearTablaTemporal } from './helpers/dynamo';

describe('humo de integración', () => {
  let tabla: Awaited<ReturnType<typeof crearTablaTemporal>>;

  beforeAll(async () => {
    tabla = await crearTablaTemporal('humo', {
      clave: [{ AttributeName: 'pk', KeyType: 'HASH' }],
      atributos: [{ AttributeName: 'pk', AttributeType: 'S' }],
    });
  });

  afterAll(async () => {
    await tabla?.borrar();
  });

  it('escribe y lee un ítem en DynamoDB Local', async () => {
    await clienteLocal.send(new PutCommand({ TableName: tabla.nombre, Item: { pk: 'x', valor: 42 } }));
    const { Item } = await clienteLocal.send(new GetCommand({ TableName: tabla.nombre, Key: { pk: 'x' } }));
    expect(Item).toEqual({ pk: 'x', valor: 42 });
  });
});
