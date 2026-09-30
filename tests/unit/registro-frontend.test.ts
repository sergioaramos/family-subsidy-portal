import { describe, expect, it } from 'vitest';
import { atributosDeRegistro, limpiarMensajeCognito } from '../../src/auth/registro';

describe('limpiarMensajeCognito', () => {
  it('quita el prefijo técnico que Cognito agrega a los errores de los triggers', () => {
    const e = new Error('PreSignUp failed with error No encontramos una afiliación activa con este documento.');
    expect(limpiarMensajeCognito(e)).toBe('No encontramos una afiliación activa con este documento');
  });

  it('deja intactos los demás mensajes', () => {
    expect(limpiarMensajeCognito(new Error('User already exists'))).toBe('User already exists');
  });

  it('tolera valores que no son Error', () => {
    expect(limpiarMensajeCognito('algo raro')).toBe('No fue posible completar el registro');
  });
});

describe('atributosDeRegistro', () => {
  it('@AC-1 agrega la versión vigente de la autorización y conserva los atributos del formulario', () => {
    const a = atributosDeRegistro({ email: 'ana@example.com', 'custom:documento': ' 10010001 ', acepta_autorizacion: 'si' });
    expect(a).toEqual({ email: 'ana@example.com', 'custom:documento': '10010001', 'custom:autorizacionDatos': 'v1' });
  });

  it('nunca envía a Cognito el campo de la casilla (no es un atributo del pool)', () => {
    expect(atributosDeRegistro({ email: 'x@example.com', acepta_autorizacion: 'si' })).not.toHaveProperty('acepta_autorizacion');
  });
});
