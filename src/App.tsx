import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Button, Flex, Heading, Text } from '@aws-amplify/ui-react';
import { PantallaAcceso } from './auth/PantallaAcceso';

/** Pantalla temporal de F1: confirma quién entró y con qué grupos. Las áreas por rol llegan en T30–T35. */
function Inicio({ signOut }: { signOut?: () => void }) {
  const [sesion, setSesion] = useState<{ correo?: string; grupos: string[]; requiereMfa: boolean }>();

  useEffect(() => {
    fetchAuthSession().then(({ tokens }) => {
      const id = tokens?.idToken?.payload;
      setSesion({
        correo: id?.email as string | undefined,
        grupos: (tokens?.accessToken.payload['cognito:groups'] as string[] | undefined) ?? [],
        requiereMfa: id?.requiere_mfa === 'true',
      });
    });
  }, []);

  return (
    <Flex direction="column" gap="1rem" padding="2rem" maxWidth="40rem" margin="0 auto">
      <Heading level={2}>Portal de subsidios</Heading>
      <Text>Sesión iniciada como <strong>{sesion?.correo ?? '…'}</strong></Text>
      <Text>Grupos: {sesion?.grupos.length ? sesion.grupos.join(', ') : 'ninguno'}</Text>
      {sesion?.requiereMfa && <Text color="red">Debes configurar la verificación en dos pasos (TOTP).</Text>}
      <Button onClick={signOut} width="fit-content">Cerrar sesión</Button>
    </Flex>
  );
}

export default function App() {
  return <PantallaAcceso>{({ signOut }) => <Inicio signOut={signOut} />}</PantallaAcceso>;
}
