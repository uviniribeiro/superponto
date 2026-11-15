import { z } from 'zod';

export const fingerprintSchema = z.object({
  finger: z.number().int().min(0).max(9),
  format: z.enum(['ISO_19794_2', 'ANSI_378', 'CONTROLID', 'HENRY', 'OTHER']),
  /** template em base64; imagens de digital não são aceitas (limite de 16 KB) */
  template: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Template deve estar em base64').max(22_000),
  quality: z.number().int().min(0).max(100).optional(),
  capturedDeviceId: z.uuid().optional(),
});
export type FingerprintInput = z.infer<typeof fingerprintSchema>;

export const afdUploadSchema = z.object({
  /** conteúdo do arquivo AFD (texto); até ~20 MB */
  content: z.string().min(10).max(20_000_000),
});
export type AfdUpload = z.infer<typeof afdUploadSchema>;
