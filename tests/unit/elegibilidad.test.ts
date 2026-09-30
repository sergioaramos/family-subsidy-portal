import { describe, expect, it } from 'vitest';
import {
  calcularEdad,
  fechaEnBogota,
  verificarAfiliado,
  verificarKitEscolar,
  MOTIVOS,
} from '../../amplify/shared/dominio/elegibilidad';
import type { Afiliado, Beneficiario } from '../../amplify/shared/puertos/core-afiliaciones';

const afiliado = (p: Partial<Afiliado> = {}): Afiliado => ({
  documento: '10010001', nombre: 'Ana', activo: true, categoria: 'A', ...p,
});
const hijo = (fechaNacimiento: string, p: Partial<Beneficiario> = {}): Beneficiario => ({
  documento: '30011', nombre: 'Sara', parentesco: 'HIJO', fechaNacimiento, ...p,
});

describe('fechaEnBogota (ADR-14: las fechas de negocio son de Bogotá, UTC-5)', () => {
  it('a las 03:00 UTC del 12 de enero todavía es 11 de enero en Bogotá', () => {
    expect(fechaEnBogota(new Date('2027-01-12T03:00:00Z'))).toBe('2027-01-11');
  });
  it('a las 05:00 UTC ya es 12 de enero en Bogotá', () => {
    expect(fechaEnBogota(new Date('2027-01-12T05:00:00Z'))).toBe('2027-01-12');
  });
});

describe('calcularEdad (años cumplidos)', () => {
  it.each([
    ['2022-01-12', '2027-01-12', 5], // cumple justo ese día
    ['2022-01-12', '2027-01-11', 4], // un día antes
    ['2008-12-01', '2027-01-12', 18],
    ['2009-06-06', '2027-01-12', 17],
    ['2020-02-29', '2027-02-28', 6], // nacido en año bisiesto: en año no bisiesto cumple el 1 de marzo
    ['2020-02-29', '2027-03-01', 7],
  ])('nacido %s, a la fecha %s tiene %i', (nacimiento, fecha, edad) => {
    expect(calcularEdad(nacimiento, fecha)).toBe(edad);
  });
});

describe('@AC-17 verificarAfiliado', () => {
  it('acepta a un afiliado activo de categoría A o B', () => {
    expect(verificarAfiliado(afiliado({ categoria: 'A' }))).toEqual({ ok: true });
    expect(verificarAfiliado(afiliado({ categoria: 'B' }))).toEqual({ ok: true });
  });
  it('rechaza al inactivo con "Tu afiliación no está activa"', () => {
    expect(verificarAfiliado(afiliado({ activo: false }))).toEqual({ ok: false, ...MOTIVOS.AFILIADO_INACTIVO });
    expect(MOTIVOS.AFILIADO_INACTIVO.mensaje).toBe('Tu afiliación no está activa');
  });
  it('rechaza la categoría C con "Tu categoría no aplica para este subsidio"', () => {
    expect(verificarAfiliado(afiliado({ categoria: 'C' }))).toEqual({ ok: false, ...MOTIVOS.CATEGORIA_NO_APLICA });
    expect(MOTIVOS.CATEGORIA_NO_APLICA.mensaje).toBe('Tu categoría no aplica para este subsidio');
  });
  it('trata un afiliado inexistente (null) como inactivo', () => {
    expect(verificarAfiliado(null)).toEqual({ ok: false, ...MOTIVOS.AFILIADO_INACTIVO });
  });
});

describe('@AC-18 verificarKitEscolar: hijo de 5 a 17 años cumplidos a la fecha de radicación', () => {
  const radicacion = '2027-01-12';
  it.each([
    ['2022-06-01', 4, false],
    ['2022-01-12', 5, true],
    ['2009-06-06', 17, true],
    ['2008-12-01', 18, false],
  ])('nacido %s (%i años): permitido = %s', (nacimiento, _edad, permitido) => {
    const r = verificarKitEscolar(hijo(nacimiento), radicacion);
    expect(r.ok).toBe(permitido);
    if (!permitido) expect(r).toEqual({ ok: false, ...MOTIVOS.EDAD_KIT });
  });
  it('rechaza a un beneficiario que no es hijo (p. ej. el cónyuge)', () => {
    expect(verificarKitEscolar(hijo('2015-01-01', { parentesco: 'CONYUGE' }), radicacion)).toEqual({
      ok: false,
      ...MOTIVOS.NO_ES_HIJO,
    });
  });
});
