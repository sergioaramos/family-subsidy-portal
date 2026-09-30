/** Motivos estándar de rechazo (spec Q15). "Otro" exige observación. */
export const MOTIVOS_RECHAZO = [
  'Certificado no corresponde al año en curso',
  'Certificado no corresponde al beneficiario',
  'Documento ilegible o incompleto',
  'Beneficiario no está estudiando',
  'Información inconsistente con el core',
  'Otro',
] as const;

export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number];

/** Devuelve un mensaje de error, o null si el motivo y la observación son válidos (FR-41). */
export function validarMotivoRechazo(motivo: string, observacion: string): string | null {
  if (!(MOTIVOS_RECHAZO as readonly string[]).includes(motivo)) return 'Debes elegir un motivo de la lista';
  if (motivo === 'Otro' && !observacion.trim()) return 'El motivo "Otro" requiere una observación';
  return null;
}
