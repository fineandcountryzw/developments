
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Branch, Development } from '../types';
import { BRANCH_SETTINGS } from '../lib/db';

/**
 * ChecklistService v1.0
 * Generates the "Development Readiness Checklist" PDF.
 * Adheres to Fine & Country Zimbabwe Executive Branding Standards.
 */

const FC_GOLD = [133, 117, 78]; // #85754E
const FC_SLATE = [15, 23, 42]; // #0F172A

export const generateReadinessChecklist = async (branch: Branch, dev?: Partial<Development>) => {
  const doc = new jsPDF();
  const settings = BRANCH_SETTINGS[branch];
  const timestamp = new Date().toLocaleString('en-GB');
  const checklistId = `FC-READINESS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Helper: Draw Gold Checkbox
  const drawCheckbox = (x: number, y: number) => {
    doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
    doc.setLineWidth(0.5);
    doc.rect(x, y, 4, 4, 'D');
  };

  // 1. Header Section
  doc.setFillColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DEVELOPMENT READINESS CHECKLIST', 20, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('STATUTORY REQUIREMENTS & FORENSIC ONBOARDING PROTOCOL', 20, 30);

  // Logo Placeholder (Top Right)
  doc.setDrawColor(255, 255, 255);
  doc.rect(170, 8, 25, 25, 'D');
  doc.setFontSize(10);
  doc.text('F&C', 182.5, 20, { align: 'center' });
  doc.setFontSize(6);
  doc.text('ZIMBABWE', 182.5, 24, { align: 'center' });

  // 2. Metadata Section
  let currentY = 55;
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Development Node: ${dev?.name || 'NEW PROJECT PENDING'}`, 20, currentY);
  doc.text(`Regional Cluster: ${branch.toUpperCase()}`, 190, currentY, { align: 'right' });
  
  currentY += 10;
  doc.setDrawColor(FC_GOLD[0], FC_GOLD[1], FC_GOLD[2]);
  doc.setLineWidth(1.5);
  doc.line(20, currentY, 40, currentY);
  
  currentY += 15;

  // --- SECTION A: LEGAL & COMPLIANCE ---
  doc.setFontSize(14);
  doc.text('Section A: Legal & Compliance (Mandatory)', 20, currentY);
  currentY += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const legalItems = [
    'Certified Copy of Parent Deed',
    'Valid Subdivision Permit',
    'Environmental Management Agency (EMA) Clearance',
    'Certificate of Compliance (if applicable)'
  ];

  legalItems.forEach(item => {
    drawCheckbox(20, currentY - 3.5);
    doc.text(item, 28, currentY);
    currentY += 10;
  });

  currentY += 10;

  // --- SECTION B: TECHNICAL & SPATIAL DATA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Section B: Technical & Spatial Data', 20, currentY);
  currentY += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const technicalItems = [
    "Approved General Plan (Surveyor General's Copy)",
    "GeoJSON or AutoCAD file of Stand Boundaries",
    "Infrastructure Progress Report (Roads, Water, Sewer, Power)"
  ];

  technicalItems.forEach(item => {
    drawCheckbox(20, currentY - 3.5);
    doc.text(item, 28, currentY);
    currentY += 10;
  });

  currentY += 10;

  // --- SECTION C: MARKETING & VISION ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Section C: Marketing & Vision', 20, currentY);
  currentY += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const marketingItems = [
    "300-word Development Overview (Project Narrative)",
    "Minimum of 5 Investment Highlights (e.g., Security, Solar, Amenities)",
    "High-resolution Site Site-plan and 3D Renders"
  ];

  marketingItems.forEach(item => {
    drawCheckbox(20, currentY - 3.5);
    doc.text(item, 28, currentY);
    currentY += 10;
  });

  // 3. Digital Integration & QR
  const qrY = 240;
  doc.setDrawColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.setLineWidth(0.2);
  doc.rect(160, qrY, 30, 30, 'D'); // QR Placeholder
  
  // Fake QR pattern
  doc.setFillColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  for(let i=0; i<5; i++) {
    for(let j=0; j<5; j++) {
      if(Math.random() > 0.4) doc.rect(162 + (i*5.5), qrY + 2 + (j*5.5), 4, 4, 'F');
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(FC_SLATE[0], FC_SLATE[1], FC_SLATE[2]);
  doc.text('UPLOAD PORTAL ACCESS', 190, qrY + 36, { align: 'right' });
  doc.setFontSize(7);
  doc.text('Link ID: ' + checklistId, 190, qrY + 41, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('OFFICIAL SUBMISSION INSTRUCTIONS:', 20, qrY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const instr = "Scan the QR code to access your development-specific secure vault. Ensure all documents are in PDF format (max 20MB per file). Data is processed through our forensic VPC layer.";
  doc.text(doc.splitTextToSize(instr, 130), 20, qrY + 12);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(239, 236, 231);
  doc.line(20, pageHeight - 15, 190, pageHeight - 15);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Fine & Country Zimbabwe ERP | Forensic Readiness Manifest', 20, pageHeight - 10);
  doc.text('This checklist ensures all data complies with the Fine & Country Forensic Pulse audit standard.', 190, pageHeight - 10, { align: 'right' });

  doc.save(`FNC_Readiness_Checklist_${dev?.name?.replace(/\s+/g, '_') || 'Generic'}.pdf`);
};
