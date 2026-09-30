import { describe, expect, it } from 'vitest';
import { leerArgumentosFuncionario } from '../../scripts/lib/argumentos-funcionario';

describe('@AC-7 argumentos del script crear-funcionario (FR-8)', () => {
  it('acepta correo y grupo ANALISTA o COORDINADOR', () => {
    expect(leerArgumentosFuncionario(['--correo', 'laura@example.com', '--grupo', 'ANALISTA'])).toEqual({
      correo: 'laura@example.com',
      grupo: 'ANALISTA',
    });
    expect(leerArgumentosFuncionario(['--grupo', 'COORDINADOR', '--correo', 'jefe@example.com']).grupo).toBe('COORDINADOR');
  });

  it('rechaza AFILIADO: ese rol solo se obtiene por autorregistro validado contra el core', () => {
    expect(() => leerArgumentosFuncionario(['--correo', 'x@example.com', '--grupo', 'AFILIADO'])).toThrow(
      'El grupo debe ser ANALISTA o COORDINADOR',
    );
  });

  it('exige un correo válido', () => {
    expect(() => leerArgumentosFuncionario(['--grupo', 'ANALISTA'])).toThrow('Falta --correo');
    expect(() => leerArgumentosFuncionario(['--correo', 'no-es-correo', '--grupo', 'ANALISTA'])).toThrow('Correo no válido');
  });
});
