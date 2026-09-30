import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * PRUEBAS TÉCNICAS F0 (se borran en T9).
 * - R-2 (T6): `disableOperations` elimina las mutaciones y suscripciones generadas del modelo.
 * - R-1 (T7): un ítem escrito con el SDK con `owner = sub` es legible por su dueño con
 *   `allow.owner().identityClaim('sub')` y no por otro usuario.
 */
const schema = a.schema({
  SpikeLectura: a
    .model({
      owner: a.string(),
      nota: a.string(),
    })
    .disableOperations(['mutations', 'subscriptions'])
    .authorization((allow) => [allow.owner().identityClaim('sub').to(['read'])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
