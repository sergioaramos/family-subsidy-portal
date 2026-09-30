// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

const solicitudesPorEstado = vi.fn();
const tomarSolicitud = vi.fn();
vi.mock('../../src/datos/cliente', () => ({
  cliente: {
    models: { Solicitud: { solicitudesPorEstado } },
    mutations: { tomarSolicitud },
  },
}));

const { Bandeja } = await import('../../src/analista/Bandeja');

function Ubicacion() {
  return <output data-testid="ruta">{useLocation().pathname}</output>;
}

describe('@AC-32 @AC-33 bandeja del analista', () => {
  afterEach(cleanup);

  it('pide las RADICADAS en orden ascendente, las muestra y "Tomar" asigna y abre la revisión', async () => {
    solicitudesPorEstado.mockResolvedValue({
      data: [
        { id: 's1', radicado: 'SUB-2027-000001', beneficiarioNombre: 'Tomás', tipo: 'KIT_ESCOLAR', fechaRadicacion: '2027-01-15T19:01:00Z' },
        { id: 's2', radicado: 'SUB-2027-000002', beneficiarioNombre: 'Lina', tipo: 'KIT_ESCOLAR', fechaRadicacion: '2027-01-15T19:03:00Z' },
      ],
    });
    tomarSolicitud.mockResolvedValue({ data: { id: 's1', estado: 'EN_REVISION' } });

    render(
      <MemoryRouter initialEntries={['/analista/bandeja']}>
        <Routes>
          <Route path="/analista/bandeja" element={<Bandeja />} />
          <Route path="/analista/solicitud/:id" element={<p>revisión</p>} />
        </Routes>
        <Ubicacion />
      </MemoryRouter>,
    );

    const filas = await screen.findAllByRole('row');
    expect(solicitudesPorEstado).toHaveBeenCalledWith({ estado: 'RADICADA' }, { sortDirection: 'ASC' });
    expect(within(filas[1]).getByText('SUB-2027-000001')).toBeTruthy();
    expect(within(filas[2]).getByText('SUB-2027-000002')).toBeTruthy();

    await userEvent.click(within(filas[1]).getByRole('button', { name: 'Tomar' }));
    expect(tomarSolicitud).toHaveBeenCalledWith({ id: 's1' });
    expect(screen.getByTestId('ruta').textContent).toBe('/analista/solicitud/s1');
  });

  it('si otro analista la tomó primero, muestra el aviso y no navega', async () => {
    solicitudesPorEstado.mockResolvedValue({
      data: [{ id: 's1', radicado: 'SUB-2027-000001', beneficiarioNombre: 'Tomás', tipo: 'KIT_ESCOLAR', fechaRadicacion: '2027-01-15T19:01:00Z' }],
    });
    tomarSolicitud.mockResolvedValue({ data: null, errors: [{ message: 'Ya fue tomada por otro analista' }] });

    render(
      <MemoryRouter initialEntries={['/analista/bandeja']}>
        <Routes>
          <Route path="/analista/bandeja" element={<Bandeja />} />
        </Routes>
        <Ubicacion />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Tomar' }));
    expect(await screen.findByText('Ya fue tomada por otro analista')).toBeTruthy();
    expect(screen.getByTestId('ruta').textContent).toBe('/analista/bandeja');
  });
});
