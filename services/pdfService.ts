
import { jsPDF } from 'jspdf';
import { Payment, Branch, Client, Stand } from '../types';
import { BRANCH_SETTINGS } from '../lib/db';

/**
 * FORENSIC PDF SERVICE v2.0
 * Generates branded, Inter-Sans compliant PDF documents with fetch-blob download approach.
 * All PDFs include Fine & Country logo, branch details, and forensic audit trails.
 */

/**
 * Download helper: Forces .pdf extension using blob approach (prevents tab opening)
 */
const downloadPDFBlob = (doc: jsPDF, filename: string) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log('[FORENSIC][PDF DOWNLOAD]', { filename: link.download, size: blob.size, timestamp: new Date().toISOString() });
};

/**
 * Renders Fine & Country branded header with branch details
 */
const renderBrandedHeader = (doc: jsPDF, branch: Branch) => {
  const settings = BRANCH_SETTINGS[branch];
  const branchLabel = branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';

  // Brand Logo Area with Gold accent
  doc.setFillColor(197, 160, 89); // Gold color (#C5A059)
  doc.rect(0, 0, 210, 5, 'F'); // Gold bar at top
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(51, 51, 51); // Dark gray
  doc.text('FINE & COUNTRY', 105, 22, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('RESIDENTIAL & COMMERCIAL REAL ESTATE', 105, 28, { align: 'center' });
  doc.text('Zimbabwe Property Solutions', 105, 32, { align: 'center' });
  
  // Branch Contact Info (Right-aligned in gold box)
  doc.setFillColor(245, 242, 235); // Very light gold background
  doc.rect(130, 15, 80, 20, 'F');
  
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(197, 160, 89);
  doc.text(branchLabel, 180, 19, { align: 'right' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.text(settings.address, 180, 24, { align: 'right' });
  doc.text('📞 ' + settings.phone, 180, 28, { align: 'right' });
  doc.text('📧 ' + settings.email, 180, 31, { align: 'right' });
  
  // Decorative line
  doc.setLineWidth(1.2);
  doc.setDrawColor(197, 160, 89);
  doc.line(20, 38, 190, 38);
};

/**
 * Generate Payment Receipt with branded header and forensic audit trail
 */
export const generateReceipt = (payment: Payment, clientName: string) => {
  const doc = new jsPDF();
  renderBrandedHeader(doc, payment.officeLocation);

  // Receipt Content
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('OFFICIAL TRANSACTION RECEIPT', 105, 55, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Reference: ${payment.reference}`, 105, 62, { align: 'center' });
  
  if (payment.manualReceiptNo) {
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(197, 160, 89);
    doc.text(`Receipt #: ${payment.manualReceiptNo}`, 190, 62, { align: 'right' });
  }

  // Client & Property Details Section
  let y = 75;
  doc.setLineWidth(0.3);
  doc.setDrawColor(197, 160, 89);
  doc.line(20, y, 190, y);
  
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(197, 160, 89);
  doc.text('CLIENT & PROPERTY INFORMATION', 20, y);
  
  y += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  
  doc.text('Client:', 20, y);
  doc.text(clientName || 'N/A', 60, y);
  y += 6;
  
  doc.text('Property ID:', 20, y);
  doc.text(payment.standId || 'N/A', 60, y);
  y += 6;
  
  doc.text('Payment Date:', 20, y);
  doc.text(new Date(payment.createdAt).toLocaleDateString(), 60, y);
  
  // Amount Section
  y += 15;
  doc.setFillColor(245, 242, 235); // Light gold background
  doc.rect(20, y, 170, 40, 'F');
  
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  doc.text('TRANSACTION SUMMARY', 25, y);
  
  y += 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(payment.description || 'Property Payment', 25, y);
  doc.setFont('Helvetica', 'bold');
  doc.text(`$${(payment.amountUsd || 0).toLocaleString()}`, 185, y, { align: 'right' });
  
  if (Number(payment.surchargeAmount || 0) > 0) {
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.text('Bank Processing Surcharge', 25, y);
    doc.setFont('Helvetica', 'bold');
    doc.text(`$${Number(payment.surchargeAmount || 0).toLocaleString()}`, 185, y, { align: 'right' });
  }
  
  y += 12;
  doc.setLineWidth(0.5);
  doc.setDrawColor(197, 160, 89);
  doc.line(25, y, 185, y);
  
  y += 8;
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(197, 160, 89);
  doc.text('Total Amount Due:', 25, y);
  doc.text(`$${((payment.amountUsd || 0) + (payment.surchargeAmount || 0)).toLocaleString()}`, 185, y, { align: 'right' });

  // Signature Section
  y += 40;
  doc.setLineWidth(0.3);
  doc.setDrawColor(80, 80, 80);
  doc.line(20, y, 80, y);
  doc.line(130, y, 190, y);
  
  y += 5;
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Client/Payer Signature', 20, y);
  doc.text('Authorized Officer', 130, y);
  
  y += 6;
  doc.setFontSize(7);
  doc.text(`Harare, Zimbabwe`, 20, y);
  const branchLabel = payment.officeLocation === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
  doc.text(branchLabel, 130, y);

  // Footer
  y = 280;
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('FINE & COUNTRY ZIMBABWE ~ Professional Real Estate Services', 105, y, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()} | Document: Receipt_${payment.reference}`, 105, y + 5, { align: 'center' });

  downloadPDFBlob(doc, `Receipt_${payment.reference}.pdf`);
};

/**
 * Generate Client Statement PDF with comprehensive transaction history
 */
export const generateClientStatementPDF = (
  client: Client, 
  payments: Payment[], 
  stands: Stand[], 
  branch: Branch
) => {
  const doc = new jsPDF();
  renderBrandedHeader(doc, branch);

  // Statement Title
  doc.setFontSize(16);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(197, 160, 89);
  doc.text('STATEMENT OF ACCOUNT', 105, 55, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 62, { align: 'center' });

  // Client Details Box
  let y = 72;
  doc.setFillColor(245, 242, 235); // Light gold background
  doc.rect(20, y, 170, 32, 'F');
  
  doc.setLineWidth(0.3);
  doc.setDrawColor(197, 160, 89);
  doc.rect(20, y, 170, 32);
  
  y += 5;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(197, 160, 89);
  doc.text('CLIENT INFORMATION', 25, y);
  
  y += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(`Name: ${client.name}`, 25, y);
  doc.text(`Email: ${client.email}`, 105, y);
  
  y += 6;
  doc.text(`Phone: ${client.phone || 'N/A'}`, 25, y);
  doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 105, y);

  // Financial Summary
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountUsd || Number(p.amount) || 0), 0);
  const totalContractValue = stands.reduce((sum, s) => sum + (s.priceUsd || Number(s.price) || 0), 0);
  const outstandingBalance = Math.max(0, totalContractValue - totalPaid);
  const activeReservations = stands.filter(s => s.status === 'RESERVED' || s.status === 'SOLD').length;
  
  y += 12;
  doc.setLineWidth(0.3);
  doc.setDrawColor(197, 160, 89);
  doc.line(20, y, 190, y);
  
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(197, 160, 89);
  doc.text('FINANCIAL SUMMARY', 20, y);
  
  y += 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  
  const summaryData = [
    { label: 'Total Contract Value:', value: `$${totalContractValue.toLocaleString()}` },
    { label: 'Total Paid to Date:', value: `$${totalPaid.toLocaleString()}` },
    { label: 'Outstanding Balance:', value: `$${outstandingBalance.toLocaleString()}` },
    { label: 'Properties Held:', value: `${activeReservations}` }
  ];
  
  summaryData.forEach(item => {
    doc.text(item.label, 25, y);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(197, 160, 89);
    doc.text(item.value, 185, y, { align: 'right' });
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(51, 51, 51);
    y += 6;
  });
  
  // Transaction History
  y += 8;
  doc.setLineWidth(0.3);
  doc.setDrawColor(197, 160, 89);
  doc.line(20, y, 190, y);
  
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(197, 160, 89);
  doc.text('TRANSACTION HISTORY', 20, y);
  y += 8;

  if (payments.length === 0) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('No transactions recorded.', 25, y);
  } else {
    // Table Headers
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(197, 160, 89);
    doc.text('Date', 25, y);
    doc.text('Reference', 60, y);
    doc.text('Description', 100, y);
    doc.text('Receipt', 145, y);
    doc.text('Amount', 190, y, { align: 'right' });
    
    y += 6;
    doc.setLineWidth(0.2);
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 51, 51);
    
    payments.forEach(payment => {
      if (y > 270) {
        doc.addPage();
        renderBrandedHeader(doc, branch);
        y = 60;
      }
      
      const paymentDate = payment.createdAt ? new Date(payment.createdAt) : new Date();
      const amount = payment.amountUsd || Number(payment.amount) || 0;
      const reference = payment.reference || payment.manualReceiptNo || 'N/A';
      const description = payment.description || payment.paymentType || 'Payment';
      const receiptNumber = (payment as any).receiptNumber || payment.manualReceiptNo || '-';
      
      doc.text(paymentDate.toLocaleDateString(), 25, y);
      doc.text(reference.substring(0, 12), 60, y);
      doc.text(description.substring(0, 25), 100, y);
      doc.text(receiptNumber.substring(0, 10), 145, y);
      doc.text(`$${amount.toLocaleString()}`, 190, y, { align: 'right' });
      y += 6;
    });
  }

  // Footer
  y = 280;
  doc.setLineWidth(0.3);
  doc.setDrawColor(197, 160, 89);
  doc.line(20, y, 190, y);
  
  y += 8;
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(197, 160, 89);
  doc.text('FINE & COUNTRY ZIMBABWE', 105, y, { align: 'center' });
  
  y += 5;
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Professional Real Estate Services | Residential & Commercial Properties', 105, y, { align: 'center' });
  
  y += 4;
  doc.text('This is a computer-generated statement. For inquiries, contact your branch office.', 105, y, { align: 'center' });
  
  y += 4;
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | Statement Valid as of: ${new Date().toLocaleDateString()}`, 105, y, { align: 'center' });

  downloadPDFBlob(doc, `Statement_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Generate Reservation Slip with property and client details
 */
export const generateReservationSlipPDF = (
  stand: Stand,
  client: Client,
  development: { name: string; branch: Branch }
) => {
  const doc = new jsPDF();
  renderBrandedHeader(doc, development.branch);

  // Reservation Title
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.text('PROPERTY RESERVATION CONFIRMATION', 105, 60, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Reference: ${stand.id}`, 105, 68, { align: 'center' });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 105, 74, { align: 'center' });

  // Property Details
  let y = 90;
  doc.setLineWidth(0.2);
  doc.line(20, y, 190, y);
  y += 8;
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Property Details', 20, y);
  y += 8;
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Development: ${development.name}`, 25, y);
  y += 6;
  doc.text(`Stand Number: ${stand.number}`, 25, y);
  y += 6;
  doc.text(`Area: ${stand.areaSqm || 'N/A'} sqm`, 25, y);
  y += 6;
  doc.text(`Price: $${stand.priceUsd.toLocaleString()} USD`, 25, y);
  y += 10;

  // Client Details
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Client Information', 20, y);
  y += 8;
  
  doc.setFont('Helvetica', 'normal');
  doc.text(`Name: ${client.name}`, 25, y);
  y += 6;
  doc.text(`Email: ${client.email}`, 25, y);
  y += 6;
  doc.text(`Phone: ${client.phone}`, 25, y);
  y += 10;

  // Terms & Conditions
  doc.line(20, y, 190, y);
  y += 8;
  doc.setFont('Helvetica', 'bold');
  doc.text('Reservation Terms', 20, y);
  y += 8;
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('• This reservation is valid for 14 days from the date of confirmation.', 25, y);
  y += 5;
  doc.text('• Full payment terms and refund policy apply as per development documentation.', 25, y);
  y += 5;
  doc.text('• Client must complete Agreement of Sale within the reservation period.', 25, y);
  y += 15;

  // Signature Lines
  doc.setLineWidth(0.2);
  doc.line(25, y, 85, y);
  doc.line(115, y, 175, y);
  y += 5;
  doc.setFontSize(7);
  doc.text('Client Signature', 25, y);
  doc.text('Authorized Officer', 115, y);
  const branchLabel = development.branch === 'Harare' ? 'Harare HQ' : 'Bulawayo Branch';
  y += 4;
  doc.text(`Date: _______________`, 25, y);
  doc.text(branchLabel, 115, y);

  downloadPDFBlob(doc, `Reservation_${stand.number}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Download legal document with proper .pdf extension using fetch-blob approach
 */
export const downloadLegalDocument = async (url: string, filename: string) => {
  try {
    console.log('[FORENSIC][LEGAL DOC DOWNLOAD] Starting...', { url, filename });
    
    // For mock URLs, create a placeholder PDF
    if (url.includes('mock-uploads')) {
      const doc = new jsPDF();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('LEGAL DOCUMENT', 105, 40, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('This is a mock legal document for demonstration purposes.', 105, 60, { align: 'center' });
      doc.text(`Document URL: ${url}`, 20, 80);
      doc.text(`Generated: ${new Date().toISOString()}`, 20, 90);
      
      downloadPDFBlob(doc, filename);
      return;
    }

    // For real URLs, fetch and download
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    console.log('[FORENSIC][LEGAL DOC DOWNLOAD] Success', { filename: link.download, size: blob.size });
  } catch (error) {
    console.error('[FORENSIC][LEGAL DOC DOWNLOAD] Error:', error);
    alert('Failed to download document. Please contact support.');
  }
};
