import { describe, expect, it, vi } from 'vitest';
import { subirSoporteDirecto } from '../../src/afiliado/subirSoporte';
import { etiquetaEstado, fechaHoraBogota } from '../../src/comun/formato';

describe('subirSoporteDirecto (paso 2: POST multipart directo a S3)', () => {
  const carga = { url: 'https://s3.example/bucket', campos: JSON.stringify({ key: 'pendientes/s/u-cert.pdf', Policy: 'p', 'Content-Type': 'application/pdf' }) };
  const archivo = new File(['%PDF'], 'cert.pdf', { type: 'application/pdf' });

  it('envía los campos firmados primero y el archivo AL FINAL (S3 ignora campos después del archivo)', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await subirSoporteDirecto(carga, archivo, fetchFalso);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://s3.example/bucket');
    expect(init.method).toBe('POST');
    const nombres = [...(init.body as FormData).keys()];
    expect(nombres).toEqual(['key', 'Policy', 'Content-Type', 'file']);
  });

  it('traduce los rechazos de S3 a mensajes para el afiliado', async () => {
    const xml = (code: string) => new Response(`<Error><Code>${code}</Code></Error>`, { status: 400 });
    await expect(subirSoporteDirecto(carga, archivo, vi.fn().mockResolvedValue(xml('EntityTooLarge')))).rejects.toThrow('Supera 5 MB');
    await expect(subirSoporteDirecto(carga, archivo, vi.fn().mockResolvedValue(new Response('', { status: 403 })))).rejects.toThrow(
      'La carga no fue autorizada o venció; intenta de nuevo',
    );
  });
});

describe('formato para mostrar', () => {
  it('muestra la fecha y hora en Bogotá, no en UTC', () => {
    expect(fechaHoraBogota('2027-01-15T19:05:00.000Z')).toBe('15/01/2027, 14:05');
  });

  it.each([
    ['RADICADA', 'Radicada'],
    ['EN_REVISION', 'En revisión'],
    ['DEVUELTA', 'Devuelta para corregir'],
    ['PREAPROBADA', 'Preaprobada'],
    ['APROBADA', 'Aprobada'],
    ['RECHAZADA', 'Rechazada'],
    ['DESISTIDA', 'Desistida'],
  ])('estado %s → "%s"', (estado, etiqueta) => {
    expect(etiquetaEstado(estado)).toBe(etiqueta);
  });
});
