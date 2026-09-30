import { defineFunction } from '@aws-amplify/backend';

/** Lambda de consultas personalizadas (lecturas que no salen de un modelo). Un router por fieldName. */
export const consultas = defineFunction({
  name: 'consultas',
  resourceGroupName: 'data',
  timeoutSeconds: 10,
});
