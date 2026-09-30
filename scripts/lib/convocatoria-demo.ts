const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Convocatoria ABIERTA de prueba: abrió ayer y cierra en 60 días.
 * Incluye los campos que AppSync necesita al leer un ítem escrito con el SDK (ver plan §7, R-1).
 */
export function convocatoriaDemo(ahora: Date) {
  const iso = ahora.toISOString();
  const anio = ahora.getUTCFullYear() + 1; // la temporada escolar siguiente
  return {
    id: `conv-demo-${anio}`,
    __typename: 'Convocatoria' as const,
    nombre: `Convocatoria de prueba ${anio}`,
    apertura: new Date(ahora.getTime() - DIA_MS).toISOString(),
    cierre: new Date(ahora.getTime() + 60 * DIA_MS).toISOString(),
    estado: 'ABIERTA' as const,
    cupoPC: 400,
    aprobadosPC: 0,
    preaprobadosPC: 0,
    conteos: {} as Record<string, number>,
    createdAt: iso,
    updatedAt: iso,
  };
}
