import { describe, expect, it } from 'vitest';
import {
  clientIpFromHeaders,
  isIpAllowed,
  normalizeIp,
  parseAllowlist,
} from '../../../supabase/functions/_shared/ipAllowlist';

describe('ipAllowlist', () => {
  it('libera qualquer IP quando a lista está vazia', () => {
    expect(isIpAllowed('8.8.8.8', parseAllowlist(''))).toBe(true);
    expect(isIpAllowed(null, parseAllowlist(undefined))).toBe(true);
  });

  it('aceita IP exato e recusa os demais', () => {
    const list = parseAllowlist('203.0.113.10, 198.51.100.7');
    expect(isIpAllowed('203.0.113.10', list)).toBe(true);
    expect(isIpAllowed('198.51.100.7', list)).toBe(true);
    expect(isIpAllowed('203.0.113.11', list)).toBe(false);
    expect(isIpAllowed(null, list)).toBe(false);
  });

  it('aceita faixas CIDR IPv4', () => {
    const list = parseAllowlist('10.20.0.0/16');
    expect(isIpAllowed('10.20.255.1', list)).toBe(true);
    expect(isIpAllowed('10.21.0.1', list)).toBe(false);
    expect(isIpAllowed('1.2.3.4', parseAllowlist('0.0.0.0/0'))).toBe(true);
  });

  it('normaliza IPv4 mapeado em IPv6 e compara IPv6 exato', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
    expect(isIpAllowed('::ffff:203.0.113.10', ['203.0.113.10'])).toBe(true);
    expect(isIpAllowed('2001:DB8::1', ['2001:db8::1'])).toBe(true);
  });

  it('ignora entradas inválidas', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4/40', 'abc'])).toBe(false);
  });

  it('prefere o cabeçalho gravado pelo proxy da VPS', () => {
    const h = new Headers({ 'x-pontomax-client-ip': '203.0.113.10', 'x-forwarded-for': '6.6.6.6, 10.0.0.1' });
    expect(clientIpFromHeaders(h)).toBe('203.0.113.10');
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }))).toBe('6.6.6.6');
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });
});
