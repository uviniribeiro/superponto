import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { supabase } from '@/integrations/supabase/client';
import SuperAdminUsers from '../SuperAdminUsers';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me' } }),
}));

const admins = [
  { user_id: 'me', profile_id: 'p1', full_name: 'Titular', email: 'me@x.com', is_active: true, created_at: '2026-01-01' },
  { user_id: 'other', profile_id: 'p2', full_name: 'Outra Pessoa', email: 'o@x.com', is_active: true, created_at: '2026-02-01' },
];

describe('SuperAdminUsers', () => {
  beforeEach(() => {
    vi.mocked(supabase.functions.invoke).mockReset();
  });

  it('lista super admins e bloqueia remover a própria permissão', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { success: true, data: admins }, error: null } as never);
    render(<SuperAdminUsers />);

    await waitFor(() => expect(screen.getByText('Outra Pessoa')).toBeInTheDocument());
    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.getByLabelText('Remover permissão de Titular')).toBeDisabled();
    expect(screen.getByLabelText('Remover permissão de Outra Pessoa')).toBeEnabled();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('manage-super-admin', { body: { action: 'list' } });
  });
});
