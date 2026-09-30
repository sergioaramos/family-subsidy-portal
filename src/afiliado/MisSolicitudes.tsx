import { useEffect, useState } from 'react';
import { Alert, Badge, Heading, Loader, Table, TableBody, TableCell, TableHead, TableRow, Text } from '@aws-amplify/ui-react';
import { cliente, type Solicitud } from '../datos/cliente';
import { etiquetaEstado, fechaHoraBogota } from '../comun/formato';

const VARIACION: Record<string, 'info' | 'warning' | 'success' | 'error' | undefined> = {
  RADICADA: 'info',
  EN_REVISION: 'info',
  DEVUELTA: 'warning',
  PREAPROBADA: 'info',
  APROBADA: 'success',
  RECHAZADA: 'error',
};

/** FR-28: sus solicitudes, de la más reciente a la más antigua. AppSync solo le devuelve las suyas (owner). */
export function MisSolicitudes({ sub, destacado }: { sub: string; destacado?: string }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    cliente.models.Solicitud.solicitudesPorAfiliado({ owner: sub }, { sortDirection: 'DESC' }).then((r) => {
      if (r.errors) setError(r.errors[0].message);
      setSolicitudes(r.data);
    });
  }, [sub]);

  if (error) return <Alert variation="error">{error}</Alert>;
  if (!solicitudes) return <Loader variation="linear" />;

  return (
    <>
      <Heading level={3}>Mis solicitudes</Heading>
      {destacado && <Alert variation="success">Solicitud radicada: {destacado}</Alert>}
      {solicitudes.length === 0 ? (
        <Text>Aún no tienes solicitudes.</Text>
      ) : (
        <Table highlightOnHover size="small">
          <TableHead>
            <TableRow>
              <TableCell as="th">Radicado</TableCell>
              <TableCell as="th">Beneficiario</TableCell>
              <TableCell as="th">Tipo</TableCell>
              <TableCell as="th">Radicada</TableCell>
              <TableCell as="th">Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitudes.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.radicado}</TableCell>
                <TableCell>{s.beneficiarioNombre}</TableCell>
                <TableCell>{s.tipo === 'KIT_ESCOLAR' ? 'Kit escolar' : 'Computador'}</TableCell>
                <TableCell>{fechaHoraBogota(s.fechaRadicacion)}</TableCell>
                <TableCell>
                  <Badge variation={VARIACION[s.estado ?? '']}>{etiquetaEstado(s.estado ?? '')}</Badge>
                  {s.motivoRechazo && <Text fontSize="small">{s.motivoRechazo}</Text>}
                  {s.indicacionCorreccion && <Text fontSize="small">{s.indicacionCorreccion}</Text>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
