import { defineAuth } from '@aws-amplify/backend';
import { preTokenGeneration } from './pre-token-generation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
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
