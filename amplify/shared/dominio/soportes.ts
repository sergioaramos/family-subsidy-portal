/**
 * Reglas de los soportes (FR-24, FR-25, FR-26; ADR-10). Puras: sin AWS.
 * El límite real lo hace cumplir S3 con las condiciones de la POST prefirmada.
 */
export const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
export const MAXIMO_SOPORTES = 3;
export const SEGUNDOS_VIGENCIA_CARGA = 300;

export const MOTIVOS_SOPORTE = {
  FORMATO: { codigo: 'FORMATO', mensaje: 'Formato no permitido' },
  TAMANO: { codigo: 'TAMANO', mensaje: 'Supera 5 MB' },
  VACIO: { codigo: 'VACIO', mensaje: 'El archivo está vacío' },
} as const;

type MotivoSoporte = (typeof MOTIVOS_SOPORTE)[keyof typeof MOTIVOS_SOPORTE];
export type ResultadoSoporte = { ok: true } | ({ ok: false } & MotivoSoporte);

/** Valida lo que el cliente DECLARA antes de firmar la carga (primera barrera; S3 es la segunda). */
export function validarSoporteDeclarado(tipo: string, tamanoBytes: number): ResultadoSoporte {
  if (!(TIPOS_PERMITIDOS as readonly string[]).includes(tipo)) return { ok: false, ...MOTIVOS_SOPORTE.FORMATO };
  if (tamanoBytes <= 0) return { ok: false, ...MOTIVOS_SOPORTE.VACIO };
  if (tamanoBytes > TAMANO_MAXIMO_BYTES) return { ok: false, ...MOTIVOS_SOPORTE.TAMANO };
  return { ok: true };
}

/**
 * Clave S3 del soporte mientras no se radica. La decide el SERVIDOR: el afiliado solo escribe en su carpeta.
 * El nombre se limpia (sin rutas ni caracteres raros) para evitar "../" y claves ambiguas.
 */
export function claveSoportePendiente(sub: string, nombreArchivo: string, id: string): string {
  const base = nombreArchivo.split(/[\\/]/).pop() ?? 'archivo';
  const limpio = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  return `pendientes/${sub}/${id}-${limpio}`;
}

/** Condiciones de una política de POST de S3 (mismo formato que la librería, sin depender de ella). */
export type CondicionPost = ['content-length-range', number, number] | ['eq', string, string];

/** Parámetros de la POST prefirmada: condiciones FIRMADAS que S3 hace cumplir por sí mismo. */
export function condicionesPostSoporte(clave: string, tipo: string) {
  const Conditions: CondicionPost[] = [
    ['content-length-range', 1, TAMANO_MAXIMO_BYTES],
    ['eq', '$Content-Type', tipo],
  ];
  return {
    Key: clave,
    Conditions,
    Fields: { 'Content-Type': tipo },
    Expires: SEGUNDOS_VIGENCIA_CARGA,
  };
}
