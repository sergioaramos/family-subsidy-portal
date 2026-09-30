import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  claveSoportePendiente,
  condicionesPostSoporte,
  validarSoporteDeclarado,
} from '../../shared/dominio/soportes';
import type { EventoAmplify } from '../../shared/tipos/evento-amplify';

const s3 = new S3Client();
const BUCKET = process.env.BUCKET_SOPORTES!;

interface ArgsCarga {
  nombreArchivo: string;
  tipoContenido: string;
  tamanoBytes: number;
}

/**
 * Router de comandos. La identidad viene del token que AppSync ya validó (event.identity),
 * nunca de los argumentos.
 */
export const handler = async (event: EventoAmplify): Promise<unknown> => {
  switch (event.fieldName) {
    case 'solicitarCargaSoporte':
      return solicitarCargaSoporte(event.identity.sub, event.arguments as unknown as ArgsCarga);
    default:
      throw new Error(`Comando no soportado: ${event.fieldName}`);
  }
};

/** FR-25/26, ADR-10: valida lo declarado y firma una POST que S3 hará cumplir (tamaño, tipo, clave). */
async function solicitarCargaSoporte(sub: string, args: ArgsCarga) {
  const v = validarSoporteDeclarado(args.tipoContenido, args.tamanoBytes);
  if (!v.ok) throw new Error(v.mensaje);

  const clave = claveSoportePendiente(sub, args.nombreArchivo, randomUUID());
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    ...condicionesPostSoporte(clave, args.tipoContenido),
  });
  // `campos` es AWSJSON: se devuelve el OBJETO; AppSync lo serializa (no hacer JSON.stringify aquí).
  return { url, campos: fields, clave };
}
