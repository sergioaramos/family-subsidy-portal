import { defineFunction } from '@aws-amplify/backend';

/** Lambda de COMANDOS: toda escritura de negocio pasa por aquí (ADR-2). Un router por fieldName. */
export const comandos = defineFunction({
  name: 'comandos',
  resourceGroupName: 'data',
  timeoutSeconds: 15,
});
