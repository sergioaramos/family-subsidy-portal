import type { CoreAfiliaciones } from '../puertos/core-afiliaciones';

/** Versión vigente de la autorización de tratamiento de datos personales (Ley 1581). */
export const VERSION_AUTORIZACION = 'v1';

export const MENSAJES_REGISTRO = {
  sinAutorizacion: 'Debes aceptar la autorización de tratamiento de datos personales',
  // Mismo mensaje para "inactivo" e "inexistente": no se revela qué sabe el core (FR-3).
  sinAfiliacionActiva: 'No encontramos una afiliación activa con este documento',
} as const;

export interface EntradaRegistro {
  documento?: string;
  autorizacionDatos?: string;
}

/**
 * Regla de negocio del autorregistro (FR-1, FR-2, FR-3, FR-6).
 * Lanza un Error con un mensaje apto para mostrar al usuario si el registro no procede.
 */
export async function validarRegistro(entrada: EntradaRegistro, core: CoreAfiliaciones): Promise<void> {
  if (entrada.autorizacionDatos !== VERSION_AUTORIZACION) {
    throw new Error(MENSAJES_REGISTRO.sinAutorizacion);
  }
  const documento = entrada.documento?.trim();
  if (!documento) throw new Error(MENSAJES_REGISTRO.sinAfiliacionActiva);

  const afiliado = await core.consultarAfiliado(documento);
  if (!afiliado?.activo) throw new Error(MENSAJES_REGISTRO.sinAfiliacionActiva);
}
