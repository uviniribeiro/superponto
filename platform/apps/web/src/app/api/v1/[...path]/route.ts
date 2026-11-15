import type { NextRequest } from 'next/server';
import { forward } from '@/lib/bff';

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, { params }: Ctx) {
  const { path } = await params;
  // Só repassa caminhos de recurso (sem "..", sem rotas de autenticação, que têm handlers próprios).
  if (path.some((p) => p === '..' || p.includes('/')) || path[0] === 'auth') {
    return Response.json({ message: 'Caminho inválido' }, { status: 400 });
  }
  return forward(req, `v1/${path.map(encodeURIComponent).join('/')}`);
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
