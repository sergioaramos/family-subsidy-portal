import { NavLink, Navigate, Route, Routes } from 'react-router';
import { Flex } from '@aws-amplify/ui-react';
import { Bandeja } from './Bandeja';
import { MisAsignadas } from './MisAsignadas';
import { Revision } from './Revision';
import { RUTAS_ANALISTA } from './rutas';

export function AreaAnalista({ sub }: { sub: string }) {
  return (
    <Flex direction="column" gap="1rem">
      <Flex as="nav" gap="1rem">
        <NavLink to={RUTAS_ANALISTA.bandeja}>Bandeja</NavLink>
        <NavLink to={RUTAS_ANALISTA.asignadas}>Mis asignadas</NavLink>
      </Flex>
      <Routes>
        <Route path="bandeja" element={<Bandeja />} />
        <Route path="asignadas" element={<MisAsignadas sub={sub} />} />
        <Route path="solicitud/:id" element={<Revision />} />
        <Route path="*" element={<Navigate to={RUTAS_ANALISTA.bandeja} replace />} />
      </Routes>
    </Flex>
  );
}
