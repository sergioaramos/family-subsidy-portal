import { describe, expect, it } from 'vitest';
import { convocatoriaDemo } from '../../scripts/lib/convocatoria-demo';

describe('convocatoriaDemo (T21)', () => {
  const ahora = new Date('2026-09-30T15:00:00Z');
  const c = convocatoriaDemo(ahora);

  it('queda ABIERTA: la apertura ya pasó y el cierre es futuro', () => {
    expect(c.estado).toBe('ABIERTA');
    expect(Date.parse(c.apertura)).toBeLessThanOrEqual(ahora.getTime());
    expect(Date.parse(c.cierre)).toBeGreaterThan(ahora.getTime());
  });

  it('empieza sin computadores aprobados ni preaprobados, con cupo de 400', () => {
    expect(c).toMatchObject({ cupoPC: 400, aprobadosPC: 0, preaprobadosPC: 0, conteos: {} });
  });

  it('trae los campos que AppSync exige al leer un ítem escrito con el SDK (R-1)', () => {
    expect(c.__typename).toBe('Convocatoria');
    expect(c.createdAt).toBe(ahora.toISOString());
    expect(c.updatedAt).toBe(ahora.toISOString());
    expect(c.id).toMatch(/^conv-demo-\d{4}$/);
  });
});
