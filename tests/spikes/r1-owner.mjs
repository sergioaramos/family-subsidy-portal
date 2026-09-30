// Prueba técnica R-1 (T7). Temporal: se borra en T9.
// Escribe con el SDK (como lo hará una Lambda) un ítem con owner = sub de A,
// y verifica que A lo lee por AppSync y B no.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Amplify } from 'aws-amplify';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
Amplify.configure(outputs);
const env = process.env;

async function sesion(email, password) {
  await signOut().catch(() => {});
  await signIn({ username: email, password });
  const { tokens } = await fetchAuthSession();
  return { access: tokens.accessToken.toString(), sub: tokens.accessToken.payload.sub };
}

async function gql(token, query, variables) {
  const r = await fetch(outputs.data.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: token },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

const a = await sesion(env.SPIKE_A_EMAIL, env.SPIKE_A_PASSWORD);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1', credentials: fromIni({ profile: 'confa-labs' }) }));
const { TableNames } = await ddb.send(new ListTablesCommand({}));
const tabla = TableNames.find((t) => t.startsWith('SpikeLectura-'));
const id = randomUUID();
const ahora = new Date().toISOString();
await ddb.send(new PutCommand({
  TableName: tabla,
  Item: { id, owner: a.sub, nota: 'escrita desde el SDK', __typename: 'SpikeLectura', createdAt: ahora, updatedAt: ahora },
}));

const Q = 'query($id: ID!) { getSpikeLectura(id: $id) { id owner nota } }';
const comoA = await gql(a.access, Q, { id });
const listaA = await gql(a.access, '{ listSpikeLecturas { items { id } } }');

const b = await sesion(env.SPIKE_B_EMAIL, env.SPIKE_B_PASSWORD);
const comoB = await gql(b.access, Q, { id });
const listaB = await gql(b.access, '{ listSpikeLecturas { items { id } } }');

console.log(JSON.stringify({
  tabla,
  A_get: comoA.data?.getSpikeLectura ?? comoA.errors?.map((e) => e.errorType ?? e.message),
  A_list: listaA.data?.listSpikeLecturas?.items?.length,
  B_get: comoB.data?.getSpikeLectura ?? comoB.errors?.map((e) => e.errorType ?? e.message),
  B_list: listaB.data?.listSpikeLecturas?.items?.length,
}, null, 2));
await signOut();
