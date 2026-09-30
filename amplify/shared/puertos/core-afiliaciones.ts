/**
 * PUERTO hacia el sistema de afiliaciones (core) de la caja (ADR-5, NFR-10).
 * La lógica de negocio depende SOLO de esta interfaz. Hoy la implementa CoreSimulado;
 * el día que exista acceso al core real se agrega otro adaptador sin tocar el resto.
 */
export type Categoria = 'A' | 'B' | 'C';
export type Parentesco = 'HIJO' | 'CONYUGE' | 'PADRE';

export interface Afiliado {
  documento: string;
  nombre: string;
  activo: boolean;
  categoria: Categoria;
}

export interface Beneficiario {
  documento: string;
  nombre: string;
  parentesco: Parentesco;
  /** Fecha ISO AAAA-MM-DD. */
  fechaNacimiento: string;
}

export interface CoreAfiliaciones {
  /** Devuelve el afiliado, o null si el documento no existe en el core. */
  consultarAfiliado(documento: string): Promise<Afiliado | null>;
  /** Beneficiarios registrados a nombre del afiliado; lista vacía si no tiene o no existe. */
  listarBeneficiarios(documentoAfiliado: string): Promise<Beneficiario[]>;
}
