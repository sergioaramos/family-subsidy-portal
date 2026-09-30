import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { VERSION_AUTORIZACION } from '../../shared/dominio/registro';

const cognito = new CognitoIdentityProviderClient();

/**
 * Cognito lo ejecuta DESPUÉS de que el usuario confirma su correo (ADR-6, FR-2, FR-6, FR-7).
 * - Lo agrega al grupo AFILIADO: el autorregistro nunca da otro rol.
 * - Guarda versión y fecha de la autorización de datos, con la hora del SERVIDOR (no la del navegador).
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const { userPoolId: UserPoolId, userName: Username } = event;
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId, Username, GroupName: 'AFILIADO' }));
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId,
      Username,
      UserAttributes: [{ Name: 'custom:autorizacionDatos', Value: `${VERSION_AUTORIZACION}|${new Date().toISOString()}` }],
    }),
  );
  return event;
};
