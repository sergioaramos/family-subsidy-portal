import type { Afiliado, Beneficiario, CoreAfiliaciones } from '../puertos/core-afiliaciones';
import datos from '../datos/core-simulado.json';

/**
 * ADAPTADOR simulado del core (ADR-5). Lee un dataset versionado en el repo.
 * Devuelve copias para que nadie pueda alterar el dataset desde afuera.
 */
export class CoreSimulado implements CoreAfiliaciones {
  private readonly afiliados = datos.afiliados as Afiliado[];
  private readonly beneficiarios = datos.beneficiarios as Record<string, Beneficiario[]>;

  async consultarAfiliado(documento: string): Promise<Afiliado | null> {
    const a = this.afiliados.find((x) => x.documento === documento);
    return a ? { ...a } : null;
  }

  async listarBeneficiarios(documentoAfiliado: string): Promise<Beneficiario[]> {
    return (this.beneficiarios[documentoAfiliado] ?? []).map((b) => ({ ...b }));
  }
}
