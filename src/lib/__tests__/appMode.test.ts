import { describe, expect, it } from 'vitest';
import { homePathFor, resolveAppMode, startPathFor } from '../appMode';

describe('appMode', () => {
  it('reconhece os modos de empacotamento e usa web como padrão', () => {
    expect(resolveAppMode('terminal')).toBe('terminal');
    expect(resolveAppMode('funcionario')).toBe('funcionario');
    expect(resolveAppMode(undefined)).toBe('web');
    expect(resolveAppMode('qualquer')).toBe('web');
  });

  it('abre cada app na tela certa', () => {
    expect(startPathFor('terminal')).toBe('/terminal');
    expect(startPathFor('funcionario')).toBe('/time-clock');
    expect(startPathFor('web')).toBe('/home');
  });

  it('leva o funcionário ao registro de ponto após o login', () => {
    expect(homePathFor('funcionario')).toBe('/time-clock');
    expect(homePathFor('web')).toBe('/dashboard');
    expect(homePathFor('terminal')).toBe('/dashboard');
  });
});
