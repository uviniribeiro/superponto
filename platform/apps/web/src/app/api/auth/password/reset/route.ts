import type { NextRequest } from 'next/server';
import { forward } from '@/lib/bff';

export function POST(req: NextRequest) {
  return forward(req, 'v1/auth/password/reset');
}
