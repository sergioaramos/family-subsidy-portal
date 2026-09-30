const FORMATO_BOGOTA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora de Bogotá (ADR-14): el afiliado ve su hora local, no UTC. */
export function fechaHoraBogota(iso: string): string {
  return FORMATO_BOGOTA.format(new Date(iso));
}

const ETIQUETAS: Record<string, string> = {
  RADICADA: 'Radicada',
  EN_REVISION: 'En revisión',
  DEVUELTA: 'Devuelta para corregir',
  PREAPROBADA: 'Preaprobada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  DESISTIDA: 'Desistida',
};

export function etiquetaEstado(estado: string): string {
  return ETIQUETAS[estado] ?? estado;
}
