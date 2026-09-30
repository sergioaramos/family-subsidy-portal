import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';
import { postConfirmation } from './post-confirmation/resource';
import { preTokenGeneration } from './pre-token-generation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Cognito permite AGREGAR atributos custom, pero no modificarlos ni borrarlos (ver plan §7).
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
    preSignUp, // valida contra el core antes de crear la cuenta (ADR-6)
    postConfirmation, // grupo AFILIADO + registro de la autorización (ADR-6)
    preTokenGeneration, // MFA obligatorio para funcionarios (ADR-7)
  },
  // Mínimo privilegio: cada trigger solo con la acción de Cognito que necesita.
  access: (allow) => [
    allow.resource(preTokenGeneration).to(['getUser']),
    allow.resource(postConfirmation).to(['addUserToGroup', 'updateUserAttributes']),
  ],
});
