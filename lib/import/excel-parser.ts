/**
 * Excel Parser for LakeCity Ledger-Style Format
 * 
 * Handles the specific format from Fine & Country Zimbabwe legacy Excel files:
 * - Multiple sheets per workbook (each sheet = one development/tier)
 * - Ledger-style blocks: one stand = ~18 rows
 * - Two-sided accounting: LEFT = client payments, RIGHT = disbursements
 * - Agent codes in stand header row (KCM, KK, PM, RJ, TM)
 * 
 * Sheet → Development Mapping:
 * - Kumvura estate → Kumvura Estate Developers / Kumvura Estate
 * - Hirange KK → Highrange LC Developers / Highrange
 * - $9000 → Lakecity Developers / Lakecity ($9,000 tier)
 * - $500 KK zero dep $12k → Lakecity Developers / Lakecity ($12,000 tier)
 * - Rockridge KCMPM → Southlands Developers / Rockridge ($18,000)
 * - $12k CKTM → Lakecity Developers / Lakecity ($12,000 tier)
 * - $12k KK → Lakecity Developers / Lakecity ($12,000 tier)
 * - Cluster stands KK → Highrange LC Developers / Highrange Cluster
 * - Lomlight → Lomlight Teddy M Developers / Lomlight
 */

import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  rowIndex: number;
  date: Date | null;
  description: string;
  amount: number;
  transactionType: 'DEPOSIT' | 'INSTALLMENT' | 'LEGAL_FEE' | 'AOS_FEE' | 'FC_ADMIN_FEE' | 'OTHER';
  side: 'CLIENT' | 'DISBURSEMENT'; // LEFT side = client payments, RIGHT side = disbursements
  isValid: boolean;
  validationError?: string;
}

export interface ParsedStand {
  standNumber: string;
  standHash: string; // For duplicate detection
  clientName: string;
  agentCode: string | null;
  priceTier: number; // e.g., 9000, 12000, 18000
  transactions: ParsedTransaction[];
  totals: {
    clientPayments: number;
    disbursements: number;
    balance: number;
  };
  isDuplicate: boolean; // True if this stand number appears multiple times
  duplicateOf?: string; // Reference to original stand hash
}

export interface ParsedSheet {
  sheetName: string;
  developerName: string;
  developmentName: string;
  priceTier: number;
  stands: ParsedStand[];
  summary: {
    totalStands: number;
    totalClientPayments: number;
    totalDisbursements: number;
    invalidDates: Array<{ row: number; value: string }>;
    missingAgents: number;
  };
}

export interface ExcelParseResult {
  fileName: string;
  sheets: ParsedSheet[];
  developers: Map<string, { name: string; standCount: number }>;
  globalSummary: {
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    totalCollected: number;
    invalidDateCount: number;
    missingAgentCount: number;
    duplicateStandCount: number;
  };
  errors: Array<{ sheet: string; row: number; message: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet → Development Mapping Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_MAPPING: Record<string, { developer: string; development: string; priceTier: number }> = {
  'Kumvura estate': { developer: 'Kumvura Estate Developers', development: 'Kumvura Estate', priceTier: 0 },
  'Hirange KK': { developer: 'Highrange LC Developers', development: 'Highrange', priceTier: 0 },
  '$9000': { developer: 'Lakecity Developers', development: 'Lakecity', priceTier: 9000 },
  '$500 KK zero dep $12k': { developer: 'Lakecity Developers', development: 'Lakecity', priceTier: 12000 },
  'Rockridge KCMPM': { developer: 'Southlands Developers', development: 'Rockridge', priceTier: 18000 },
  '$12k CKTM': { developer: 'Lakecity Developers', development: 'Lakecity', priceTier: 12000 },
  '$12k KK': { developer: 'Lakecity Developers', development: 'Lakecity', priceTier: 12000 },
  'Cluster stands KK': { developer: 'Highrange LC Developers', development: 'Highrange Cluster', priceTier: 0 },
  'Lomlight': { developer: 'Lomlight Teddy M Developers', development: 'Lomlight', priceTier: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSheetName(name: string): string {
  // Handle variations in sheet naming
  const normalized = name.trim();
  
  // Direct match
  if (SHEET_MAPPING[normalized]) return normalized;
  
  // Case-insensitive match
  const lowerName = normalized.toLowerCase();
  for (const [key, value] of Object.entries(SHEET_MAPPING)) {
    if (key.toLowerCase() === lowerName) return key;
  }
  
  // Fuzzy match for common variations
  if (lowerName.includes('kumvura')) return 'Kumvura estate';
  if (lowerName.includes('hirange') || lowerName.includes('highrange')) return 'Hirange KK';
  if (lowerName.includes('9000')) return '$9000';
  if (lowerName.includes('rockridge')) return 'Rockridge KCMPM';
  if (lowerName.includes('lomlight')) return 'Lomlight';
  if (lowerName.includes('cluster')) return 'Cluster stands KK';
  if (lowerName.includes('12k') && lowerName.includes('cktm')) return '$12k CKTM';
  if (lowerName.includes('12k') && lowerName.includes('kk')) return '$12k KK';
  if (lowerName.includes('500') && lowerName.includes('12k')) return '$500 KK zero dep $12k';
  
  return normalized;
}

function parseDate(value: any): { date: Date | null; isValid: boolean; rawValue: string } {
  if (!value) return { date: null, isValid: false, rawValue: '' };
  
  const rawValue = String(value).trim();
  
  // Excel serial date (number)
  if (typeof value === 'number') {
    // Excel dates are serial numbers since 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = value - 2; // Excel has a bug counting 1900 as leap year
    const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return { date, isValid: !isNaN(date.getTime()), rawValue };
  }
  
  // String date parsing
  const datePatterns = [
    // YYYY-MM-DD
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, parse: (m: RegExpMatchArray) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) },
    // DD/MM/YYYY or DD-MM-YYYY
    { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])) },
    // MM/DD/YYYY (US format)
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])) },
  ];
  
  for (const pattern of datePatterns) {
    const match = rawValue.match(pattern.regex);
    if (match) {
      const date = pattern.parse(match);
      return { date, isValid: !isNaN(date.getTime()), rawValue };
    }
  }
  
  // Try native Date parsing as fallback
  const date = new Date(rawValue);
  return { date, isValid: !isNaN(date.getTime()), rawValue };
}

function parseAmount(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  const cleaned = String(value)
    .replace(/[$,\s]/g, '') // Remove $, commas, spaces
    .replace(/\((.*)\)/, '-$1') // Convert (100) to -100
    .trim();
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

function detectTransactionType(description: string): ParsedTransaction['transactionType'] {
  const lower = description.toLowerCase();
  
  if (lower.includes('deposit') || lower.includes('dep')) return 'DEPOSIT';
  if (lower.includes('installment') || lower.includes('monthly') || lower.includes('inst')) return 'INSTALLMENT';
  if (lower.includes('legal') || lower.includes('legal fees')) return 'LEGAL_FEE';
  if (lower.includes('aos') || lower.includes('agreement of sale')) return 'AOS_FEE';
  if (lower.includes('f&c') || lower.includes('admin') || lower.includes('administration')) return 'FC_ADMIN_FEE';
  
  return 'OTHER';
}

function extractAgentCode(row: any[]): string | null {
  // Agent codes are typically in the last column of the stand header row
  // Look for patterns like KCM, KK, PM, RJ, TM
  const agentPattern = /\b(KCM|KK|PM|RJ|TM)\b/;
  
  for (const cell of row) {
    if (!cell) continue;
    const match = String(cell).match(agentPattern);
    if (match) return match[1];
  }
  
  return null;
}

function generateStandHash(standNumber: string, sheetName: string): string {
  // Create unique hash for duplicate detection
  return `${sheetName}:${standNumber}`.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Parsing Functions
// ─────────────────────────────────────────────────────────────────────────────

function parseStandBlock(
  rows: any[][],
  startRow: number,
  sheetName: string
): { stand: ParsedStand | null; endRow: number } {
  const row = rows[startRow];
  
  // Check if this is a stand header row
  // Stand headers typically have "Stand X" or similar in first column
  const firstCell = String(row[0] || '').trim();
  const standMatch = firstCell.match(/stand\s*(\d+[a-z]?)/i);
  
  if (!standMatch) {
    return { stand: null, endRow: startRow };
  }
  
  const standNumber = standMatch[1];
  const standHash = generateStandHash(standNumber, sheetName);
  const agentCode = extractAgentCode(row);
  
  // Try to find client name (usually in row after header or in header)
  let clientName = '';
  if (rows[startRow + 1]) {
    const nextRowFirstCell = String(rows[startRow + 1][0] || '').trim();
    if (!nextRowFirstCell.toLowerCase().includes('stand')) {
      clientName = nextRowFirstCell;
    }
  }
  
  const transactions: ParsedTransaction[] = [];
  let rowIdx = startRow + (clientName ? 2 : 1);
  const invalidDates: Array<{ row: number; value: string }> = [];
  
  // Parse transaction rows (typically 12-16 rows per stand)
  // Stop when we hit next stand or empty rows
  while (rowIdx < rows.length && rowIdx < startRow + 20) {
    const transRow = rows[rowIdx];
    
    // Check for next stand header
    const nextFirstCell = String(transRow?.[0] || '').trim();
    if (nextFirstCell.match(/stand\s*\d+/i)) break;
    
    // Check for empty row (all cells empty)
    if (!transRow || transRow.every(cell => !cell)) {
      rowIdx++;
      continue;
    }
    
    // Parse date (column 0 or 1)
    let dateValue = transRow[0] || transRow[1];
    const dateResult = parseDate(dateValue);
    
    if (!dateResult.isValid && dateValue) {
      invalidDates.push({ row: rowIdx, value: dateResult.rawValue });
    }
    
    // Parse description (usually column 1 or 2)
    const description = String(transRow[1] || transRow[2] || '').trim();
    
    // Parse amounts - LEDGER STYLE: LEFT = client payments, RIGHT = disbursements
    // LEFT side (columns 2-4 typically)
    const leftAmount = parseAmount(transRow[2]) || parseAmount(transRow[3]) || parseAmount(transRow[4]);
    
    // RIGHT side (columns 5-7 typically)
    const rightAmount = parseAmount(transRow[5]) || parseAmount(transRow[6]) || parseAmount(transRow[7]);
    
    // Create transaction for LEFT side (client payment)
    if (leftAmount > 0 && description) {
      transactions.push({
        rowIndex: rowIdx,
        date: dateResult.date,
        description,
        amount: leftAmount,
        transactionType: detectTransactionType(description),
        side: 'CLIENT',
        isValid: dateResult.isValid || !dateValue, // Allow missing dates for some transactions
      });
    }
    
    // Create transaction for RIGHT side (disbursement)
    if (rightAmount > 0 && description) {
      transactions.push({
        rowIndex: rowIdx,
        date: dateResult.date,
        description,
        amount: rightAmount,
        transactionType: detectTransactionType(description),
        side: 'DISBURSEMENT',
        isValid: dateResult.isValid || !dateValue,
      });
    }
    
    rowIdx++;
  }
  
  // Calculate totals
  const clientPayments = transactions
    .filter(t => t.side === 'CLIENT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const disbursements = transactions
    .filter(t => t.side === 'DISBURSEMENT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const stand: ParsedStand = {
    standNumber,
    standHash,
    clientName,
    agentCode,
    priceTier: 0, // Set from sheet mapping
    transactions,
    totals: {
      clientPayments,
      disbursements,
      balance: clientPayments - disbursements,
    },
    isDuplicate: false,
  };
  
  return { stand, endRow: rowIdx - 1 };
}

function parseSheet(worksheet: XLSX.WorkSheet, sheetName: string): ParsedSheet {
  const normalizedName = normalizeSheetName(sheetName);
  const mapping = SHEET_MAPPING[normalizedName] || { 
    developer: 'Unknown Developer', 
    development: normalizedName,
    priceTier: 0 
  };
  
  // Convert worksheet to array of arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  const stands: ParsedStand[] = [];
  const seenStands = new Map<string, ParsedStand>(); // For duplicate detection
  const errors: Array<{ row: number; message: string }> = [];
  const invalidDates: Array<{ row: number; value: string }> = [];
  let missingAgentCount = 0;
  
  let rowIdx = 0;
  while (rowIdx < rows.length) {
    const result = parseStandBlock(rows, rowIdx, sheetName);
    
    if (result.stand) {
      // Check for duplicates
      if (seenStands.has(result.stand.standHash)) {
        result.stand.isDuplicate = true;
        result.stand.duplicateOf = seenStands.get(result.stand.standHash)!.standHash;
      } else {
        seenStands.set(result.stand.standHash, result.stand);
      }
      
      // Set price tier from sheet mapping
      result.stand.priceTier = mapping.priceTier;
      
      // Track missing agents
      if (!result.stand.agentCode) missingAgentCount++;
      
      stands.push(result.stand);
      rowIdx = result.endRow + 1;
    } else {
      rowIdx++;
    }
  }
  
  // Calculate sheet totals
  const totalClientPayments = stands.reduce((sum, s) => sum + s.totals.clientPayments, 0);
  const totalDisbursements = stands.reduce((sum, s) => sum + s.totals.disbursements, 0);
  
  return {
    sheetName,
    developerName: mapping.developer,
    developmentName: mapping.development,
    priceTier: mapping.priceTier,
    stands,
    summary: {
      totalStands: stands.length,
      totalClientPayments,
      totalDisbursements,
      invalidDates,
      missingAgents: missingAgentCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export Function
// ─────────────────────────────────────────────────────────────────────────────

export function parseLakeCityExcel(fileBuffer: Buffer, fileName: string): ExcelParseResult {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const sheets: ParsedSheet[] = [];
  const developers = new Map<string, { name: string; standCount: number }>();
  const errors: Array<{ sheet: string; row: number; message: string }> = [];
  
  // Track global duplicates across all sheets
  const globalStandHashes = new Set<string>();
  let duplicateStandCount = 0;
  
  for (const sheetName of workbook.SheetNames) {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const parsedSheet = parseSheet(worksheet, sheetName);
      
      // Track developers
      const devKey = parsedSheet.developerName;
      const existing = developers.get(devKey);
      if (existing) {
        existing.standCount += parsedSheet.stands.length;
      } else {
        developers.set(devKey, { 
          name: parsedSheet.developerName, 
          standCount: parsedSheet.stands.length 
        });
      }
      
      // Track global duplicates
      for (const stand of parsedSheet.stands) {
        const globalHash = `${parsedSheet.developmentName}:${stand.standNumber}`;
        if (globalStandHashes.has(globalHash)) {
          duplicateStandCount++;
          stand.isDuplicate = true;
        } else {
          globalStandHashes.add(globalHash);
        }
      }
      
      sheets.push(parsedSheet);
    } catch (err) {
      errors.push({
        sheet: sheetName,
        row: 0,
        message: err instanceof Error ? err.message : 'Failed to parse sheet',
      });
    }
  }
  
  // Calculate global summary
  const totalStands = sheets.reduce((sum, s) => sum + s.summary.totalStands, 0);
  const totalTransactions = sheets.reduce(
    (sum, s) => sum + s.stands.reduce((ts, st) => ts + st.transactions.length, 0), 
    0
  );
  const totalCollected = sheets.reduce((sum, s) => sum + s.summary.totalClientPayments, 0);
  const invalidDateCount = sheets.reduce(
    (sum, s) => sum + s.summary.invalidDates.length, 
    0
  );
  const missingAgentCount = sheets.reduce((sum, s) => sum + s.summary.missingAgents, 0);
  
  return {
    fileName,
    sheets,
    developers,
    globalSummary: {
      totalSheets: sheets.length,
      totalStands,
      totalTransactions,
      totalCollected,
      invalidDateCount,
      missingAgentCount,
      duplicateStandCount,
    },
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Export for API Usage
// ─────────────────────────────────────────────────────────────────────────────

export function convertToImportFormat(result: ExcelParseResult): {
  developers: Array<{ name: string; standCount: number }>;
  developments: Array<{ name: string; developerName: string; priceTier: number; stands: ParsedStand[] }>;
  transactions: Array<{
    standNumber: string;
    developmentName: string;
    developerName: string;
    date: Date | null;
    amount: number;
    type: string;
    side: string;
    agentCode: string | null;
    isValid: boolean;
  }>;
} {
  const developments: Array<{ name: string; developerName: string; priceTier: number; stands: ParsedStand[] }> = [];
  const transactions: Array<{
    standNumber: string;
    developmentName: string;
    developerName: string;
    date: Date | null;
    amount: number;
    type: string;
    side: string;
    agentCode: string | null;
    isValid: boolean;
  }> = [];
  
  for (const sheet of result.sheets) {
    developments.push({
      name: sheet.developmentName,
      developerName: sheet.developerName,
      priceTier: sheet.priceTier,
      stands: sheet.stands,
    });
    
    for (const stand of sheet.stands) {
      for (const trans of stand.transactions) {
        transactions.push({
          standNumber: stand.standNumber,
          developmentName: sheet.developmentName,
          developerName: sheet.developerName,
          date: trans.date,
          amount: trans.amount,
          type: trans.transactionType,
          side: trans.side,
          agentCode: stand.agentCode,
          isValid: trans.isValid,
        });
      }
    }
  }
  
  return {
    developers: Array.from(result.developers.values()),
    developments,
    transactions,
  };
}
