import type { Afiliado, Beneficiario, CoreAfiliaciones } from '../../amplify/shared/puertos/core-afiliaciones';

/**
 * Implementación en memoria del puerto, configurable por prueba.
 * Existe para demostrar que el contrato no depende de una implementación concreta (NFR-10)
 * y para que las pruebas de los casos de uso controlen exactamente qué responde el core.
 */
export class CoreFake implements CoreAfiliaciones {
  constructor(
    private readonly datos: { afiliados: Afiliado[]; beneficiarios: Record<string, Beneficiario[]> },
  ) {}

  async consultarAfiliado(documento: string): Promise<Afiliado | null> {
    const a = this.datos.afiliados.find((x) => x.documento === documento);
    return a ? structuredClone(a) : null;
  }

  async listarBeneficiarios(documentoAfiliado: string): Promise<Beneficiario[]> {
    return structuredClone(this.datos.beneficiarios[documentoAfiliado] ?? []);
  }
}
