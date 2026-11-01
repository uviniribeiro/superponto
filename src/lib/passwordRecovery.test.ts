import { describe, expect, it, vi } from 'vitest';
import { finishPasswordRecovery, requestPasswordRecovery, validatePasswordRecovery } from './passwordRecovery';

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

describe('recovery link validation', () => {
  const session = { access_token: 'test-token', user: { id: 'test-user' } };
  const makeAuth = () => ({
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: session.user }, error: null }),
  });
  it('exchanges a PKCE code before server validation', async () => {
    const auth = makeAuth();
    expect(await validatePasswordRecovery(auth, 'https://app.example/reset-password?code=test-code', () => false)).toBe('ready');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(auth.getUser).toHaveBeenCalledOnce();
  });
  it('accepts a server-validated recovery hash in a new tab without storage', async () => {
    expect(await validatePasswordRecovery(makeAuth(), 'https://app.example/reset-password#type=recovery&access_token=test-token', () => false)).toBe('ready');
  });
  it('does not accept an ordinary signed-in session without recovery proof', async () => {
    expect(await validatePasswordRecovery(makeAuth(), 'https://app.example/reset-password', () => false)).toBe('invalid');
  });
  it('rejects a fake recovery hash', async () => {
    expect(await validatePasswordRecovery(makeAuth(), 'https://app.example/reset-password#type=recovery&access_token=forged', () => false)).toBe('invalid');
  });
  it('waits for automatic processing and does not exchange an already consumed code', async () => {
    const auth = makeAuth();
    let event = false;
    auth.getSession.mockImplementation(async () => { event = true; return { data: { session }, error: null }; });
    expect(await validatePasswordRecovery(auth, 'https://app.example/reset-password?code=test-code', () => event)).toBe('ready');
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('rejects an expired PKCE code', async () => {
    const auth = makeAuth();
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: 'expired' } });
    expect(await validatePasswordRecovery(auth, 'https://app.example/reset-password?code=expired', () => false)).toBe('invalid');
  });
  it('distinguishes server unavailability from an expired link', async () => {
    const auth = makeAuth();
    auth.getUser.mockRejectedValue(new Error('Failed to fetch'));
    expect(await validatePasswordRecovery(auth, 'https://app.example/reset-password#type=recovery&access_token=test-token', () => false)).toBe('unavailable');
  });
});