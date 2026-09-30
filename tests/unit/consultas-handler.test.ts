import { beforeEach, describe, expect, it, vi } from 'vitest';

// El documento lo resuelve Cognito; aquí lo simulamos.
const obtenerDocumento = vi.fn();
vi.mock('../../amplify/shared/adaptadores/perfil-cognito', () => ({ obtenerDocumento }));

const { handler } = await import('../../amplify/functions/consultas/handler');

/** Payload REAL con el que Amplify invoca las funciones (ver graphql-function-transformer): sin `info`. */
const eventoAmplify = (fieldName: string) => ({
  typeName: 'Query',
  fieldName,
  arguments: {},
  identity: { sub: 'sub-1', username: 'usuario-1', claims: {}, groups: ['AFILIADO'] },
  source: null,
  request: { headers: {} },
  prev: null,
});

const invocar = (e: unknown) => (handler as unknown as (e: unknown) => Promise<unknown>)(e);

describe('router de la Lambda consultas', () => {
  beforeEach(() => {
    obtenerDocumento.mockReset();
  });

  it('@AC-15 misBeneficiarios resuelve el documento del usuario del token y lista sus hijos', async () => {
    obtenerDocumento.mockResolvedValue('10010001');
    const r = (await invocar(eventoAmplify('misBeneficiarios'))) as { nombre: string }[];
    expect(obtenerDocumento).toHaveBeenCalledWith(undefined, 'usuario-1');
    expect(r.map((b) => b.nombre)).toEqual(['Tomás Arango Gómez', 'Sara Arango Gómez']);
  });

  it('rechaza un campo no soportado', async () => {
    await expect(invocar(eventoAmplify('otraCosa'))).rejects.toThrow('Consulta no soportada: otraCosa');
  });
});
