import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  claveSoportePendiente,
  condicionesPostSoporte,
  validarSoporteDeclarado,
} from '../../shared/dominio/soportes';
import { crearCore } from '../../shared/adaptadores/fabrica-core';
import { obtenerDocumento } from '../../shared/adaptadores/perfil-cognito';
import { AlmacenS3 } from '../../shared/adaptadores/almacen-s3';
import { radicarSolicitud, type EntradaRadicar } from '../../shared/casos-uso/radicar-solicitud';
import type { EventoAmplify } from '../../shared/tipos/evento-amplify';

// Clientes y dependencias FUERA del handler: se reutilizan mientras el contenedor esté caliente.
const s3 = new S3Client();
const db = DynamoDBDocumentClient.from(new DynamoDBClient(), { marshallOptions: { removeUndefinedValues: true } });
const core = crearCore();
const { BUCKET_SOPORTES, USER_POOL_ID, TABLA_CONTROL, TABLA_CONVOCATORIA, TABLA_SOLICITUD } = process.env as Record<string, string>;

interface ArgsCarga {
  nombreArchivo: string;
  tipoContenido: string;
  tamanoBytes: number;
}
type ArgsRadicar = Pick<EntradaRadicar, 'tipo' | 'beneficiarioDocumento' | 'soportes'>;

/**
 * Router de comandos. La identidad viene del token que AppSync ya validó (event.identity),
 * nunca de los argumentos.
 */
export const handler = async (event: EventoAmplify): Promise<unknown> => {
  switch (event.fieldName) {
    case 'solicitarCargaSoporte':
      return solicitarCargaSoporte(event.identity.sub, event.arguments as unknown as ArgsCarga);
    case 'radicarSolicitud': {
      const args = event.arguments as unknown as ArgsRadicar;
      const documentoAfiliado = await obtenerDocumento(USER_POOL_ID, event.identity.username);
      return radicarSolicitud(
        { sub: event.identity.sub, documentoAfiliado, ...args },
        {
          core,
          db,
          tablas: { control: TABLA_CONTROL, convocatoria: TABLA_CONVOCATORIA, solicitud: TABLA_SOLICITUD },
          almacen: new AlmacenS3(s3, BUCKET_SOPORTES),
          reloj: () => new Date(),
        },
      );
    }
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
    Bucket: BUCKET_SOPORTES,
    ...condicionesPostSoporte(clave, args.tipoContenido),
  });
  // `campos` es AWSJSON: se devuelve el OBJETO; AppSync lo serializa (no hacer JSON.stringify aquí).
  return { url, campos: fields, clave };
}
