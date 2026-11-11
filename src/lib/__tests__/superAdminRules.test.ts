import { describe, expect, it } from 'vitest';
import {
  deactivationBlockReason,
  normalizeEmail,
  removalBlockReason,
  validateEmail,
  validateFullName,
  validatePassword,
} from '../../../supabase/functions/_shared/superAdminRules';

const admins = [
  { user_id: 'me', is_active: true },
  { user_id: 'other', is_active: true },
  { user_id: 'inactive', is_active: false },
];

describe('validações de cadastro', () => {
  it('normaliza e valida e-mail', () => {
    expect(normalizeEmail('  Admin@Empresa.COM ')).toBe('admin@empresa.com');
    expect(normalizeEmail(undefined)).toBe('');
    expect(validateEmail('admin@empresa.com')).toBeNull();
    expect(validateEmail('admin@')).not.toBeNull();
  });

  it('exige nome com pelo menos 3 caracteres', () => {
    expect(validateFullName('Ana Lima')).toBeNull();
    expect(validateFullName('  A ')).not.toBeNull();
    expect(validateFullName(42)).not.toBeNull();
  });

  it('exige senha forte com 12+ caracteres e 3 tipos', () => {
    expect(validatePassword('Curta@1')).toMatch(/12 caracteres/);
    expect(validatePassword('somenteminusculas')).toMatch(/3 tipos/);
    expect(validatePassword('Minusculas123')).toBeNull();
    expect(validatePassword('Senha-Forte#2026')).toBeNull();
  });
});

describe('removalBlockReason', () => {
  it('impede remover a própria permissão', () => {
    expect(removalBlockReason(admins, 'me', 'me')).toMatch(/própria/);
  });
  it('impede remover quem não é super admin', () => {
    expect(removalBlockReason(admins, 'me', 'ghost')).toMatch(/não é super admin/);
  });
  it('permite remover quando resta outro ativo', () => {
    expect(removalBlockReason(admins, 'me', 'other')).toBeNull();
  });
  it('impede remover o último super admin ativo', () => {
    const onlyOneActive = [
      { user_id: 'me', is_active: false },
      { user_id: 'other', is_active: true },
    ];
    expect(removalBlockReason(onlyOneActive, 'me', 'other')).toMatch(/pelo menos um/);
  });
});

describe('deactivationBlockReason', () => {
  it('impede desativar a si mesmo', () => {
    expect(deactivationBlockReason(admins, 'me', 'me')).toMatch(/própria conta/);
  });
  it('permite desativar outro quando resta um ativo', () => {
    expect(deactivationBlockReason(admins, 'me', 'other')).toBeNull();
  });
});
