import type { ReactNode } from 'react';
import { Authenticator, CheckboxField, useAuthenticator } from '@aws-amplify/ui-react';
import { signUp, type SignUpInput } from 'aws-amplify/auth';
import type { AuthUser } from 'aws-amplify/auth';
import { MENSAJES_REGISTRO } from '../../amplify/shared/dominio/registro';
import { atributosDeRegistro, CAMPO_AUTORIZACION, limpiarMensajeCognito } from './registro';

/** Campos del registro: el documento va primero; lo valida preSignUp contra el core. */
const formFields = {
  signUp: {
    'custom:documento': {
      label: 'Número de documento',
      placeholder: 'Sin puntos ni espacios',
      isRequired: true,
      order: 1,
    },
    email: { label: 'Correo electrónico', order: 2 },
    password: { label: 'Contraseña', order: 3 },
    confirm_password: { label: 'Confirmar contraseña', order: 4 },
  },
};

const components = {
  SignUp: {
    FormFields() {
      const { validationErrors } = useAuthenticator();
      const error = validationErrors[CAMPO_AUTORIZACION] as string | undefined;
      return (
        <>
          <Authenticator.SignUp.FormFields />
          <CheckboxField
            name={CAMPO_AUTORIZACION}
            value="si"
            label="Autorizo el tratamiento de mis datos personales y los de mis beneficiarios (Ley 1581 de 2012)"
            hasError={Boolean(error)}
            errorMessage={error}
          />
        </>
      );
    },
  },
};

const services = {
  /** La casilla es obligatoria (FR-6). preSignUp lo vuelve a validar en el servidor. */
  async validateCustomSignUp(formData: Record<string, string>) {
    if (!formData[CAMPO_AUTORIZACION]) {
      return { [CAMPO_AUTORIZACION]: MENSAJES_REGISTRO.sinAutorizacion };
    }
  },
  // Amplify UI tipa este servicio como `typeof signUp`, que tiene dos sobrecargas; el Authenticator
  // solo usa la que recibe `input`. La aserción lo declara explícitamente.
  handleSignUp: (async (input: SignUpInput) => {
    try {
      return await signUp({
        ...input,
        options: {
          ...input.options,
          userAttributes: atributosDeRegistro(input.options?.userAttributes ?? {}),
        },
      });
    } catch (error) {
      throw new Error(limpiarMensajeCognito(error));
    }
  }) as typeof signUp,
};

interface Props {
  children: (sesion: { user?: AuthUser; signOut?: () => void }) => ReactNode;
}

export function PantallaAcceso({ children }: Props) {
  return (
    <Authenticator formFields={formFields} components={components} services={services}>
      {({ user, signOut }) => <>{children({ user, signOut })}</>}
    </Authenticator>
  );
}
