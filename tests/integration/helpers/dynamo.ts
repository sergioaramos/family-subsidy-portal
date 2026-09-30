import { randomUUID } from 'node:crypto';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  type AttributeDefinition,
  type GlobalSecondaryIndex,
  type KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const ENDPOINT_LOCAL = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

export const clienteLocal = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    endpoint: ENDPOINT_LOCAL,
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
  { marshallOptions: { removeUndefinedValues: true } },
);

export interface DefinicionTabla {
  clave: KeySchemaElement[];
  atributos: AttributeDefinition[];
  indices?: GlobalSecondaryIndex[];
}

/**
 * Crea una tabla con nombre único para una prueba y devuelve su nombre y una función para borrarla.
 * Cada prueba trabaja aislada: no comparte datos con las demás.
 */
export async function crearTablaTemporal(
  prefijo: string,
  def: DefinicionTabla,
): Promise<{ nombre: string; borrar: () => Promise<void> }> {
  const nombre = `${prefijo}-${randomUUID().slice(0, 8)}`;
  await clienteLocal.send(
    new CreateTableCommand({
      TableName: nombre,
      KeySchema: def.clave,
      AttributeDefinitions: def.atributos,
      GlobalSecondaryIndexes: def.indices,
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  return {
    nombre,
    borrar: async () => {
      await clienteLocal.send(new DeleteTableCommand({ TableName: nombre }));
    },
  };
}
