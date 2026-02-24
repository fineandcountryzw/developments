/**
 * Excel Parser for LakeCity Ledger-Style Format
 * 
 * Handles the specific format from Fine & Country Zimbabwe legacy Excel files:
 * - Multiple sheets per workbook (each sheet = one development/tier)
 * - Ledger-style blocks: one stand = variable rows
 * - Two-sided accounting: LEFT = client payments, RIGHT = disbursements
 * - Agent codes in last non-null column of stand header row
 * 
 * Stand Block Structure:
 * ROW N:   [index] | "Stand number XXXX" | ... | [AGENT_CODE]
 * ROW N+1: [size?] | "Date" | "Description" | "Ref" | "Amount $" | "Date" | "Description" | "Ref" | "Amount $"
 * ROW N+2+: Transaction rows until SUM row
 */

import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StandType = 'STAND' | 'CLUSTER';

export interface ParsedTransaction {
  date: Date | null;
  description: string;
  reference: string | null;
  amount: number | null;
  type: 'DEPOSIT' | 'INSTALLMENT' | 'LEGAL_FEE' | 'AOS_FEE' | 'FC_ADMIN_FEE' | 'OTHER';
  side: 'LEFT' | 'RIGHT'; // LEFT = client payments, RIGHT = disbursements
}

export interface ParsedStand {
  sheetName: string;
  developer: string;
  development: string;
  standNumber: string;
  standType: StandType;
  sizeSqm: number | null;
  priceUsd: number | null;
  agentCode: string | null;
  transactions: ParsedTransaction[];
  rowIndex: number; // For error reporting
}

export interface ParseResult {
  stands: ParsedStand[];
  warnings: string[];
  skipped: number;
  summary: {
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    totalCollected: number;
    developers: Map<string, number>; // developer name -> stand count
    developments: Map<string, number>; // development name -> stand count
  };
}

export type FileFormat = 'FLAT_CSV' | 'FLAT_EXCEL' | 'LAKECITY_LEDGER' | 'UNKNOWN';

// ─────────────────────────────────────────────────────────────────────────────
// Sheet Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_CONFIG: Record<string, {
  developer: string;
  development: string;
  priceUsd: number | null;
}> = {
  'Kumvura estate': {
    developer: 'Kumvura Estate Developers',
    development: 'Kumvura Estate',
    priceUsd: null,
  },
  'Hirange KK': {
    developer: 'Highrange LC Developers', 
    development: 'Highrange',
    priceUsd: null,
  },
  '$9000': {
    developer: 'Lakecity Developers',
    development: 'Lakecity',
    priceUsd: 9000,
  },
  '$500 KK zero dep $12k': {
    developer: 'Lakecity Developers',
    development: 'Lakecity',
    priceUsd: 12000,
  },
  'Rockridge KCMPM': {
    developer: 'Southlands Developers',
    development: 'Rockridge',
    priceUsd: 18000,
  },
  '$12k CKTM': {
    developer: 'Lakecity Developers',
    development: 'Lakecity',
    priceUsd: 12000,
  },
  '$12k KK': {
    developer: 'Lakecity Developers',
    development: 'Lakecity',
    priceUsd: 12000,
  },
  'Cluster stands KK': {
    developer: 'Highrange LC Developers',
    development: 'Highrange Cluster',
    priceUsd: null,
  },
  'Lomlight': {
    developer: 'Lomlight Teddy M Developers',
    development: 'Lomlight',
    priceUsd: null,
  },
};

function normalizeSheetName(name: string): string {
  const normalized = name.trim();
  
  // Direct match
  if (SHEET_CONFIG[normalized]) return normalized;
  
  // Case-insensitive match
  const lowerName = normalized.toLowerCase();
  for (const key of Object.keys(SHEET_CONFIG)) {
    if (key.toLowerCase() === lowerName) return key;
  }
  
  // Fuzzy match for common variations
  if (lowerName.includes('kumvura')) return 'Kumvura estate';
  if (lowerName.includes('hirange') || lowerName.includes('highrange')) return 'Hirange KK';
  if (lowerName.includes('9000') && !lowerName.includes('12k')) return '$9000';
  if (lowerName.includes('rockridge')) return 'Rockridge KCMPM';
  if (lowerName.includes('lomlight')) return 'Lomlight';
  if (lowerName.includes('cluster')) return 'Cluster stands KK';
  if (lowerName.includes('12k') && lowerName.includes('cktm')) return '$12k CKTM';
  if (lowerName.includes('12k') && lowerName.includes('kk') && !lowerName.includes('cktm')) return '$12k KK';
  if (lowerName.includes('500') && lowerName.includes('12k')) return '$500 KK zero dep $12k';
  
  return normalized;
}

function getSheetConfig(sheetName: string): typeof SHEET_CONFIG[string] | null {
  const normalized = normalizeSheetName(sheetName);
  return SHEET_CONFIG[normalized] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  
  const str = String(val).trim();
  
  // DD.MM.YYYY format (common in Zimbabwe)
  const ddmmyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1]);
    const month = parseInt(ddmmyyyy[2]) - 1;
    const year = parseInt(ddmmyyyy[3]);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // DD/MM/YYYY format
  const ddmmSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmSlash) {
    const day = parseInt(ddmmSlash[1]);
    const month = parseInt(ddmmSlash[2]) - 1;
    const year = parseInt(ddmmSlash[3]);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Excel serial date (number)
  if (typeof val === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = val - 2; // Excel has a bug counting 1900 as leap year
    const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Try standard Date parsing
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function parseAmount(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val > 0 ? val : null;
  
  const str = String(val).trim();
  
  // Handle Excel formulas: =993+992 or =500+250+250
  if (str.startsWith('=')) {
    const nums = str.match(/\d+(?:\.\d+)?/g);
    if (nums) {
      return nums.reduce((sum, n) => sum + parseFloat(n), 0);
    }
    return null;
  }
  
  // Handle currency formatting: $1,234.56 or 1,234.56
  const cleaned = str.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

export function parseSizeSqm(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === 'number') return val;
  
  const str = String(val).trim();
  // Handle formats like "450m²", "450 m2", "450"
  const match = str.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    const n = parseFloat(match[1]);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function classifyTransaction(description: string): ParsedTransaction['type'] {
  const d = description.toLowerCase().trim();
  
  if (d.includes('deposit') || d.includes('dep.')) return 'DEPOSIT';
  if (d.includes('monthly installment') || d.includes('monthly installments')) return 'INSTALLMENT';
  if (d.includes('f&c administration') || d.includes('administration fee') || d.includes('f&c admin')) return 'FC_ADMIN_FEE';
  if (d.includes('legal fee') || d.includes('legal fees')) return 'LEGAL_FEE';
  if (d.includes('aos fee') || d.includes('aos fees') || d.includes('agreement of sale')) return 'AOS_FEE';
  
  return 'OTHER';
}

function extractAgentCode(row: unknown[]): string | null {
  // Find last non-null value in row
  for (let i = row.length - 1; i >= 0; i--) {
    const val = row[i];
    if (val !== null && val !== undefined && String(val).trim() !== '') {
      const str = String(val).trim();
      // Check if it's an agent code pattern
      if (/^(KCM|KK|PM|RJ|TM)$/i.test(str)) {
        return str.toUpperCase();
      }
    }
  }
  return null;
}

function isStandHeaderRow(row: unknown[]): { isHeader: boolean; standNumber: string | null; standType: StandType } {
  if (!row || row.length < 2) return { isHeader: false, standNumber: null, standType: 'STAND' };
  
  // Check column A (index 0) - should be a number or numeric string
  const colA = row[0];
  const isNumber = typeof colA === 'number' || /^\d+(?:\.\d+)?$/.test(String(colA));
  
  if (!isNumber) return { isHeader: false, standNumber: null, standType: 'STAND' };
  
  // Check column B (index 1) - should match "Stand number XXX" or "Cluster stand XXX"
  const colB = String(row[1] || '').trim();
  
  const standMatch = colB.match(/(?:stand number|cluster stand)\s+(\w+)/i);
  if (!standMatch) return { isHeader: false, standNumber: null, standType: 'STAND' };
  
  const standNumber = standMatch[1];
  const standType: StandType = colB.toLowerCase().includes('cluster') ? 'CLUSTER' : 'STAND';
  
  return { isHeader: true, standNumber, standType };
}

function shouldSkipTransaction(row: unknown[]): boolean {
  if (!row || row.length < 5) return true;
  
  const desc = String(row[2] || '').trim().toLowerCase();
  const colE = String(row[4] || '');
  const colG = String(row[6] || '');
  
  // Skip header row
  if (desc === 'description') return true;
  
  // Skip SUM formula rows
  if (colE.includes('=SUM(')) return true;
  
  // Skip Balance c/d rows
  if (colG.toLowerCase() === 'balance c/d') return true;
  
  // Skip empty template rows (both date and amount null)
  const dateLeft = row[1];
  const dateRight = row[5];
  const amountLeft = parseAmount(row[4]);
  const amountRight = parseAmount(row[8]);
  
  if (!dateLeft && !dateRight && amountLeft === null && amountRight === null) return true;
  
  return false;
}

function isSumRow(row: unknown[]): boolean {
  if (!row) return false;
  const colB = String(row[1] || '').trim().toLowerCase();
  const colE = String(row[4] || '');
  return colB.includes('total') || colB.includes('sum') || colE.includes('=sum(');
}

// ─────────────────────────────────────────────────────────────────────────────
// Stand Block Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseStandBlock(
  rows: unknown[][],
  startRow: number,
  sheetName: string
): { stand: ParsedStand | null; endRow: number } {
  const headerRow = rows[startRow];
  const headerInfo = isStandHeaderRow(headerRow);
  
  if (!headerInfo.isHeader || !headerInfo.standNumber) {
    return { stand: null, endRow: startRow };
  }
  
  const config = getSheetConfig(sheetName);
  if (!config) {
    console.warn(`No config found for sheet: ${sheetName}`);
  }
  
  // Extract agent code from header row (last non-null column)
  const agentCode = extractAgentCode(headerRow);
  
  // Row N+1 contains size in column A (optional)
  let sizeSqm: number | null = null;
  if (rows[startRow + 1]) {
    sizeSqm = parseSizeSqm(rows[startRow + 1][0]);
  }
  
  const transactions: ParsedTransaction[] = [];
  let rowIdx = startRow + 2; // Start from transaction rows
  
  // Parse transaction rows until we hit SUM row or next stand
  while (rowIdx < rows.length) {
    const row = rows[rowIdx];
    
    // Check for next stand header
    if (isStandHeaderRow(row).isHeader) break;
    
    // Check for SUM/total row
    if (isSumRow(row)) {
      rowIdx++;
      break;
    }
    
    // Skip rows that shouldn't be imported
    if (shouldSkipTransaction(row)) {
      rowIdx++;
      continue;
    }
    
    // Parse LEFT side (client payments)
    const dateLeft = parseDate(row[1]);
    const descLeft = String(row[2] || '').trim();
    const refLeft = String(row[3] || '');
    const amountLeft = parseAmount(row[4]);
    
    if (descLeft && amountLeft !== null) {
      const type = classifyTransaction(descLeft);
      
      // Skip FC_ADMIN_FEE (internal)
      if (type !== 'FC_ADMIN_FEE') {
        transactions.push({
          date: dateLeft,
          description: descLeft,
          reference: refLeft || null,
          amount: amountLeft,
          type,
          side: 'LEFT',
        });
      }
    }
    
    // Parse RIGHT side (disbursements)
    const dateRight = parseDate(row[5]);
    const descRight = String(row[6] || '').trim();
    const refRight = String(row[7] || '');
    const amountRight = parseAmount(row[8]);
    
    if (descRight && amountRight !== null) {
      const type = classifyTransaction(descRight);
      
      // Skip FC_ADMIN_FEE (internal)
      if (type !== 'FC_ADMIN_FEE') {
        transactions.push({
          date: dateRight,
          description: descRight,
          reference: refRight || null,
          amount: amountRight,
          type,
          side: 'RIGHT',
        });
      }
    }
    
    rowIdx++;
  }
  
  const stand: ParsedStand = {
    sheetName,
    developer: config?.developer || 'Unknown Developer',
    development: config?.development || sheetName,
    standNumber: headerInfo.standNumber,
    standType: headerInfo.standType,
    sizeSqm,
    priceUsd: config?.priceUsd || null,
    agentCode,
    transactions,
    rowIndex: startRow,
  };
  
  return { stand, endRow: rowIdx - 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Parse Function
// ─────────────────────────────────────────────────────────────────────────────

export function parseLakeCityExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  const stands: ParsedStand[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  
  const summary = {
    totalSheets: 0,
    totalStands: 0,
    totalTransactions: 0,
    totalCollected: 0,
    developers: new Map<string, number>(),
    developments: new Map<string, number>(),
  };
  
  for (const sheetName of workbook.SheetNames) {
    const config = getSheetConfig(sheetName);
    if (!config) {
      warnings.push(`Sheet "${sheetName}" has no configuration, skipping`);
      skipped++;
      continue;
    }
    
    summary.totalSheets++;
    
    const worksheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let rowIdx = 0;
    while (rowIdx < rows.length) {
      const result = parseStandBlock(rows, rowIdx, sheetName);
      
      if (result.stand) {
        stands.push(result.stand);
        
        // Update summary
        summary.totalStands++;
        summary.totalTransactions += result.stand.transactions.length;
        
        const clientPayments = result.stand.transactions
          .filter(t => t.side === 'LEFT')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        summary.totalCollected += clientPayments;
        
        // Track developer count
        const devCount = summary.developers.get(result.stand.developer) || 0;
        summary.developers.set(result.stand.developer, devCount + 1);
        
        // Track development count
        const devNameCount = summary.developments.get(result.stand.development) || 0;
        summary.developments.set(result.stand.development, devNameCount + 1);
        
        rowIdx = result.endRow + 1;
      } else {
        rowIdx++;
      }
    }
  }
  
  return { stands, warnings, skipped, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Format Detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectFileFormat(buffer: ArrayBuffer, filename: string): FileFormat {
  const lowerName = filename.toLowerCase();
  
  // Check extension first
  if (lowerName.endsWith('.csv')) {
    return 'FLAT_CSV';
  }
  
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    // Try to read as Excel and detect LakeCity format
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Check if any sheet matches LakeCity pattern
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Look for stand header pattern in first 50 rows
        for (let i = 0; i < Math.min(rows.length, 50); i++) {
          if (isStandHeaderRow(rows[i]).isHeader) {
            return 'LAKECITY_LEDGER';
          }
        }
      }
      
      // Has sheets but no stand headers - treat as flat Excel
      return 'FLAT_EXCEL';
    } catch {
      return 'UNKNOWN';
    }
  }
  
  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────────────────────
// Export for API Usage
// ─────────────────────────────────────────────────────────────────────────────

export function convertToImportFormat(result: ParseResult): {
  developers: Array<{ name: string; standCount: number }>;
  developments: Array<{ name: string; standCount: number }>;
  stands: ParsedStand[];
} {
  return {
    developers: Array.from(result.summary.developers.entries()).map(([name, count]) => ({
      name,
      standCount: count,
    })),
    developments: Array.from(result.summary.developments.entries()).map(([name, count]) => ({
      name,
      standCount: count,
    })),
    stands: result.stands,
  };
}
