import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Flex, Heading, Loader, Text, TextField } from '@aws-amplify/ui-react';
import { QRCodeSVG } from 'qrcode.react';
import { setUpTOTP, updateMFAPreference, verifyTOTPSetup } from 'aws-amplify/auth';
import { esCodigoTotp } from './totp';

/**
 * ADR-7 / FR-9: un funcionario sin TOTP entra SIN grupos (lo decide el trigger preTokenGeneration).
 * Aquí lo configura; al volver a iniciar sesión el nuevo token ya trae sus grupos.
 */
export function ConfigurarTotp({ correo, signOut }: { correo: string; signOut?: () => void }) {
  const [uri, setUri] = useState<string>();
  const [secreto, setSecreto] = useState<string>();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string>();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setUpTOTP()
      .then((detalle) => {
        setSecreto(detalle.sharedSecret);
        setUri(detalle.getSetupUri('Portal de subsidios', correo).toString());
      })
      .catch((e: Error) => setError(e.message));
  }, [correo]);

  async function verificar(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      await verifyTOTPSetup({ code: codigo });
      await updateMFAPreference({ totp: 'PREFERRED' });
      setListo(true);
    } catch {
      setError('El código no es válido o venció. Usa el código actual de tu app autenticadora.');
    }
  }

  if (listo) {
    return (
      <Flex direction="column" gap="1rem">
        <Alert variation="success">Verificación en dos pasos activada.</Alert>
        <Text>Cierra sesión y vuelve a entrar: desde ahora se te pedirá el código de tu app en cada ingreso.</Text>
        <Button variation="primary" onClick={signOut} width="fit-content">Cerrar sesión</Button>
      </Flex>
    );
  }

  return (
    <Flex as="form" direction="column" gap="1rem" onSubmit={verificar} maxWidth="28rem">
      <Heading level={3}>Configura la verificación en dos pasos</Heading>
      <Text>Como funcionario, necesitas un segundo factor para acceder. Escanea el código con Google Authenticator, Authy o 1Password.</Text>
      {!uri && !error && <Loader variation="linear" />}
      {uri && <QRCodeSVG value={uri} size={180} />}
      {secreto && <Text fontSize="small">¿No puedes escanear? Clave: <code>{secreto}</code></Text>}
      <TextField
        label="Código de 6 dígitos"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.trim())}
      />
      {error && <Alert variation="error">{error}</Alert>}
      <Button type="submit" variation="primary" isDisabled={!esCodigoTotp(codigo)}>Verificar</Button>
    </Flex>
  );
}
