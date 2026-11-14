import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Endereço da API e chave pública (anon) do servidor, definidos no build:
//   VITE_SUPABASE_URL=https://seu-dominio  VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
// Na VPS, o instalador (deploy/vps/install.sh) preenche os dois automaticamente.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no build.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
