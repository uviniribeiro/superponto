import { describe, it, expect } from 'vitest';
import { 
  generateTransactionHash, 
  generateTimeRecordHash, 
  isValidHashFormat,
  parseTransactionHash 
} from '../transactionHash';

describe('Transaction Hash', () => {
  it('should generate a hash string', async () => {
    const data = {
      type: 'TIME_RECORD' as const,
      profileId: '123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: { recordType: 'entrada' },
    };
    
    const hash = await generateTransactionHash(data);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should generate hash in correct format', async () => {
    const data = {
      type: 'TIME_RECORD' as const,
      profileId: '123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: { recordType: 'entrada' },
    };
    
    const hash = await generateTransactionHash(data);
    expect(isValidHashFormat(hash)).toBe(true);
  });

  it('should generate different hash for different data due to random salt', async () => {
    const data1 = {
      type: 'TIME_RECORD' as const,
      profileId: '123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: { recordType: 'entrada' },
    };
    
    const data2 = {
      type: 'TIME_RECORD' as const,
      profileId: '456',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: { recordType: 'entrada' },
    };
    
    const hash1 = await generateTransactionHash(data1);
    const hash2 = await generateTransactionHash(data2);
    expect(hash1).not.toBe(hash2);
  });

  it('should generate time record hash', async () => {
    const hash = await generateTimeRecordHash(
      'profile-123',
      'entrada',
      new Date('2024-01-01T08:00:00Z'),
      -23.5505,
      -46.6333,
      12345
    );
    
    expect(isValidHashFormat(hash)).toBe(true);
    expect(hash.startsWith('TR-')).toBe(true);
  });
});

describe('Hash Format Validation', () => {
  it('should validate correct hash format', () => {
    expect(isValidHashFormat('TR-20240101120000-ABCDEF1234567890')).toBe(true);
    expect(isValidHashFormat('AR-20240315093045-1234567890ABCDEF')).toBe(true);
  });

  it('should reject invalid hash format', () => {
    expect(isValidHashFormat('invalid-hash')).toBe(false);
    expect(isValidHashFormat('TR-123-ABC')).toBe(false);
    expect(isValidHashFormat('')).toBe(false);
  });
});

describe('Parse Transaction Hash', () => {
  it('should parse valid hash correctly', () => {
    const result = parseTransactionHash('TR-20240101120000-ABCDEF1234567890');
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('TR');
    expect(result?.shortHash).toBe('ABCDEF1234567890');
    expect(result?.timestamp).toBeInstanceOf(Date);
  });

  it('should return null for invalid hash', () => {
    expect(parseTransactionHash('invalid')).toBeNull();
  });
});
