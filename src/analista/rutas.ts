/** Rutas ABSOLUTAS del área del analista (lección de react-router v7: nada relativo dentro de un splat). */
export const RUTAS_ANALISTA = {
  bandeja: '/analista/bandeja',
  asignadas: '/analista/asignadas',
  solicitud: (id: string) => `/analista/solicitud/${id}`,
} as const;
