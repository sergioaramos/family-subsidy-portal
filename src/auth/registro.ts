import { VERSION_AUTORIZACION } from '../../amplify/shared/dominio/registro';

/** Nombre del campo de la casilla de autorización en el formulario (no es un atributo del pool). */
export const CAMPO_AUTORIZACION = 'acepta_autorizacion';

const PREFIJO_TRIGGER = /^\w+ failed with error\s+/;

/**
 * Cognito antepone "PreSignUp failed with error ..." a los mensajes que lanzan los triggers.
 * El afiliado solo debe ver el mensaje de negocio.
 */
export function limpiarMensajeCognito(error: unknown): string {
  if (!(error instanceof Error)) return 'No fue posible completar el registro';
  return error.message.replace(PREFIJO_TRIGGER, '').replace(/\.$/, '');
}

/**
 * Atributos que se envían a Cognito en el registro:
 * - agrega la versión vigente de la autorización de datos (la valida preSignUp);
 * - normaliza el documento;
 * - quita la casilla, que Cognito rechazaría por no ser un atributo del pool.
 */
export function atributosDeRegistro(formulario: Record<string, string | undefined>): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const [nombre, valor] of Object.entries(formulario)) {
    if (nombre === CAMPO_AUTORIZACION || valor === undefined) continue;
    atributos[nombre] = nombre === 'custom:documento' ? valor.trim() : valor;
  }
  atributos['custom:autorizacionDatos'] = VERSION_AUTORIZACION;
  return atributos;
}
