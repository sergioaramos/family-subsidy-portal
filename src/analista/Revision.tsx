import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert, Badge, Button, Divider, Flex, Heading, Loader, SelectField, Text, TextAreaField } from '@aws-amplify/ui-react';
import { cliente, type Solicitud } from '../datos/cliente';
import { etiquetaEstado, fechaHoraBogota } from '../comun/formato';
import { MOTIVOS_RECHAZO, validarMotivoRechazo } from '../../amplify/shared/dominio/motivos';
import { RUTAS_ANALISTA } from './rutas';

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  return (
    <Text>
      <strong>{etiqueta}:</strong> {valor ?? '—'}
    </Text>
  );
}

/** FR-37 (datos), FR-38 (aprobar), FR-41 (rechazar con motivo). La autorización real la hace el servidor. */
export function Revision() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const [s, setS] = useState<Solicitud | null>();
  const [motivo, setMotivo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState<string>();
  const [decidiendo, setDecidiendo] = useState(false);

  useEffect(() => {
    cliente.models.Solicitud.get({ id }).then((r) => {
      if (r.errors) setError(r.errors[0].message);
      setS(r.data);
    });
  }, [id]);

  async function decidir(accion: 'aprobar' | 'rechazar') {
    setError(undefined);
    if (accion === 'rechazar') {
      const invalido = validarMotivoRechazo(motivo, observacion); // aviso temprano; el servidor valida igual
      if (invalido) return setError(invalido);
    }
    setDecidiendo(true);
    const r =
      accion === 'aprobar'
        ? await cliente.mutations.aprobarSolicitud({ id })
        : await cliente.mutations.rechazarSolicitud({ id, motivo, observacion });
    setDecidiendo(false);
    if (r.errors?.length) return setError(r.errors[0].message);
    navegar(RUTAS_ANALISTA.asignadas);
  }

  if (s === undefined && !error) return <Loader variation="linear" />;
  if (!s) return <Alert variation="error">{error ?? 'Solicitud no encontrada'}</Alert>;

  const enRevision = s.estado === 'EN_REVISION';
  return (
    <Flex direction="column" gap="0.75rem">
      <Heading level={3}>
        {s.radicado} <Badge>{etiquetaEstado(s.estado ?? '')}</Badge>
      </Heading>
      <Dato etiqueta="Afiliado" valor={`${s.afiliadoNombre} (${s.afiliadoDocumento}) · categoría ${s.categoria}`} />
      <Dato etiqueta="Beneficiario" valor={`${s.beneficiarioNombre} (${s.beneficiarioDocumento}) · nació ${s.beneficiarioFechaNacimiento}`} />
      <Dato etiqueta="Tipo" valor={s.tipo === 'KIT_ESCOLAR' ? 'Kit escolar' : 'Computador'} />
      <Dato etiqueta="Radicada" valor={fechaHoraBogota(s.fechaRadicacion)} />
      <Dato etiqueta="Soportes" valor={`${s.soportes.length} archivo(s) · la vista del documento llega en T64`} />
      <Divider />

      {error && <Alert variation="error">{error}</Alert>}
      {enRevision ? (
        <Flex direction="column" gap="0.75rem" maxWidth="32rem">
          <Button variation="primary" onClick={() => decidir('aprobar')} isLoading={decidiendo} width="fit-content">
            Aprobar
          </Button>
          <SelectField label="Motivo de rechazo" placeholder="Elige un motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS_RECHAZO.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </SelectField>
          <TextAreaField label="Observación" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          <Button variation="warning" onClick={() => decidir('rechazar')} isDisabled={!motivo || decidiendo} width="fit-content">
            Rechazar
          </Button>
        </Flex>
      ) : (
        <Text>Esta solicitud ya no está en revisión.</Text>
      )}
    </Flex>
  );
}
