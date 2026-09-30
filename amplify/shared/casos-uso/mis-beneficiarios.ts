import type { CoreAfiliaciones } from '../puertos/core-afiliaciones';
import { calcularEdad, verificarKitEscolar } from '../dominio/elegibilidad';

export interface BeneficiarioElegible {
  documento: string;
  nombre: string;
  fechaNacimiento: string;
  edad: number;
  elegibleKit: boolean;
  motivoKit: string | null;
}

/**
 * FR-16: hijos del afiliado según el core, con su edad a la fecha de radicación y si aplican al kit.
 * Se muestran solo los HIJOS: el subsidio en especie es para ellos.
 */
export async function listarBeneficiariosElegibles(
  documentoAfiliado: string,
  core: CoreAfiliaciones,
  fechaRadicacion: string,
): Promise<BeneficiarioElegible[]> {
  const beneficiarios = await core.listarBeneficiarios(documentoAfiliado);
  return beneficiarios
    .filter((b) => b.parentesco === 'HIJO')
    .map((b) => {
      const kit = verificarKitEscolar(b, fechaRadicacion);
      return {
        documento: b.documento,
        nombre: b.nombre,
        fechaNacimiento: b.fechaNacimiento,
        edad: calcularEdad(b.fechaNacimiento, fechaRadicacion),
        elegibleKit: kit.ok,
        motivoKit: kit.ok ? null : kit.mensaje,
      };
    });
}
