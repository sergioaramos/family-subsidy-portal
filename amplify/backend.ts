import { defineBackend } from '@aws-amplify/backend';
import { RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { consultas } from './functions/consultas/resource';

const backend = defineBackend({
  auth,
  data,
  consultas,
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
