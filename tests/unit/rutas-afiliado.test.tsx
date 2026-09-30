// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

// La API se simula: aquí solo probamos la navegación.
vi.mock('../../src/datos/cliente', () => ({
  cliente: {
    queries: { misBeneficiarios: vi.fn().mockResolvedValue({ data: [] }) },
    models: { Solicitud: { solicitudesPorAfiliado: vi.fn().mockResolvedValue({ data: [] }) } },
  },
}));

const { AreaAfiliado } = await import('../../src/afiliado/AreaAfiliado');

function Ubicacion() {
  return <output data-testid="ruta">{useLocation().pathname}</output>;
}

function montar(rutaInicial: string) {
  render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route path="/afiliado/*" element={<AreaAfiliado sub="sub-1" />} />
      </Routes>
      <Ubicacion />
    </MemoryRouter>,
  );
}

const ruta = () => screen.getByTestId('ruta').textContent;

describe('navegación del área del afiliado (bug de rutas relativas en react-router v7)', () => {
  afterEach(cleanup);

  it('desde Mis solicitudes, "Radicar" lleva a /afiliado/radicar (no a /afiliado/solicitudes/radicar)', async () => {
    montar('/afiliado/solicitudes');
    await userEvent.click(screen.getByRole('link', { name: 'Radicar' }));
    expect(ruta()).toBe('/afiliado/radicar');
  });

  it('desde Radicar, "Mis solicitudes" lleva a /afiliado/solicitudes', async () => {
    montar('/afiliado/radicar');
    await userEvent.click(screen.getByRole('link', { name: 'Mis solicitudes' }));
    expect(ruta()).toBe('/afiliado/solicitudes');
  });

  it('una ruta desconocida redirige UNA vez a /afiliado/solicitudes (sin crecer la URL)', async () => {
    montar('/afiliado/lo-que-sea/otra-cosa');
    expect(await screen.findByRole('heading', { name: 'Mis solicitudes' })).toBeTruthy();
    expect(ruta()).toBe('/afiliado/solicitudes');
  });
});
