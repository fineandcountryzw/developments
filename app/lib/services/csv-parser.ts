/**
 * CSV Parser Service
 * Handles CSV parsing and validation for past sales imports with payments
 */

import Papa from 'papaparse';

export interface ParsedSaleRow {
  // Client Info
  name: string;
  email: string;
  phone?: string;
  address?: string;
  
  // Sale Info
  standNumber: string;
  developmentName: string;
  saleDate: string;
  salePrice: string;
  depositAmount: string;
  paymentMethod: string;
  notes?: string;
}

export interface ParsedPaymentRow {
  // Link to sale by email and stand
  clientEmail: string;
  standNumber: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface CsvParseResult<T> {
  data: T[];
  errors: string[];
  isValid: boolean;
}

const REQUIRED_SALE_FIELDS = [
  'name',
  'email',
  'standNumber',
  'developmentName',
  'saleDate',
  'salePrice',
  'depositAmount',
  'paymentMethod',
];

const REQUIRED_PAYMENT_FIELDS = [
  'clientEmail',
  'standNumber',
  'paymentDate',
  'amount',
  'paymentMethod',
];

const validateSaleRow = (row: Record<string, string>, rowIndex: number): string[] => {
  const errors: string[] = [];

  for (const field of REQUIRED_SALE_FIELDS) {
    const value = row[field]?.trim();
    if (!value) {
      errors.push(`Row ${rowIndex + 1}: Missing required field "${field}"`);
    }
  }

  // Validate email format
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push(`Row ${rowIndex + 1}: Invalid email format "${row.email}"`);
  }

  // Validate date format
  if (row.saleDate) {
    const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
    if (!dateRegex.test(row.saleDate)) {
      errors.push(`Row ${rowIndex + 1}: Invalid date format "${row.saleDate}". Use YYYY-MM-DD`);
    }
  }

  // Validate numeric fields
  const numericFields = ['salePrice', 'depositAmount'];
  for (const field of numericFields) {
    const value = row[field]?.trim();
    if (value && isNaN(parseFloat(value.replace(/,/g, '')))) {
      errors.push(`Row ${rowIndex + 1}: Invalid numeric value for "${field}"`);
    }
  }

  return errors;
};

const validatePaymentRow = (row: Record<string, string>, rowIndex: number): string[] => {
  const errors: string[] = [];

  for (const field of REQUIRED_PAYMENT_FIELDS) {
    const value = row[field]?.trim();
    if (!value) {
      errors.push(`Row ${rowIndex + 1}: Missing required field "${field}"`);
    }
  }

  // Validate email format
  if (row.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.clientEmail)) {
    errors.push(`Row ${rowIndex + 1}: Invalid email format "${row.clientEmail}"`);
  }

  // Validate date format
  if (row.paymentDate) {
    const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
    if (!dateRegex.test(row.paymentDate)) {
      errors.push(`Row ${rowIndex + 1}: Invalid date format "${row.paymentDate}". Use YYYY-MM-DD`);
    }
  }

  // Validate numeric field
  if (row.amount && isNaN(parseFloat(row.amount.replace(/,/g, '')))) {
    errors.push(`Row ${rowIndex + 1}: Invalid numeric value for "amount"`);
  }

  return errors;
};

export const parseCsvSales = (fileContent: string): CsvParseResult<ParsedSaleRow> => {
  const result = Papa.parse<ParsedSaleRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];

  // Check for required columns
  const headers = result.meta.fields || [];
  for (const field of REQUIRED_SALE_FIELDS) {
    if (!headers.includes(field)) {
      errors.push(`Missing required column: "${field}"`);
    }
  }

  // Validate each row
  if (result.data) {
    result.data.forEach((row, index) => {
      const rowErrors = validateSaleRow(row as unknown as Record<string, string>, index);
      errors.push(...rowErrors);
    });
  }

  return {
    data: result.data || [],
    errors,
    isValid: errors.length === 0,
  };
};

export const parseCsvPayments = (fileContent: string): CsvParseResult<ParsedPaymentRow> => {
  const result = Papa.parse<ParsedPaymentRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];

  // Check for required columns
  const headers = result.meta.fields || [];
  for (const field of REQUIRED_PAYMENT_FIELDS) {
    if (!headers.includes(field)) {
      errors.push(`Missing required column: "${field}"`);
    }
  }

  // Validate each row
  if (result.data) {
    result.data.forEach((row, index) => {
      const rowErrors = validatePaymentRow(row as unknown as Record<string, string>, index);
      errors.push(...rowErrors);
    });
  }

  return {
    data: result.data || [],
    errors,
    isValid: errors.length === 0,
  };
};

export const formatCurrency = (value: string): number => {
  const cleaned = value.replace(/[,$\s]/g, '');
  return parseFloat(cleaned) || 0;
};

export const formatDate = (dateStr: string): string => {
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr;
};

// Combined row format that includes both sale and optional payments
export interface ParsedImportRow extends ParsedSaleRow {
  // Optional payment info (for single-payment imports)
  paymentDate?: string;
  paymentAmount?: string;
  paymentReference?: string;
}

export const parseCombinedCsv = (fileContent: string): CsvParseResult<ParsedImportRow> => {
  const result = Papa.parse<ParsedImportRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];

  // Check for required columns
  const headers = result.meta.fields || [];
  for (const field of REQUIRED_SALE_FIELDS) {
    if (!headers.includes(field)) {
      errors.push(`Missing required column: "${field}"`);
    }
  }

  // Validate each row
  if (result.data) {
    result.data.forEach((row, index) => {
      const rowErrors = validateSaleRow(row as unknown as Record<string, string>, index);
      errors.push(...rowErrors);

      // Validate payment fields if provided
      if (row.paymentDate || row.paymentAmount) {
        const paymentErrors = validatePaymentRow({
          clientEmail: row.email,
          standNumber: row.standNumber,
          paymentDate: row.paymentDate || '',
          amount: row.paymentAmount || '',
          paymentMethod: row.paymentMethod,
        }, index);
        errors.push(...paymentErrors);
      }
    });
  }

  return {
    data: result.data || [],
    errors,
    isValid: errors.length === 0,
  };
};
