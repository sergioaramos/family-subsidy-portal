import { defineStorage } from '@aws-amplify/backend';

/**
 * Bucket de soportes (ADR-10). SIN acceso desde el navegador: el cliente solo sube con una POST
 * prefirmada que emite la Lambda comandos, y solo lee con URLs temporales que ella firma.
 * Los permisos de la Lambda se otorgan en backend.ts (desde su lado, para evitar ciclos entre stacks).
 */
export const storage = defineStorage({
  name: 'soportes',
});
