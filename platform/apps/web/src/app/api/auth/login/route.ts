import { NextResponse, type NextRequest } from 'next/server';
import { setSession } from '@/lib/bff';
import { API_URL, type TokenPair } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  const upstream = await fetch(`${API_URL}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!upstream.ok) {
    const error = await upstream.json().catch(() => ({ message: 'Não foi possível entrar' }));
    return NextResponse.json({ message: upstream.status === 401 ? 'E-mail ou senha incorretos' : error.message ?? 'Não foi possível entrar' }, { status: upstream.status });
  }
  const tokens = (await upstream.json()) as TokenPair;
  const me = await fetch(`${API_URL}/v1/auth/me`, { headers: { Authorization: `Bearer ${tokens.accessToken}` }, cache: 'no-store' });
  const res = NextResponse.json({ user: me.ok ? await me.json() : null });
  setSession(res, tokens);
  return res;
}
