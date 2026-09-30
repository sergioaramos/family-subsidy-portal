/**
 * TI crea un funcionario (FR-8, AC-7). Uso:
 *   AWS_PROFILE=<perfil> npx tsx scripts/crear-funcionario.ts --correo <correo> --grupo ANALISTA|COORDINADOR
 * Cognito le envía una invitación con contraseña TEMPORAL; en su primer ingreso la cambia y configura TOTP.
 * Nadie más conoce su contraseña definitiva. Usa el user pool del amplify_outputs.json del ambiente activo.
 */
import { readFileSync } from 'node:fs';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { leerArgumentosFuncionario } from './lib/argumentos-funcionario';

const { correo, grupo } = leerArgumentosFuncionario(process.argv.slice(2));
const UserPoolId = JSON.parse(readFileSync('amplify_outputs.json', 'utf8')).auth.user_pool_id as string;
const cognito = new CognitoIdentityProviderClient({});

const creado = await cognito.send(
  new AdminCreateUserCommand({
    UserPoolId,
    Username: correo,
    UserAttributes: [
      { Name: 'email', Value: correo },
      { Name: 'email_verified', Value: 'true' },
    ],
    DesiredDeliveryMediums: ['EMAIL'], // Cognito envía la invitación con la contraseña temporal
  }),
);
await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId, Username: creado.User!.Username!, GroupName: grupo }));
console.log(`Funcionario creado: ${correo} (${grupo}). Invitación enviada por correo.`);
