import { describe, expect, it } from 'vitest';
import type { CoreAfiliaciones } from '../../amplify/shared/puertos/core-afiliaciones';
import { CoreSimulado } from '../../amplify/shared/adaptadores/core-simulado';
import { CoreFake } from '../fakes/core-fake';

/**
 * Prueba de CONTRATO del puerto CoreAfiliaciones (NFR-10, ADR-5).
 * La misma batería corre contra dos implementaciones distintas: si ambas la pasan,
 * cualquier adaptador que la pase (por ejemplo, el core real) es intercambiable.
 */
function contrato(nombre: string, crear: () => CoreAfiliaciones) {
  describe(`contrato CoreAfiliaciones: ${nombre}`, () => {
    it('devuelve el afiliado con documento, nombre, estado y categoría válidos', async () => {
      const a = await crear().consultarAfiliado('1001');
      expect(a).not.toBeNull();
      expect(a!.documento).toBe('1001');
      expect(typeof a!.nombre).toBe('string');
      expect(typeof a!.activo).toBe('boolean');
      expect(['A', 'B', 'C']).toContain(a!.categoria);
    });

    it('devuelve null para un documento inexistente', async () => {
      expect(await crear().consultarAfiliado('9999')).toBeNull();
    });

    it('reporta un afiliado inactivo como activo = false', async () => {
      const a = await crear().consultarAfiliado('2002');
      expect(a?.activo).toBe(false);
    });

    it('lista los beneficiarios con fecha de nacimiento ISO (AAAA-MM-DD) válida', async () => {
      const bs = await crear().listarBeneficiarios('1001');
      expect(bs.length).toBeGreaterThan(0);
      for (const b of bs) {
        expect(b.fechaNacimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(b.fechaNacimiento))).toBe(false);
        expect(['HIJO', 'CONYUGE', 'PADRE']).toContain(b.parentesco);
      }
    });

    it('devuelve lista vacía (no error) para un documento inexistente', async () => {
      expect(await crear().listarBeneficiarios('9999')).toEqual([]);
    });

    it('devuelve copias: modificar el resultado no altera la fuente', async () => {
      const core = crear();
      const a = await core.consultarAfiliado('1001');
      a!.categoria = 'C';
      const bs = await core.listarBeneficiarios('1001');
      bs.pop();
      expect((await core.consultarAfiliado('1001'))!.categoria).not.toBe('C');
      expect((await core.listarBeneficiarios('1001')).length).toBe(bs.length + 1);
    });
  });
}

contrato('CoreSimulado', () => new CoreSimulado());
contrato('CoreFake', () =>
  new CoreFake({
    afiliados: [
      { documento: '1001', nombre: 'Afiliada Fake', activo: true, categoria: 'A' },
      { documento: '2002', nombre: 'Inactivo Fake', activo: false, categoria: 'B' },
    ],
    beneficiarios: {
      '1001': [
        { documento: '5001', nombre: 'Hijo Fake', parentesco: 'HIJO', fechaNacimiento: '2018-05-05' },
        { documento: '5002', nombre: 'Hija Fake', parentesco: 'HIJO', fechaNacimiento: '2015-01-20' },
      ],
    },
  }),
);
