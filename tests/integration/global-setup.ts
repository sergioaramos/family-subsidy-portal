import { execSync } from 'node:child_process';
import { type DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { ENDPOINT_LOCAL, crearClienteLocal } from './helpers/dynamo';

// Levanta DynamoDB Local si no está corriendo y espera a que responda.
export default async function setup(): Promise<void> {
  const client = crearClienteLocal();

  if (await responde(client)) return;

  execSync('docker compose up -d dynamodb', { stdio: 'inherit' });
  for (let intento = 0; intento < 30; intento++) {
    if (await responde(client)) return;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`DynamoDB Local no respondió en ${ENDPOINT_LOCAL}. ¿Está Docker abierto?`);
}

async function responde(client: DynamoDBClient): Promise<boolean> {
  try {
    await client.send(new ListTablesCommand({}));
    return true;
  } catch {
    return false;
  }
}
