/**
 * Testes de integração da validação de CNPJ no backend.
 * Cobrem a edge function de consulta e a validação/auditoria no banco de dados.
 * São ignorados automaticamente quando as credenciais do ambiente não estão disponíveis.
 */
import { describe, it, expect } from 'vitest';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const hasEnv = Boolean(SUPABASE_URL && SUPABASE_KEY);

async function callLookup(cnpj: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cnpj-lookup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ cnpj }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe.skipIf(!hasEnv)('Backend - validação de CNPJ (integração)', () => {
  it('rejeita CNPJ com dígito verificador incorreto', async () => {
    const { status, body } = await callLookup('11444777000162');
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/dígito verificador/i);
  }, 20000);

  it('rejeita CNPJ com tamanho inválido', async () => {
    const { status, body } = await callLookup('1144477700016');
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/14 caracteres/i);
  }, 20000);

  it('aceita CNPJ alfanumérico válido mas informa que não é consultável', async () => {
    const { status, body } = await callLookup('12ABC34501DE35');
    expect(status).toBe(422);
    expect(String(body.error)).toMatch(/alfanumérico/i);
  }, 20000);

  it('não rejeita por formato um CNPJ numérico válido', async () => {
    const { status } = await callLookup('11.444.777/0001-61');
    expect(status).not.toBe(400);
    expect(status).not.toBe(422);
  }, 30000);
});
