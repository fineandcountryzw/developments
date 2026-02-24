/**
 * Shared receipt PDF generator for admin and client document downloads.
 * Branded Fine & Country receipts with amount-in-words.
 */

import { jsPDF } from 'jspdf';

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  if (num < 0) return 'Negative ' + numberToWords(-num);

  const intPart = Math.floor(num);
  let words = '';

  if (intPart >= 1_000_000) {
    words += numberToWords(Math.floor(intPart / 1_000_000)) + ' Million ';
  }
  if (intPart >= 1_000) {
    words += numberToWords(Math.floor((intPart % 1_000_000) / 1_000)) + ' Thousand ';
  }
  if (intPart >= 100) {
    words += ones[Math.floor((intPart % 1_000) / 100)] + ' Hundred ';
  }
  if (intPart % 100 >= 20) {
    words += tens[Math.floor((intPart % 100) / 10)] + ' ';
  }
  if (intPart % 100 > 0 && intPart % 100 < 20) {
    words += ones[intPart % 100] + ' ';
  } else if (intPart % 10 > 0) {
    words += ones[intPart % 10] + ' ';
  }

  return words.trim();
}

export function generateReceiptPDF(receipt: {
  receiptNumber: string;
  amount: number | string | { toNumber?: () => number };
  clientName: string;
  paymentType: string;
  paymentMethod: string;
  branch?: string;
  createdAt: Date | string;
  standNumber?: string | null;
  developmentName?: string | null;
  description?: string | null;
  receivedBy?: string | null;
}): Buffer {
  const doc = new jsPDF();
  const branch = receipt.branch || 'Harare';
  const amount = typeof receipt.amount === 'number'
    ? receipt.amount
    : typeof receipt.amount === 'object' && receipt.amount != null && typeof (receipt.amount as { toNumber?: () => number }).toNumber === 'function'
      ? (receipt.amount as { toNumber: () => number }).toNumber()
      : Number(receipt.amount);

  const branchSettings: Record<string, { address: string; phone: string; email: string }> = {
    Harare: {
      address: '15 Nigels Lane, Ballantyne Park Borrowdale Harare',
      phone: '08644 253731',
      email: 'harare@fineandcountry.co.zw'
    },
    Bulawayo: {
      address: '6 Kingsley Crescent, Malindela, Bulawayo',
      phone: '08644 253731',
      email: 'bulawayo@fineandcountry.co.zw'
    }
  };

  const settings = branchSettings[branch] || branchSettings.Harare;
  const branchLabel = branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('FINE & COUNTRY', 105, 25, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE ZIMBABWE', 105, 31, { align: 'center' });

  doc.setFontSize(8);
  doc.text(branchLabel, 190, 20, { align: 'right' });
  doc.text(settings.address, 190, 25, { align: 'right' });
  doc.text(settings.phone, 190, 30, { align: 'right' });
  doc.text(settings.email, 190, 35, { align: 'right' });

  doc.setLineWidth(0.8);
  doc.setDrawColor(133, 117, 78);
  doc.line(20, 40, 190, 40);

  doc.setFontSize(18);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(133, 117, 78);
  doc.text('OFFICIAL RECEIPT', 105, 55, { align: 'center' });

  doc.setFillColor(250, 249, 247);
  doc.roundedRect(60, 60, 90, 15, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`No. ${receipt.receiptNumber}`, 105, 70, { align: 'center' });

  let y = 90;
  doc.setLineWidth(0.2);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Date:', 25, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(new Date(receipt.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 60, y);
  y += 12;

  doc.setFont('Helvetica', 'bold');
  doc.text('Received From:', 25, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(receipt.clientName, 60, y);
  y += 12;

  doc.setFont('Helvetica', 'bold');
  doc.text('Amount:', 25, y);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(`USD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 60, y);
  doc.setFontSize(10);
  y += 12;

  doc.setFont('Helvetica', 'bold');
  doc.text('Payment Type:', 25, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(receipt.paymentType, 60, y);
  y += 12;

  doc.setFont('Helvetica', 'bold');
  doc.text('Payment Method:', 25, y);
  doc.setFont('Helvetica', 'normal');
  doc.text(receipt.paymentMethod, 60, y);
  y += 12;

  if (receipt.standNumber || receipt.developmentName) {
    doc.setFont('Helvetica', 'bold');
    doc.text('Property:', 25, y);
    doc.setFont('Helvetica', 'normal');
    doc.text([receipt.standNumber, receipt.developmentName].filter(Boolean).join(' - '), 60, y);
    y += 12;
  }

  if (receipt.description) {
    doc.setFont('Helvetica', 'bold');
    doc.text('Description:', 25, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(receipt.description.substring(0, 80), 60, y);
    y += 12;
  }

  if (receipt.receivedBy) {
    y += 5;
    doc.setFont('Helvetica', 'bold');
    doc.text('Received By:', 25, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(receipt.receivedBy, 60, y);
  }

  y += 15;
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFillColor(250, 249, 247);
  doc.roundedRect(20, y, 170, 20, 3, 3, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('AMOUNT IN WORDS:', 25, y + 8);
  doc.setFont('Helvetica', 'normal');
  doc.text(numberToWords(Math.floor(amount)) + ' US Dollars Only', 25, y + 15);

  y += 40;
  doc.setLineWidth(0.5);
  doc.line(20, y, 80, y);
  doc.setFontSize(8);
  doc.text('Authorized Signature', 50, y + 5, { align: 'center' });
  doc.line(130, y, 190, y);
  doc.text('Company Stamp', 160, y + 5, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('This is a computer-generated receipt. For inquiries, contact your branch office.', 105, 280, { align: 'center' });
  doc.text(`Generated: ${new Date().toISOString()}`, 105, 285, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
