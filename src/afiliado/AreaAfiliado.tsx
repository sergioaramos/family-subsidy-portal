import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';
import { Flex } from '@aws-amplify/ui-react';
import { Radicar } from './Radicar';
import { MisSolicitudes } from './MisSolicitudes';

export function AreaAfiliado({ sub }: { sub: string }) {
  const navegar = useNavigate();
  const [ultimo, setUltimo] = useState<string>();

  return (
    <Flex direction="column" gap="1rem">
      <Flex as="nav" gap="1rem">
        <NavLink to="radicar">Radicar</NavLink>
        <NavLink to="solicitudes">Mis solicitudes</NavLink>
      </Flex>
      <Routes>
        <Route
          path="radicar"
          element={
            <Radicar
              alRadicar={(radicado) => {
                setUltimo(radicado);
                navegar('solicitudes');
              }}
            />
          }
        />
        <Route path="solicitudes" element={<MisSolicitudes sub={sub} destacado={ultimo} />} />
        <Route path="*" element={<Navigate to="solicitudes" replace />} />
      </Routes>
    </Flex>
  );
}
