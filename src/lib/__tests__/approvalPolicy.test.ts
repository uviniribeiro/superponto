import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { addApproval } from '../approvalPolicy';

describe('addApproval', () => {
  it('aprova de vez com 1 nível', () => {
    expect(addApproval([], 1, { id: 'a', name: 'Ana' }).final).toBe(true);
  });
  it('precisa de pessoas diferentes em cada nível', () => {
    const first = addApproval([], 2, { id: 'a', name: 'Ana' });
    expect(first.final).toBe(false);
    expect(addApproval(first.approvals, 2, { id: 'a', name: 'Ana' }).error).toBeTruthy();
    expect(addApproval(first.approvals, 2, { id: 'b', name: 'Bia' }).final).toBe(true);
  });
});
