import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();
const GRUPOS_FUNCIONARIO = ['ANALISTA', 'COORDINADOR'];

/**
 * ADR-7: un funcionario sin TOTP configurado recibe el token SIN sus grupos de funcionario
 * y con el claim `requiere_mfa`, para que el frontend lo lleve a configurar TOTP.
 * Así la regla se cumple en el servidor: sin grupos no hay permisos de funcionario.
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const grupos = event.request.groupConfiguration.groupsToOverride ?? [];
  if (!grupos.some((g) => GRUPOS_FUNCIONARIO.includes(g))) return event;

  const usuario = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: event.userPoolId, Username: event.userName }),
  );
  if (usuario.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA')) return event;

  event.response = {
    claimsOverrideDetails: {
      groupOverrideDetails: {
        groupsToOverride: grupos.filter((g) => !GRUPOS_FUNCIONARIO.includes(g)),
      },
      claimsToAddOrOverride: { requiere_mfa: 'true' },
    },
  };
  return event;
};
