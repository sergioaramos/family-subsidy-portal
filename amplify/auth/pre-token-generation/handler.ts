import type { PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();
const GRUPOS_FUNCIONARIO = ['ANALISTA', 'COORDINADOR'];

/**
 * ADR-7: un funcionario sin TOTP configurado recibe el token SIN sus grupos ni roles IAM de
 * funcionario y con el claim `requiere_mfa`, para que el frontend lo lleve a configurar TOTP.
 * La regla se cumple en el servidor: sin grupos ni roles no hay permisos de funcionario.
 * Si no se puede consultar el MFA, falla cerrado (trata al usuario como sin TOTP).
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const grupos = event.request.groupConfiguration.groupsToOverride ?? [];
  if (!grupos.some((g) => GRUPOS_FUNCIONARIO.includes(g))) return event;

  if (await tieneTotp(event.userPoolId, event.userName)) return event;

  event.response = {
    claimsOverrideDetails: {
      groupOverrideDetails: {
        groupsToOverride: grupos.filter((g) => !GRUPOS_FUNCIONARIO.includes(g)),
        // Sin esto Cognito conserva cognito:roles y cognito:preferred_role del grupo de funcionario,
        // y el Identity Pool podría entregar su rol IAM.
        iamRolesToOverride: [],
        preferredRole: undefined,
      },
      claimsToAddOrOverride: { requiere_mfa: 'true' },
    },
  };
  return event;
};

async function tieneTotp(userPoolId: string, userName: string): Promise<boolean> {
  try {
    const usuario = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: userName }));
    return usuario.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') ?? false;
  } catch (error) {
    console.error(JSON.stringify({ msg: 'AdminGetUser falló; se niegan permisos de funcionario', userName, error: String(error) }));
    return false;
  }
}
