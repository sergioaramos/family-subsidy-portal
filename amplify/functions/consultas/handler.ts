import { crearCore } from '../../shared/adaptadores/fabrica-core';
import { obtenerDocumento } from '../../shared/adaptadores/perfil-cognito';
import { listarBeneficiariosElegibles } from '../../shared/casos-uso/mis-beneficiarios';
import { fechaEnBogota } from '../../shared/dominio/elegibilidad';
import type { EventoAmplify } from '../../shared/tipos/evento-amplify';

const core = crearCore();
const USER_POOL_ID = process.env.USER_POOL_ID!;

/**
 * Router: Amplify invoca esta Lambda para varias queries; `fieldName` dice cuál.
 * La identidad viene del token que AppSync YA validó; nunca de los argumentos.
 */
export const handler = async (event: EventoAmplify): Promise<unknown> => {
  switch (event.fieldName) {
    case 'misBeneficiarios': {
      const documento = await obtenerDocumento(USER_POOL_ID, event.identity.username);
      return listarBeneficiariosElegibles(documento, core, fechaEnBogota(new Date()));
    }
    default:
      throw new Error(`Consulta no soportada: ${event.fieldName}`);
  }
};
