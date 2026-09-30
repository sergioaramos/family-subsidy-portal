import type { Afiliado, Beneficiario } from '../puertos/core-afiliaciones';

/**
 * Reglas de elegibilidad (FR-18, FR-19; las de computador llegan en F2).
 * Funciones PURAS: sin AWS, sin red, sin leer el reloj del sistema. La fecha siempre entra como parámetro.
 */

export const MOTIVOS = {
  AFILIADO_INACTIVO: { codigo: 'AFILIADO_INACTIVO', mensaje: 'Tu afiliación no está activa' },
  CATEGORIA_NO_APLICA: { codigo: 'CATEGORIA_NO_APLICA', mensaje: 'Tu categoría no aplica para este subsidio' },
  NO_ES_HIJO: { codigo: 'NO_ES_HIJO', mensaje: 'El subsidio es solo para hijos registrados como beneficiarios' },
  EDAD_KIT: { codigo: 'EDAD_KIT', mensaje: 'El kit escolar es para hijos de 5 a 17 años cumplidos' },
} as const;

export type Motivo = (typeof MOTIVOS)[keyof typeof MOTIVOS];
export type Resultado = { ok: true } | ({ ok: false } & Motivo);

const OK: Resultado = { ok: true };
const rechazo = (m: Motivo): Resultado => ({ ok: false, ...m });

/** Fecha calendario (AAAA-MM-DD) en Bogotá para un instante dado (ADR-14). */
export function fechaEnBogota(instante: Date): string {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(instante);
}

/** Años cumplidos entre dos fechas calendario AAAA-MM-DD. Sin zonas horarias: solo calendario. */
export function calcularEdad(fechaNacimiento: string, fecha: string): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [af, mf, df] = fecha.split('-').map(Number);
  const yaCumplio = mf > mn || (mf === mn && df >= dn);
  return af - an - (yaCumplio ? 0 : 1);
}

/** FR-18: afiliado activo y de categoría A o B. Un documento inexistente se trata como inactivo. */
export function verificarAfiliado(afiliado: Afiliado | null): Resultado {
  if (!afiliado?.activo) return rechazo(MOTIVOS.AFILIADO_INACTIVO);
  if (afiliado.categoria === 'C') return rechazo(MOTIVOS.CATEGORIA_NO_APLICA);
  return OK;
}

/** FR-19: el kit escolar es para HIJOS de 5 a 17 años cumplidos a la fecha de radicación (Bogotá). */
export function verificarKitEscolar(beneficiario: Beneficiario, fechaRadicacion: string): Resultado {
  if (beneficiario.parentesco !== 'HIJO') return rechazo(MOTIVOS.NO_ES_HIJO);
  const edad = calcularEdad(beneficiario.fechaNacimiento, fechaRadicacion);
  return edad >= 5 && edad <= 17 ? OK : rechazo(MOTIVOS.EDAD_KIT);
}
