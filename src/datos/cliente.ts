import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

/**
 * Cliente TIPADO de la API: los tipos salen del esquema de amplify/data/resource.ts.
 * Si cambia el esquema, TypeScript avisa en el frontend.
 */
export const cliente = generateClient<Schema>();

export type Solicitud = Schema['Solicitud']['type'];
export type BeneficiarioElegible = Schema['BeneficiarioElegible']['type'];
