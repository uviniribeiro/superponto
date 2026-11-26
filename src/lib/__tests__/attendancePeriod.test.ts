import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { eachDay, fmtMin, fmtDate } from '../attendancePeriod';

describe('attendancePeriod', () => {
  it('lista os dias do período, inclusive na virada de mês', () => {
    expect(eachDay('2026-01-30', '2026-02-02')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    expect(eachDay('2026-03-05', '2026-03-05')).toEqual(['2026-03-05']);
  });
  it('formata minutos e datas', () => {
    expect(fmtMin(125)).toBe('02:05');
    expect(fmtMin(-30)).toBe('-00:30');
    expect(fmtDate('2026-11-26')).toBe('26/11/2026');
  });
});
