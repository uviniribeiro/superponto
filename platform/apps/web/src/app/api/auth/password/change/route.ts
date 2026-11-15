import type { NextRequest } from 'next/server';
import { forward } from '@/lib/bff';

/** Troca de senha do usuário logado (a ponte genérica /api/v1 não repassa rotas de autenticação). */
export function POST(req: NextRequest) {
  return forward(req, 'v1/auth/password/change');
}
