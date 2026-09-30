import { describe, expect, it } from 'vitest';
import datos from '../../amplify/shared/datos/core-simulado.json';

/**
 * NFR-13: el dataset del core simulado cubre todos los casos que la spec necesita probar.
 * Las edades se calculan a la fecha de apertura de la convocatoria de prueba: 12 ene 2027.
 */
const FECHA_REFERENCIA = new Date('2027-01-12T00:00:00Z');

function edad(fechaNacimiento: string): number {
  const n = new Date(`${fechaNacimiento}T00:00:00Z`);
  let e = FECHA_REFERENCIA.getUTCFullYear() - n.getUTCFullYear();
  const cumplio =
    FECHA_REFERENCIA.getUTCMonth() > n.getUTCMonth() ||
    (FECHA_REFERENCIA.getUTCMonth() === n.getUTCMonth() && FECHA_REFERENCIA.getUTCDate() >= n.getUTCDate());
  if (!cumplio) e -= 1;
  return e;
}

describe('@NFR-13 cobertura del dataset del core simulado', () => {
  const afiliados = datos.afiliados;
  const hijos = Object.values(datos.beneficiarios).flat().filter((b) => b.parentesco === 'HIJO');

  it('incluye los documentos que usan los escenarios: 10010001 activo, 20020002 inactivo y 99999999 inexistente', () => {
    expect(afiliados.find((a) => a.documento === '10010001')?.activo).toBe(true);
    expect(afiliados.find((a) => a.documento === '20020002')?.activo).toBe(false);
    expect(afiliados.find((a) => a.documento === '99999999')).toBeUndefined();
  });

  it('incluye afiliados activos de las tres categorías A, B y C', () => {
    const categorias = new Set(afiliados.filter((a) => a.activo).map((a) => a.categoria));
    expect([...categorias].sort()).toEqual(['A', 'B', 'C']);
  });

  it.each([4, 5, 9, 10, 17, 18])('incluye un hijo con exactamente %i años a la fecha de referencia', (e) => {
    expect(hijos.some((h) => edad(h.fechaNacimiento) === e)).toBe(true);
  });

  it('incluye un niño registrado como beneficiario de dos afiliados (ambos padres)', () => {
    const conteo = new Map<string, number>();
    for (const lista of Object.values(datos.beneficiarios)) {
      for (const b of lista) conteo.set(b.documento, (conteo.get(b.documento) ?? 0) + 1);
    }
    expect([...conteo.values()].some((n) => n >= 2)).toBe(true);
  });
});
