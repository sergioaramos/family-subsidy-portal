import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Flex, Heading, Loader, Radio, RadioGroupField, Text } from '@aws-amplify/ui-react';
import { cliente, type BeneficiarioElegible } from '../datos/cliente';
import { TIPOS_PERMITIDOS, validarSoporteDeclarado } from '../../amplify/shared/dominio/soportes';
import { subirSoporteDirecto } from './subirSoporte';

const errorDe = (r: { errors?: { message: string }[] }) => r.errors?.[0]?.message;

/** FR-16 a FR-27: radicar un kit escolar. Tres pasos: pase firmado → subida directa a S3 → radicar. */
export function Radicar({ alRadicar }: { alRadicar: (radicado: string) => void }) {
  const [hijos, setHijos] = useState<BeneficiarioElegible[]>();
  const [beneficiario, setBeneficiario] = useState('');
  const [archivo, setArchivo] = useState<File>();
  const [paso, setPaso] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    cliente.queries.misBeneficiarios().then((r) => {
      if (r.errors) setError(errorDe(r));
      setHijos((r.data ?? []).filter((h): h is BeneficiarioElegible => Boolean(h)));
    });
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!archivo) return setError('Adjunta el certificado de estudio');

    // Aviso temprano en el navegador (experiencia de usuario). El servidor y S3 vuelven a validar.
    const v = validarSoporteDeclarado(archivo.type, archivo.size);
    if (!v.ok) return setError(v.mensaje);

    try {
      setPaso('Preparando la carga…');
      const carga = await cliente.mutations.solicitarCargaSoporte({
        nombreArchivo: archivo.name,
        tipoContenido: archivo.type,
        tamanoBytes: archivo.size,
      });
      if (!carga.data?.clave) throw new Error(errorDe(carga));

      setPaso('Subiendo el certificado…');
      await subirSoporteDirecto(carga.data, archivo);

      setPaso('Radicando…');
      const r = await cliente.mutations.radicarSolicitud({
        tipo: 'KIT_ESCOLAR',
        beneficiarioDocumento: beneficiario,
        soportes: [carga.data.clave],
      });
      if (!r.data) throw new Error(errorDe(r));
      alRadicar(r.data.radicado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible radicar');
    } finally {
      setPaso(undefined);
    }
  }

  if (!hijos && !error) return <Loader variation="linear" />;

  return (
    <Flex as="form" direction="column" gap="1rem" onSubmit={enviar}>
      <Heading level={3}>Radicar kit escolar</Heading>
      {hijos?.length === 0 && <Text>No tienes hijos registrados como beneficiarios.</Text>}

      <RadioGroupField legend="¿Para cuál de tus hijos?" name="beneficiario" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} isRequired>
        {hijos?.map((h) => (
          <Radio key={h.documento} value={h.documento} isDisabled={!h.elegibleKit}>
            {h.nombre} · {h.edad} años{!h.elegibleKit && ` · ${h.motivoKit}`}
          </Radio>
        ))}
      </RadioGroupField>

      <Flex direction="column" gap="0.25rem">
        <Text as="label" htmlFor="certificado" fontWeight="bold">Certificado de estudio (PDF, JPG o PNG, máximo 5 MB)</Text>
        <input id="certificado" type="file" accept={TIPOS_PERMITIDOS.join(',')} onChange={(e) => setArchivo(e.target.files?.[0])} />
      </Flex>

      {error && <Alert variation="error">{error}</Alert>}
      <Button type="submit" variation="primary" isLoading={Boolean(paso)} loadingText={paso} isDisabled={!beneficiario || !archivo}>
        Radicar
      </Button>
    </Flex>
  );
}
