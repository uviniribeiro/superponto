import { isValidCnpj, normalizeCnpj } from '@superponto/br-docs';
import { z } from 'zod';

/** CNPJ numérico ou alfanumérico (IN RFB 2.229/2024), com ou sem máscara; sai normalizado. */
export const cnpjSchema = z
  .string()
  .trim()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, 'CNPJ inválido: confira os 12 caracteres (letras ou números) e os 2 dígitos verificadores');
