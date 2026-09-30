import { beforeEach, describe, expect, it, vi } from 'vitest';

const createPresignedPost = vi.fn();
vi.mock('@aws-sdk/s3-presigned-post', () => ({ createPresignedPost }));

process.env.BUCKET_SOPORTES = 'bucket-prueba';
const { handler } = await import('../../amplify/functions/comandos/handler');

const evento = (args: Record<string, unknown>) => ({
  typeName: 'Mutation',
  fieldName: 'solicitarCargaSoporte',
  arguments: args,
  identity: { sub: 'sub-del-token', username: 'usuario-1', claims: {}, groups: ['AFILIADO'] },
  source: null,
  request: { headers: {} },
  prev: null,
});
const invocar = (e: unknown) => (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(e);

describe('@AC-25 comando solicitarCargaSoporte', () => {
  beforeEach(() => {
    createPresignedPost.mockReset();
    createPresignedPost.mockResolvedValue({ url: 'https://s3/bucket-prueba', fields: { key: 'k', Policy: 'p' } });
  });

  it('firma una POST en la carpeta del sub DEL TOKEN, con las condiciones de tamaño y tipo', async () => {
    const r = await invocar(evento({ nombreArchivo: 'cert.pdf', tipoContenido: 'application/pdf', tamanoBytes: 2000 }));
    const [, params] = createPresignedPost.mock.calls[0];
    expect(params.Bucket).toBe('bucket-prueba');
    expect(params.Key).toMatch(/^pendientes\/sub-del-token\/[0-9a-f-]{36}-cert\.pdf$/);
    expect(params.Conditions).toContainEqual(['content-length-range', 1, 5 * 1024 * 1024]);
    expect(r).toMatchObject({ url: 'https://s3/bucket-prueba', clave: params.Key });
    // AWSJSON: la Lambda devuelve el OBJETO; AppSync lo serializa una vez. Si la Lambda hiciera
    // JSON.stringify, quedaría doblemente serializado (bug real encontrado en T27).
    expect(r.campos).toEqual({ key: 'k', Policy: 'p' });
  });

  it('rechaza un .docx sin firmar nada', async () => {
    await expect(
      invocar(evento({ nombreArchivo: 'x.docx', tipoContenido: 'application/msword', tamanoBytes: 10 })),
    ).rejects.toThrow('Formato no permitido');
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('rechaza un archivo de 6 MB sin firmar nada', async () => {
    await expect(
      invocar(evento({ nombreArchivo: 'x.jpg', tipoContenido: 'image/jpeg', tamanoBytes: 6 * 1024 * 1024 })),
    ).rejects.toThrow('Supera 5 MB');
    expect(createPresignedPost).not.toHaveBeenCalled();
  });
});
