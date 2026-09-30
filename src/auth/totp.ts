/** Un código TOTP son exactamente 6 dígitos (RFC 6238, configuración por defecto de Cognito). */
export function esCodigoTotp(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}
