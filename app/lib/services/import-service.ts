/**
 * Import Service
 * Handles import of past sales with payments
 */

import { v4 as uuidv4 } from 'uuid';

export interface SaleImportData {
  // Client Info
  name: string;
  email: string;
  phone?: string;
  address?: string;
  
  // Sale Info
  standNumber: string;
  developmentName: string;
  saleDate: string;
  salePrice: number;
  depositAmount: number;
  paymentMethod: string;
  notes?: string;
}

export interface PaymentImportData {
  // Link to sale
  clientEmail: string;
  standNumber: string;
  
  // Payment Info
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface ImportResult {
  batchId: string;
  salesImported: number;
  paymentsImported: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  type: 'sale' | 'payment';
  message: string;
}

export interface ImportSummary {
  batchId: string;
  fileName: string;
  totalSales: number;
  totalPayments: number;
  totalAmount: number;
  depositTotal: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  errors: ImportError[];
}

/**
 * Process import data and return a summary
 * This service handles the business logic of imports
 */
export const processImport = async (
  sales: SaleImportData[],
  payments: PaymentImportData[] = []
): Promise<ImportResult> => {
  const batchId = uuidv4();
  const errors: ImportError[] = [];
  
  let salesImported = 0;
  let paymentsImported = 0;

  // Process sales
  for (let i = 0; i < sales.length; i++) {
    const sale = sales[i];
    
    try {
      // Validate sale data
      if (!sale.name || !sale.email || !sale.standNumber) {
        errors.push({
          row: i + 1,
          type: 'sale',
          message: 'Missing required fields',
        });
        continue;
      }

      // Here you would create the client, stand, sale records
      // This is handled by the API route with Prisma
      
      salesImported++;
    } catch (error) {
      errors.push({
        row: i + 1,
        type: 'sale',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Process payments
  for (let i = 0; i < payments.length; i++) {
    const payment = payments[i];
    
    try {
      // Validate payment data
      if (!payment.clientEmail || !payment.standNumber || !payment.amount) {
        errors.push({
          row: i + 1,
          type: 'payment',
          message: 'Missing required fields',
        });
        continue;
      }

      // Here you would link and create payment records
      // This is handled by the API route with Prisma
      
      paymentsImported++;
    } catch (error) {
      errors.push({
        row: i + 1,
        type: 'payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    batchId,
    salesImported,
    paymentsImported,
    errors,
  };
};

/**
 * Calculate totals from import data
 */
export const calculateImportTotals = (sales: SaleImportData[], payments: PaymentImportData[]) => {
  const depositTotal = sales.reduce((sum, s) => sum + s.depositAmount, 0);
  const paymentTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const saleTotal = sales.reduce((sum, s) => sum + s.salePrice, 0);

  return {
    depositTotal,
    paymentTotal,
    saleTotal,
    totalAmount: depositTotal + paymentTotal,
  };
};
