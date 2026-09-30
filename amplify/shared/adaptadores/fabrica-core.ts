import type { CoreAfiliaciones } from '../puertos/core-afiliaciones';
import { CoreSimulado } from './core-simulado';

/**
 * ÚNICO punto donde se elige el adaptador del core (NFR-10).
 * El día que exista acceso al core real: agregar CoreHttp y cambiar esta función.
 */
export function crearCore(): CoreAfiliaciones {
  return new CoreSimulado();
}
