import { defineBackend } from '@aws-amplify/backend';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { consultas } from './functions/consultas/resource';
import { comandos } from './functions/comandos/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  consultas,
  comandos,
});

/** `main` es el ambiente de demostración: sus datos se protegen. Sandbox y dev son desechables. */
const esMain = process.env.AWS_BRANCH === 'main';

// ── Tabla Control (ADR-3, ADR-4) ─────────────────────────────────────────────────────────────
// Creada con CDK directo porque NO debe exponerse en la API GraphQL.
// Guarda: bloqueos de unicidad (LOCK#...), consecutivos (SEQ#...), reservas de documento (DOC#...)
// y el marcador de convocatoria activa. `ttl` permite que DynamoDB borre solo lo que vence.
const pilaControl = backend.createStack('control');
const tablaControl = new Table(pilaControl, 'Control', {
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: esMain },
  removalPolicy: esMain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
});

// ── Protección de las tablas de los modelos en main ──────────────────────────────────────────
if (esMain) {
  for (const tabla of Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables)) {
    tabla.pointInTimeRecoveryEnabled = true;
    tabla.applyRemovalPolicy(RemovalPolicy.RETAIN);
  }
}

// ── Permisos de la Lambda consultas ──────────────────────────────────────────────────────────
// AdminGetUser para resolver el documento del afiliado desde Cognito (no desde el cliente).
// Se otorga con CDK (data → auth) y NO con `access` en defineAuth (auth → data), que crearía una
// dependencia circular entre stacks (plan §7, R-5).
const pool = backend.auth.resources.userPool;
backend.consultas.addEnvironment('USER_POOL_ID', pool.userPoolId);
backend.consultas.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [pool.userPoolArn] }),
);

// ── Permisos de la Lambda comandos sobre el bucket de soportes (ADR-10) ─────────────────────
// Desde el lado de la Lambda (data → storage). Con `access` en defineStorage (storage → data)
// se formaría un ciclo: la API depende de comandos y comandos depende del bucket.
const bucket = backend.storage.resources.bucket;
backend.comandos.addEnvironment('BUCKET_SOPORTES', bucket.bucketName);
backend.comandos.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    // PutObject: firmar la POST (la firma hereda los permisos de quien firma).
    // Get/Delete: verificar y mover los soportes al radicar (T29).
    actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
    resources: [bucket.arnForObjects('pendientes/*'), bucket.arnForObjects('solicitudes/*')],
  }),
);
// Sin ListBucket, HeadObject de un objeto inexistente responde 403 (no 404): S3 no revela si existe.
// Se limita al prefijo pendientes/ para que `existe()` distinga "no existe" de "sin permiso".
backend.comandos.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:ListBucket'],
    resources: [bucket.bucketArn],
    conditions: { StringLike: { 's3:prefix': ['pendientes/*'] } },
  }),
);

// ── Permisos de la Lambda comandos sobre las tablas (mínimo privilegio: acción por tabla) ──────
const tablaConvocatoria = backend.data.resources.tables['Convocatoria'];
const tablaSolicitud = backend.data.resources.tables['Solicitud'];
backend.comandos.addEnvironment('USER_POOL_ID', pool.userPoolId);
backend.comandos.addEnvironment('TABLA_CONTROL', tablaControl.tableName);
backend.comandos.addEnvironment('TABLA_CONVOCATORIA', tablaConvocatoria.tableName);
backend.comandos.addEnvironment('TABLA_SOLICITUD', tablaSolicitud.tableName);
backend.comandos.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [pool.userPoolArn] }),
);
backend.comandos.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    // Marcador, contadores y bloqueos. DeleteItem: liberar el bloqueo del niño al rechazar (Q8).
    actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
    resources: [tablaControl.tableArn],
  }),
);
backend.comandos.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:GetItem'], resources: [tablaConvocatoria.tableArn] }), // solo leer
);
backend.comandos.resources.lambda.addToRolePolicy(
  // Crear (radicar) y actualizar con condición (tomar, aprobar, rechazar). Sin DeleteItem: nada se borra.
  new PolicyStatement({ actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'], resources: [tablaSolicitud.tableArn] }),
);

// Nombres de tablas para los scripts de operación (sembrar-demo, cargar-festivos).
// No son secretos: el acceso lo controla IAM, no conocer el nombre.
backend.addOutput({
  custom: {
    tablas: {
      control: tablaControl.tableName,
      convocatoria: backend.data.resources.tables['Convocatoria'].tableName,
      solicitud: backend.data.resources.tables['Solicitud'].tableName,
    },
  },
});

export { tablaControl };
