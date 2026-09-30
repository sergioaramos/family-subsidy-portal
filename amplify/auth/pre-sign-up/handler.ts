import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { crearCore } from '../../shared/adaptadores/fabrica-core';
import { validarRegistro } from '../../shared/dominio/registro';

const core = crearCore();

/**
 * Cognito lo ejecuta ANTES de crear la cuenta (ADR-6). Si lanza un error, la cuenta no se crea
 * y el mensaje le llega al usuario.
 * Solo valida el AUTORREGISTRO: los funcionarios los crea TI con AdminCreateUser y no son afiliados.
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  if (event.triggerSource !== 'PreSignUp_SignUp') return event;

  await validarRegistro(
    {
      documento: event.request.userAttributes['custom:documento'],
      autorizacionDatos: event.request.userAttributes['custom:autorizacionDatos'],
    },
    core,
  );
  return event;
};
