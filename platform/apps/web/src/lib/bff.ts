import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, API_URL, cookieBase, REFRESH_COOKIE, type TokenPair } from './session';

export function setSession(res: NextResponse, tokens: TokenPair) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieBase, maxAge: tokens.expiresIn });
  if (tokens.refreshToken) res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...cookieBase, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...cookieBase, maxAge: 0 });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const res = await fetch(`${API_URL}/v1/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });
  return res.ok ? ((await res.json()) as TokenPair) : null;
}

/** Repassa a requisição à API com o Bearer do cookie; renova o token uma vez se expirou. */
export async function forward(req: NextRequest, path: string): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();
  const url = `${API_URL}/${path}${req.nextUrl.search}`;

  const call = (token?: string) =>
    fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': req.headers.get('content-type') ?? 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(req.headers.get('x-tenant-id') ? { 'X-Tenant-Id': req.headers.get('x-tenant-id')! } : {}),
        'X-Forwarded-For': req.headers.get('x-forwarded-for') ?? '',
        'User-Agent': req.headers.get('user-agent') ?? '',
      },
      body,
      cache: 'no-store',
    });

  let upstream = access ? await call(access) : null;
  let renewed: TokenPair | null = null;
  if ((!upstream || upstream.status === 401) && refresh) {
    renewed = await refreshTokens(refresh);
    if (renewed) upstream = await call(renewed.accessToken);
  }
  if (!upstream) return NextResponse.json({ message: 'Sessão expirada' }, { status: 401 });

  const text = await upstream.text();
  const res = new NextResponse(text || null, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
  if (renewed) setSession(res, renewed);
  if (upstream.status === 401) clearSession(res);
  return res;
}
