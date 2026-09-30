/**
 * Siembra datos de prueba en un ambiente (T21). Uso:
 *   AWS_PROFILE=<perfil> npx tsx scripts/sembrar-demo.ts
 * Lee los nombres de las tablas de amplify_outputs.json (custom.tablas) del ambiente activo.
 */
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { convocatoriaDemo } from './lib/convocatoria-demo';

const { tablas } = JSON.parse(readFileSync('amplify_outputs.json', 'utf8')).custom as {
  tablas: { control: string; convocatoria: string };
};
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const convocatoria = convocatoriaDemo(new Date());
await db.send(new PutCommand({ TableName: tablas.convocatoria, Item: convocatoria }));
// Marcador de "convocatoria activa" que usará crearConvocatoria para garantizar una sola abierta (FR-64).
await db.send(
  new PutCommand({ TableName: tablas.control, Item: { pk: 'CONVOCATORIA_ACTIVA', convocatoriaId: convocatoria.id } }),
);
console.log(`Convocatoria sembrada: ${convocatoria.id} (${convocatoria.estado}, cierra ${convocatoria.cierre.slice(0, 10)})`);
