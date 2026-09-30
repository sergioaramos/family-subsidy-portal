/**
 * Llaves de los ítems de bloqueo en la tabla Control (ADR-3, NFR-7).
 * Hay UNA sola llave posible por niño y convocatoria: DynamoDB no deja crear dos.
 */
export function claveBloqueoKit(convocatoriaId: string, documentoBeneficiario: string): string {
  return `LOCK#KIT#${convocatoriaId}#${documentoBeneficiario}`;
}

export const MENSAJE_BENEFICIARIO_CON_SOLICITUD = 'Este beneficiario ya tiene una solicitud';
