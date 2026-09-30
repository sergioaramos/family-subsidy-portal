import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Heading, Loader, Table, TableBody, TableCell, TableHead, TableRow, Text } from '@aws-amplify/ui-react';
import { cliente, type Solicitud } from '../datos/cliente';
import { fechaHoraBogota } from '../comun/formato';
import { RUTAS_ANALISTA } from './rutas';

/** FR-32, FR-33: RADICADAS de la más antigua a la más nueva (índice estado + fechaRadicacion, ASC). */
export function Bandeja() {
  const navegar = useNavigate();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>();
  const [error, setError] = useState<string>();
  const [tomando, setTomando] = useState<string>();

  useEffect(() => {
    cliente.models.Solicitud.solicitudesPorEstado({ estado: 'RADICADA' }, { sortDirection: 'ASC' }).then((r) => {
      if (r.errors) setError(r.errors[0].message);
      setSolicitudes(r.data);
    });
  }, []);

  async function tomar(id: string) {
    setError(undefined);
    setTomando(id);
    const r = await cliente.mutations.tomarSolicitud({ id });
    setTomando(undefined);
    if (r.errors?.length) return setError(r.errors[0].message);
    navegar(RUTAS_ANALISTA.solicitud(id));
  }

  if (!solicitudes && !error) return <Loader variation="linear" />;

  return (
    <>
      <Heading level={3}>Bandeja</Heading>
      {error && <Alert variation="error">{error}</Alert>}
      {solicitudes?.length === 0 ? (
        <Text>No hay solicitudes pendientes.</Text>
      ) : (
        <Table size="small" highlightOnHover>
          <TableHead>
            <TableRow>
              <TableCell as="th">Radicado</TableCell>
              <TableCell as="th">Beneficiario</TableCell>
              <TableCell as="th">Tipo</TableCell>
              <TableCell as="th">Radicada</TableCell>
              <TableCell as="th" />
            </TableRow>
          </TableHead>
          <TableBody>
            {solicitudes?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.radicado}</TableCell>
                <TableCell>{s.beneficiarioNombre}</TableCell>
                <TableCell>{s.tipo === 'KIT_ESCOLAR' ? 'Kit escolar' : 'Computador'}</TableCell>
                <TableCell>{fechaHoraBogota(s.fechaRadicacion)}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => tomar(s.id)} isLoading={tomando === s.id}>
                    Tomar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
