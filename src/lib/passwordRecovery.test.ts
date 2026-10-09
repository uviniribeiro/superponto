import { describe, expect, it, vi } from 'vitest';
import { finishPasswordRecovery, requestPasswordRecovery } from './passwordRecovery';

describe('secure password recovery', () => {
  it('sends recovery to the public same-origin reset page', async () => {
    const auth = { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }), updateUser: vi.fn() };
    await requestPasswordRecovery(auth, ' person@example.com ', 'https://app.example.com');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.com', { redirectTo: 'https://app.example.com/reset-password' });
  });
  it('changes only password, never email, company or permissions', async () => {
    const auth = { resetPasswordForEmail: vi.fn(), updateUser: vi.fn().mockResolvedValue({ error: null }) };
    await finishPasswordRecovery(auth, 'test-password-123', 'test-password-123');
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'test-password-123' });
    expect(Object.keys(auth.updateUser.mock.calls[0][0])).toEqual(['password']);
  });
  it('rejects mismatching confirmation before any update', async () => {
    const auth = { resetPasswordForEmail: vi.fn(), updateUser: vi.fn() };
    await expect(finishPasswordRecovery(auth, 'test-password-123', 'different')).rejects.toThrow();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});