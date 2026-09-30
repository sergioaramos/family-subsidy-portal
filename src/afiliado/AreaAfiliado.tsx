import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';
import { Flex } from '@aws-amplify/ui-react';
import { Radicar } from './Radicar';

// Rutas ABSOLUTAS: en react-router v7, una ruta relativa dentro de una ruta con comodín (/afiliado/*)
// se resuelve contra la URL completa; "solicitudes" desde /afiliado/solicitudes/x crecería sin fin.
const RUTAS = { radicar: '/afiliado/radicar', solicitudes: '/afiliado/solicitudes' } as const;
import { MisSolicitudes } from './MisSolicitudes';

export function AreaAfiliado({ sub }: { sub: string }) {
  const navegar = useNavigate();
  const [ultimo, setUltimo] = useState<string>();

  return (
    <Flex direction="column" gap="1rem">
      <Flex as="nav" gap="1rem">
        <NavLink to={RUTAS.radicar}>Radicar</NavLink>
        <NavLink to={RUTAS.solicitudes}>Mis solicitudes</NavLink>
      </Flex>
      <Routes>
        <Route
          path="radicar"
          element={
            <Radicar
              alRadicar={(radicado) => {
                setUltimo(radicado);
                navegar(RUTAS.solicitudes);
              }}
            />
          }
        />
        <Route path="solicitudes" element={<MisSolicitudes sub={sub} destacado={ultimo} />} />
        <Route path="*" element={<Navigate to={RUTAS.solicitudes} replace />} />
      </Routes>
    </Flex>
  );
}
