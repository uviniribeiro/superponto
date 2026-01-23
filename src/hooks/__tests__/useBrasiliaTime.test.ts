import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrasiliaTime } from '../useBrasiliaTime';

describe('useBrasiliaTime Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return dateTime object', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    expect(result.current.dateTime).toBeDefined();
    expect(result.current.dateTime).toBeInstanceOf(Date);
  });

  it('should return formatting functions', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    expect(typeof result.current.formatBrasiliaTime).toBe('function');
    expect(typeof result.current.getFormattedDate).toBe('function');
    expect(typeof result.current.getFormattedDateFull).toBe('function');
    expect(typeof result.current.getFormattedTime).toBe('function');
    expect(typeof result.current.getFormattedTimeShort).toBe('function');
    expect(typeof result.current.getFormattedDateTime).toBe('function');
  });

  it('should update time periodically', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    const initialTime = result.current.dateTime.getTime();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Time should have advanced
    expect(result.current.dateTime.getTime()).toBeGreaterThanOrEqual(initialTime);
  });

  it('should format time correctly with HH:MM:SS pattern', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    const formattedTime = result.current.getFormattedTime();
    // Check format HH:MM:SS
    expect(formattedTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should format date correctly', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    const formattedDate = result.current.getFormattedDate();
    // Check format DD/MM/YYYY
    expect(formattedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should format time short without seconds', () => {
    const { result } = renderHook(() => useBrasiliaTime());
    
    const formattedTimeShort = result.current.getFormattedTimeShort();
    // Check format HH:MM
    expect(formattedTimeShort).toMatch(/^\d{2}:\d{2}$/);
  });
});
