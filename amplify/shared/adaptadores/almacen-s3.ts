import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AlmacenSoportes } from '../casos-uso/radicar-solicitud';

/** Almacén de soportes sobre S3. S3 no tiene "mover": se copia y luego se borra el original. */
export class AlmacenS3 implements AlmacenSoportes {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async existe(clave: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: clave })); // pregunta, no descarga
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'NotFound') return false;
      throw e;
    }
  }

  async mover(origen: string, destino: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({ Bucket: this.bucket, CopySource: `${this.bucket}/${encodeURI(origen)}`, Key: destino }),
    );
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: origen }));
  }
}
