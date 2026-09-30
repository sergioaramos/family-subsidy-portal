import { defineFunction } from '@aws-amplify/backend';

export const preTokenGeneration = defineFunction({
  name: 'pre-token-generation',
  resourceGroupName: 'auth',
  // El valor por defecto (3 s) puede no alcanzar para AdminGetUser en un arranque en frío.
  timeoutSeconds: 10,
});
