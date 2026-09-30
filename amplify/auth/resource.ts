import { defineAuth } from '@aws-amplify/backend';
import { preTokenGeneration } from './pre-token-generation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Definidos desde el primer despliegue de cada ambiente: cambiar el esquema de un
  // user pool existente falló en CloudFormation (ver plan §7, lección de R-3).
  userAttributes: {
    'custom:documento': { dataType: 'String', mutable: false, minLen: 5, maxLen: 20 },
    'custom:autorizacionDatos': { dataType: 'String', mutable: true, maxLen: 64 },
  },
  groups: ['AFILIADO', 'ANALISTA', 'COORDINADOR'],
  // ADR-7: MFA opcional; se exige a funcionarios mediante preTokenGeneration.
  multifactor: {
    mode: 'OPTIONAL',
    totp: true,
  },
  triggers: {
    preTokenGeneration,
  },
  access: (allow) => [allow.resource(preTokenGeneration).to(['getUser'])],
});
