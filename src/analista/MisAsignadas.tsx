import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert, Heading, Loader, Table, TableBody, TableCell, TableHead, TableRow, Text } from '@aws-amplify/ui-react';
import { cliente, type Solicitud } from '../datos/cliente';
import { fechaHoraBogota } from '../comun/formato';
import { RUTAS_ANALISTA } from './rutas';

/** Las que el analista tomó y siguen en revisión (índice analistaAsignado + fechaRadicacion). */
export function MisAsignadas({ sub }: { sub: string }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    cliente.models.Solicitud.solicitudesPorAnalista({ analistaAsignado: sub }, { sortDirection: 'ASC' }).then((r) => {
      if (r.errors) setError(r.errors[0].message);
      setSolicitudes(r.data.filter((s) => s.estado === 'EN_REVISION'));
    });
  }, [sub]);

  if (error) return <Alert variation="error">{error}</Alert>;
  if (!solicitudes) return <Loader variation="linear" />;

  return (
    <>
      <Heading level={3}>Mis asignadas</Heading>
      {solicitudes.length === 0 ? (
        <Text>No tienes solicitudes en revisión.</Text>
      ) : (
        <Table size="small" highlightOnHover>
          <TableHead>
            <TableRow>
              <TableCell as="th">Radicado</TableCell>
              <TableCell as="th">Beneficiario</TableCell>
              <TableCell as="th">Radicada</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitudes.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link to={RUTAS_ANALISTA.solicitud(s.id)}>{s.radicado}</Link>
                </TableCell>
                <TableCell>{s.beneficiarioNombre}</TableCell>
                <TableCell>{fechaHoraBogota(s.fechaRadicacion)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
