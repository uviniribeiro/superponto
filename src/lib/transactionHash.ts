/**
 * Transaction Hash Generator
 * Generates unique cryptographic hashes for all system transactions
 * to ensure data integrity and audit trail security.
 */

/**
 * Generates a SHA-256 hash from input data
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Transaction types supported by the hash system
 */
export type TransactionType = 
  | 'TIME_RECORD'
  | 'ADJUSTMENT_REQUEST'
  | 'AUDIT_LOG'
  | 'EMPLOYEE_ABSENCE'
  | 'TIMESHEET_LOCK'
  | 'CLASS_RECORD'
  | 'PAYROLL_EXPORT'
  | 'USER_ACTION'
  | 'EQUIPMENT_SYNC'
  | 'EMPLOYEE_TRANSFER';

/**
 * Interface for transaction data
 */
interface TransactionData {
  type: TransactionType;
  userId?: string;
  profileId?: string;
  companyId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
  previousHash?: string; // For blockchain-like chaining
}

/**
 * Generates a unique transaction hash
 * Format: PREFIX-TIMESTAMP-HASH
 * 
 * @param transaction - The transaction data to hash
 * @returns A unique hash string in the format: TYPE-YYYYMMDDHHMMSS-HASH
 */
export async function generateTransactionHash(transaction: TransactionData): Promise<string> {
  const timestamp = transaction.timestamp.toISOString();
  
  // Create a deterministic string from transaction data
  const dataString = JSON.stringify({
    type: transaction.type,
    userId: transaction.userId || '',
    profileId: transaction.profileId || '',
    companyId: transaction.companyId || '',
    timestamp,
    data: transaction.data,
    previousHash: transaction.previousHash || '',
    salt: crypto.getRandomValues(new Uint8Array(16)).join('')
  });
  
  // Generate SHA-256 hash
  const hash = await sha256(dataString);
  
  // Format timestamp for prefix
  const datePrefix = timestamp
    .replace(/[-:T]/g, '')
    .substring(0, 14);
  
  // Return formatted hash: TYPE-TIMESTAMP-HASH(first 16 chars)
  const prefix = getTypePrefix(transaction.type);
  return `${prefix}-${datePrefix}-${hash.substring(0, 16).toUpperCase()}`;
}

/**
 * Gets a short prefix for the transaction type
 */
function getTypePrefix(type: TransactionType): string {
  const prefixes: Record<TransactionType, string> = {
    TIME_RECORD: 'TR',
    ADJUSTMENT_REQUEST: 'AR',
    AUDIT_LOG: 'AL',
    EMPLOYEE_ABSENCE: 'EA',
    TIMESHEET_LOCK: 'TL',
    CLASS_RECORD: 'CR',
    PAYROLL_EXPORT: 'PE',
    USER_ACTION: 'UA',
    EQUIPMENT_SYNC: 'ES',
    EMPLOYEE_TRANSFER: 'ET'
  };
  return prefixes[type];
}

/**
 * Generates a hash specifically for time records
 */
export async function generateTimeRecordHash(
  profileId: string,
  recordType: string,
  recordedAt: Date,
  latitude?: number,
  longitude?: number,
  nsr?: number
): Promise<string> {
  return generateTransactionHash({
    type: 'TIME_RECORD',
    profileId,
    timestamp: new Date(),
    data: {
      recordType,
      recordedAt: recordedAt.toISOString(),
      latitude,
      longitude,
      nsr
    }
  });
}

/**
 * Generates a hash for adjustment requests
 */
export async function generateAdjustmentHash(
  profileId: string,
  requestType: string,
  reason: string,
  originalTime?: string,
  requestedTime?: string
): Promise<string> {
  return generateTransactionHash({
    type: 'ADJUSTMENT_REQUEST',
    profileId,
    timestamp: new Date(),
    data: {
      requestType,
      reason,
      originalTime,
      requestedTime
    }
  });
}

/**
 * Generates a hash for audit log entries
 */
export async function generateAuditLogHash(
  userId: string,
  action: string,
  tableName: string,
  recordId?: string,
  oldData?: unknown,
  newData?: unknown
): Promise<string> {
  return generateTransactionHash({
    type: 'AUDIT_LOG',
    userId,
    timestamp: new Date(),
    data: {
      action,
      tableName,
      recordId,
      oldData,
      newData
    }
  });
}

/**
 * Generates a hash for employee absences
 */
export async function generateAbsenceHash(
  profileId: string,
  absenceType: string,
  startDate: string,
  endDate: string,
  totalDays: number
): Promise<string> {
  return generateTransactionHash({
    type: 'EMPLOYEE_ABSENCE',
    profileId,
    timestamp: new Date(),
    data: {
      absenceType,
      startDate,
      endDate,
      totalDays
    }
  });
}

/**
 * Generates a hash for timesheet locks
 */
export async function generateTimesheetLockHash(
  profileId: string,
  month: number,
  year: number,
  isLocked: boolean,
  lockedBy?: string
): Promise<string> {
  return generateTransactionHash({
    type: 'TIMESHEET_LOCK',
    profileId,
    timestamp: new Date(),
    data: {
      month,
      year,
      isLocked,
      lockedBy
    }
  });
}

/**
 * Generates a hash for payroll exports
 */
export async function generatePayrollExportHash(
  createdBy: string,
  exportType: string,
  periodStart: string,
  periodEnd: string,
  employeeCount?: number
): Promise<string> {
  return generateTransactionHash({
    type: 'PAYROLL_EXPORT',
    userId: createdBy,
    timestamp: new Date(),
    data: {
      exportType,
      periodStart,
      periodEnd,
      employeeCount
    }
  });
}

/**
 * Validates if a hash follows the correct format
 */
export function isValidHashFormat(hash: string): boolean {
  // Format: XX-YYYYMMDDHHMMSS-XXXXXXXXXXXXXXXX
  const hashPattern = /^[A-Z]{2}-\d{14}-[A-F0-9]{16}$/;
  return hashPattern.test(hash);
}

/**
 * Extracts metadata from a transaction hash
 */
export function parseTransactionHash(hash: string): {
  type: string;
  timestamp: Date;
  shortHash: string;
} | null {
  if (!isValidHashFormat(hash)) {
    return null;
  }
  
  const parts = hash.split('-');
  const typePrefix = parts[0];
  const dateString = parts[1];
  const shortHash = parts[2];
  
  // Parse timestamp
  const year = parseInt(dateString.substring(0, 4));
  const month = parseInt(dateString.substring(4, 6)) - 1;
  const day = parseInt(dateString.substring(6, 8));
  const hour = parseInt(dateString.substring(8, 10));
  const minute = parseInt(dateString.substring(10, 12));
  const second = parseInt(dateString.substring(12, 14));
  
  return {
    type: typePrefix,
    timestamp: new Date(year, month, day, hour, minute, second),
    shortHash
  };
}
