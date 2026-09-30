import { AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient();

/**
 * Documento del afiliado según Cognito (fuente de verdad). No se acepta desde el cliente:
 * cualquiera podría pedir datos de otra persona.
 */
export async function obtenerDocumento(userPoolId: string, username: string): Promise<string> {
  const u = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }));
  const documento = u.UserAttributes?.find((a) => a.Name === 'custom:documento')?.Value;
  if (!documento) throw new Error('El usuario no tiene documento registrado');
  return documento;
}
