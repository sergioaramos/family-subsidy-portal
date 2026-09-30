import type { AppSyncIdentityCognito } from 'aws-lambda';

/**
 * Payload con el que Amplify Data invoca una función usada como handler de query/mutation
 * (`a.handler.function`). NO es el evento clásico de AppSync: `fieldName` va en la raíz y no hay `info`.
 * Fuente: @aws-amplify/graphql-function-transformer.
 */
export interface EventoAmplify<TArgs = Record<string, unknown>> {
  typeName: 'Query' | 'Mutation';
  fieldName: string;
  arguments: TArgs;
  identity: AppSyncIdentityCognito;
  source: unknown;
  request: { headers: Record<string, string> };
  prev: unknown;
}
