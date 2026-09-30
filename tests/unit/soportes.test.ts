import { describe, expect, it } from 'vitest';
import {
  TAMANO_MAXIMO_BYTES,
  TIPOS_PERMITIDOS,
  claveSoportePendiente,
  condicionesPostSoporte,
  validarSoporteDeclarado,
  MOTIVOS_SOPORTE,
} from '../../amplify/shared/dominio/soportes';

describe('@AC-25 validarSoporteDeclarado (FR-25, FR-26)', () => {
  it.each(['application/pdf', 'image/jpeg', 'image/png'])('acepta %s de hasta 5 MB', (tipo) => {
    expect(validarSoporteDeclarado(tipo, TAMANO_MAXIMO_BYTES)).toEqual({ ok: true });
  });

  it('rechaza un .docx con "Formato no permitido"', () => {
    const r = validarSoporteDeclarado('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000);
    expect(r).toEqual({ ok: false, ...MOTIVOS_SOPORTE.FORMATO });
    expect(MOTIVOS_SOPORTE.FORMATO.mensaje).toBe('Formato no permitido');
  });

  it('rechaza un JPG de 6 MB con "Supera 5 MB"', () => {
    expect(validarSoporteDeclarado('image/jpeg', 6 * 1024 * 1024)).toEqual({ ok: false, ...MOTIVOS_SOPORTE.TAMANO });
    expect(MOTIVOS_SOPORTE.TAMANO.mensaje).toBe('Supera 5 MB');
  });

  it('rechaza un archivo vacío', () => {
    expect(validarSoporteDeclarado('application/pdf', 0).ok).toBe(false);
  });
});

describe('claveSoportePendiente', () => {
  it('queda en la carpeta del afiliado (pendientes/<sub>/) con un identificador único', () => {
    expect(claveSoportePendiente('sub-1', 'certificado.pdf', 'u-123')).toBe('pendientes/sub-1/u-123-certificado.pdf');
  });

  it('limpia el nombre: sin rutas, espacios ni caracteres raros (evita ../ y claves ambiguas)', () => {
    expect(claveSoportePendiente('sub-1', '../../otro/Cert Año 2027 (1).pdf', 'u-1')).toBe(
      'pendientes/sub-1/u-1-Cert_A_o_2027__1_.pdf',
    );
  });
});

describe('condicionesPostSoporte: lo que S3 hará cumplir por sí mismo', () => {
  const c = condicionesPostSoporte('pendientes/sub-1/u-1-cert.pdf', 'application/pdf');

  it('limita el tamaño entre 1 byte y 5 MB', () => {
    expect(c.Conditions).toContainEqual(['content-length-range', 1, TAMANO_MAXIMO_BYTES]);
  });

  it('exige el Content-Type declarado y la clave exacta', () => {
    expect(c.Conditions).toContainEqual(['eq', '$Content-Type', 'application/pdf']);
    expect(c.Fields).toEqual({ 'Content-Type': 'application/pdf' });
    expect(c.Key).toBe('pendientes/sub-1/u-1-cert.pdf');
  });

  it('vence en 5 minutos', () => {
    expect(c.Expires).toBe(300);
  });

  it('solo hay 3 tipos permitidos', () => {
    expect([...TIPOS_PERMITIDOS]).toEqual(['application/pdf', 'image/jpeg', 'image/png']);
  });
});
