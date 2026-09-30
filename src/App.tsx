import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Alert, Button, Flex, Heading, Loader, Text } from '@aws-amplify/ui-react';
import { PantallaAcceso } from './auth/PantallaAcceso';
import { useSesion } from './comun/useSesion';
import { AreaAfiliado } from './afiliado/AreaAfiliado';
import { AreaAnalista } from './analista/AreaAnalista';

/** Rutas por rol (ADR-11). Solo ORGANIZAN la interfaz: cada operación la autoriza el servidor. */
function Portal({ signOut }: { signOut?: () => void }) {
  const sesion = useSesion();
  if (!sesion) return <Loader variation="linear" />;

  const esAfiliado = sesion.grupos.includes('AFILIADO');
  const esFuncionario = sesion.grupos.some((g) => g === 'ANALISTA' || g === 'COORDINADOR');
  const inicio = esAfiliado ? '/afiliado' : esFuncionario ? '/analista' : '/sin-rol';

  return (
    <Flex direction="column" gap="1rem" padding="1.5rem" maxWidth="60rem" margin="0 auto">
      <Flex justifyContent="space-between" alignItems="center" wrap="wrap">
        <Heading level={2}>Portal de subsidios</Heading>
        <Flex alignItems="center" gap="1rem">
          <Text fontSize="small">{sesion.correo}</Text>
          <Button size="small" onClick={signOut}>Cerrar sesión</Button>
        </Flex>
      </Flex>
      {sesion.requiereMfa && <Alert variation="warning">Debes configurar la verificación en dos pasos (TOTP).</Alert>}
      <Routes>
        {esAfiliado && <Route path="/afiliado/*" element={<AreaAfiliado sub={sesion.sub} />} />}
        {esFuncionario && <Route path="/analista/*" element={<AreaAnalista />} />}
        <Route path="/sin-rol" element={<Text>Tu cuenta no tiene un rol asignado.</Text>} />
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Routes>
    </Flex>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PantallaAcceso>{({ signOut }) => <Portal signOut={signOut} />}</PantallaAcceso>
    </BrowserRouter>
  );
}
