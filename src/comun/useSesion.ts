import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface Sesion {
  sub: string;
  correo: string;
  grupos: string[];
  requiereMfa: boolean;
}

/** Datos de la sesión leídos del token (solo para organizar la interfaz; la seguridad está en el servidor). */
export function useSesion(): Sesion | undefined {
  const [sesion, setSesion] = useState<Sesion>();
  useEffect(() => {
    fetchAuthSession().then(({ tokens }) => {
      const id = tokens?.idToken?.payload;
      setSesion({
        sub: tokens?.accessToken.payload.sub as string,
        correo: (id?.email as string) ?? '',
        grupos: (tokens?.accessToken.payload['cognito:groups'] as string[] | undefined) ?? [],
        requiereMfa: id?.requiere_mfa === 'true',
      });
    });
  }, []);
  return sesion;
}
