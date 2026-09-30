/** FR-27, Q14: radicado legible y único: SUB-<año de la convocatoria>-<consecutivo de 6 dígitos>. */
export function formatoRadicado(anio: string, consecutivo: number): string {
  return `SUB-${anio}-${String(consecutivo).padStart(6, '0')}`;
}
