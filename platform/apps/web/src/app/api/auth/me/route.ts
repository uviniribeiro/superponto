import type { NextRequest } from 'next/server';
import { forward } from '@/lib/bff';

export function GET(req: NextRequest) {
  return forward(req, 'v1/auth/me');
}
