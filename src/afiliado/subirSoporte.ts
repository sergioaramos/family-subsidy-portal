/**
 * Respuesta de solicitarCargaSoporte. `campos` es AWSJSON: el cliente lo recibe como texto JSON,
 * pero los tipos generados lo declaran como Json genérico; se aceptan ambas formas.
 */
export interface CargaFirmada {
  url?: string | null;
  campos?: unknown;
}

/**
 * Paso 2 de la carga: POST multipart DIRECTO a S3 con el pase firmado (ADR-10).
 * El archivo va al FINAL: S3 ignora los campos que vengan después del archivo.
 */
export async function subirSoporteDirecto(carga: CargaFirmada, archivo: File, fetchImpl: typeof fetch = fetch) {
  if (!carga.url || !carga.campos) throw new Error('No fue posible preparar la carga');
  const campos = (typeof carga.campos === 'string' ? JSON.parse(carga.campos) : carga.campos) as Record<string, string>;
  const form = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) {
    form.append(nombre, valor);
  }
  form.append('file', archivo);

  const r = await fetchImpl(carga.url, { method: 'POST', body: form });
  if (r.ok) return;
  const codigo = (await r.text()).match(/<Code>([^<]+)<\/Code>/)?.[1];
  if (codigo === 'EntityTooLarge') throw new Error('Supera 5 MB');
  if (r.status === 403) throw new Error('La carga no fue autorizada o venció; intenta de nuevo');
  throw new Error('No fue posible subir el archivo; intenta de nuevo');
}
