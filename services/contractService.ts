
import { jsPDF } from 'jspdf';
import { Client, Stand, Development, CompanySettings, ContractTemplate, DevelopmentDocument } from '../types';
import { BRANCH_SETTINGS } from '../lib/db';

/**
 * ContractService v4.2
 * Generates populated legal documents with the brand typeface standard.
 * Official Font: Plus Jakarta Sans (UI Proxy: Helvetica Bold for PDF Letterheads).
 * Language Polish: 'Yield' -> 'Payment/Interest'.
 */

export const populateTemplate = (template: string, data: Record<string, string>) => {
  let populated = template;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    populated = populated.replace(placeholder, value);
  });
  return populated;
};

export const generateAmortizationText = (price: number, deposit: number, months: number, interest: number) => {
  const principal = price - deposit;
  const installment = principal * (1 + (interest / 100)) / months; 

  let text = `INSTALLMENT SCHEDULE (AGGREGATE)\n\nTotal Principal: USD ${principal.toLocaleString()}\nDuration: ${months} Months\nInterest rate: ${interest}% APR\nMonthly Liability: USD ${installment.toFixed(2)}\n\n`;
  text += `Standard cycle: Fixed installments of USD ${installment.toFixed(2)} due on the 1st of each month.`;
  
  return text;
};

export const generateContractPDF = async (
  template: ContractTemplate, 
  client: Client, 
  stand: Stand, 
  dev: Development,
  branch: CompanySettings,
  bundleAnnexures: DevelopmentDocument[] = []
) => {
  const doc = new jsPDF();
  
  // Official Letterhead (Simulated with Helvetica Bold to match Plus Jakarta Sans weight)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(133, 117, 78); // fcGold
  doc.text('Fine & Country', 20, 25);
  
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42); // fcSlate
  doc.text('BRAND TYPEFACE: PLUS JAKARTA SANS | ZIMBABWE REGIONAL NETWORK', 20, 30);
  
  doc.setDrawColor(133, 117, 78);
  doc.setLineWidth(0.5);
  doc.line(20, 35, 190, 35);

  const dataMap = {
    client_name: client.name,
    client_id: client.id,
    stand_number: stand.number,
    development_name: dev.name,
    purchase_price: stand.priceUsd.toLocaleString(),
    legal_name: branch.legal_name,
    installment_plan_text: generateAmortizationText(
      stand.priceUsd, 
      dev.depositRequired, 
      dev.maxInstallments, 
      dev.interestRate
    )
  };

  const populatedBody = populateTemplate(template.content, dataMap);

  // Body Content: Plus Jakarta Sans Regular (Proxy: Helvetica)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  
  const splitText = doc.splitTextToSize(populatedBody, 170);
  doc.text(splitText, 20, 50);

  // Footer / Regulatory Manifest
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(240, 240, 240);
  doc.line(20, pageHeight - 30, 190, pageHeight - 30);
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Official System Standard: Plus Jakarta Sans | Version ${template.version}`, 20, pageHeight - 20);
  doc.text(`${branch.address} | CRN: ${branch.registration_number}`, 190, pageHeight - 20, { align: 'right' });

  // Seal of Authenticity
  doc.setDrawColor(133, 117, 78);
  doc.circle(170, pageHeight - 60, 12, 'D');
  doc.setFontSize(5);
  doc.text('F&C ZIM\nVALIDATED', 170, pageHeight - 60, { align: 'center' });

  if (bundleAnnexures.length > 0) {
    bundleAnnexures.forEach((annex, index) => {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(133, 117, 78);
      doc.text(`ANNEXURE ${index + 1}: ${annex.name}`, 20, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Statutory ID: ${annex.id} | Typeface: P.J.S. Standard`, 20, 40);
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 45, 190, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`[STATUTORY CONTENT STREAM ENCRYPTED]`, 20, 70);
      doc.text(`Development Node: ${dev.name}`, 20, 85);
      doc.text(`Asset Identifier: ${stand.number}`, 20, 95);
    });
  }

  const sanitizedClient = client.name.replace(/\s+/g, '_');
  const fileName = `${sanitizedClient}_${stand.number}_Agreement.pdf`;

  doc.save(fileName);
  return true;
};
