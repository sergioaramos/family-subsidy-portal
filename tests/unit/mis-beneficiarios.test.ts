import { describe, expect, it } from 'vitest';
import { listarBeneficiariosElegibles } from '../../amplify/shared/casos-uso/mis-beneficiarios';
import { CoreFake } from '../fakes/core-fake';

const core = new CoreFake({
  afiliados: [{ documento: '10010001', nombre: 'Ana', activo: true, categoria: 'A' }],
  beneficiarios: {
    '10010001': [
      { documento: '30010', nombre: 'Tomás', parentesco: 'HIJO', fechaNacimiento: '2018-03-15' },
      { documento: '30042', nombre: 'Samuel', parentesco: 'HIJO', fechaNacimiento: '2022-06-01' },
      { documento: '10050005', nombre: 'Julián', parentesco: 'CONYUGE', fechaNacimiento: '1988-01-01' },
    ],
  },
});

describe('@AC-15 misBeneficiarios', () => {
  it('muestra los 2 hijos registrados en el core (no el cónyuge)', async () => {
    const r = await listarBeneficiariosElegibles('10010001', core, '2027-01-12');
    expect(r.map((b) => b.nombre)).toEqual(['Tomás', 'Samuel']);
  });

  it('calcula la edad a la fecha de radicación e indica si aplica para el kit y por qué no', async () => {
    const [tomas, samuel] = await listarBeneficiariosElegibles('10010001', core, '2027-01-12');
    expect(tomas).toMatchObject({ edad: 8, elegibleKit: true, motivoKit: null });
    expect(samuel).toMatchObject({ edad: 4, elegibleKit: false, motivoKit: 'El kit escolar es para hijos de 5 a 17 años cumplidos' });
  });

  it('devuelve lista vacía si el afiliado no tiene hijos registrados', async () => {
    expect(await listarBeneficiariosElegibles('99999999', core, '2027-01-12')).toEqual([]);
  });
});
