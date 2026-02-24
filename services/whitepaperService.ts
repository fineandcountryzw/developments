
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Branch } from '../types';
import { BRANCH_SETTINGS, logAudit } from '../lib/db';

/**
 * WhitepaperService v5.0 | "Executive Forensic" Edition
 * CTO-Level Technical Documentation for Fine & Country Zimbabwe ERP.
 * Standardized on Plus Jakarta Sans UX & Forensic Integrity.
 */

export const generateTechnicalWhitepaper = async (branch: Branch) => {
  const doc = new jsPDF();
  const settings = BRANCH_SETTINGS[branch];
  const timestamp = new Date().toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
  const generationId = `FC-VPC-DOC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const fcGold = [133, 117, 78]; // #85754E
  const fcSlate = [15, 23, 42];  // #0F172A
  const fcCream = [249, 248, 246];
  const fcMuted = [148, 163, 184];

  const drawSeal = (x: number, y: number, text: string) => {
    doc.setDrawColor(fcGold[0], fcGold[1], fcGold[2]);
    doc.setLineWidth(0.5);
    doc.circle(x, y, 15, 'D');
    doc.setFontSize(6);
    doc.setTextColor(fcGold[0], fcGold[1], fcGold[2]);
    doc.text(text, x, y, { align: 'center' });
  };

  const drawFooter = () => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(239, 236, 231); 
      doc.line(20, 280, 190, 280);
      doc.setFontSize(7);
      doc.setTextColor(fcMuted[0], fcMuted[1], fcMuted[2]);
      doc.text(`Fine & Country Zimbabwe ERP | National Property Settlement Node`, 20, 287);
      doc.text(`Doc ID: ${generationId} | Node: ${branch} | Page ${i} of ${pageCount}`, 190, 287, { align: 'right' });
    }
  };

  // --- PAGE 1: EXECUTIVE COVER ---
  doc.setFillColor(fcSlate[0], fcSlate[1], fcSlate[2]);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(fcGold[0], fcGold[1], fcGold[2]);
  doc.rect(20, 60, 2, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text('Fine & Country\nZimbabwe ERP', 30, 80);
  
  doc.setFontSize(10);
  doc.setTextColor(fcGold[0], fcGold[1], fcGold[2]);
  doc.text('TECHNICAL WHITE PAPER: NATIONAL PROPERTY SETTLEMENT ECOSYSTEM', 30, 115);
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const summary = "A sovereign property technology framework architected for forensic data integrity, automated multi-currency settlement, and regulatory transparency. Built on the digital standards of Fine & Country's executive network.";
  doc.text(doc.splitTextToSize(summary, 140), 30, 130);

  doc.setTextColor(fcMuted[0], fcMuted[1], fcMuted[2]);
  doc.setFontSize(9);
  doc.text(`FORENSIC GENERATION TIMESTAMP: ${timestamp}`, 30, 260);
  doc.text(`REGIONAL VPC CLUSTER: ${branch.toUpperCase()}`, 30, 267);
  
  drawSeal(170, 240, 'CERTIFIED\nGOLD\nSTANDARD');

  // --- PAGE 2: BRAND VISION & TECH STACK ---
  doc.addPage();
  doc.setTextColor(fcSlate[0], fcSlate[1], fcSlate[2]);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('01. Brand Vision & UX Philosophy', 20, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const brandVision = "The Fine & Country Zimbabwe ERP is the evolution of premium real estate management. By adopting Plus Jakarta Sans as the immutable system font, the ecosystem provides a high-fidelity 'Executive' experience that mirrors the trust and precision expected in multi-million dollar property transfers.";
  doc.text(doc.splitTextToSize(brandVision, 170), 20, 42);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('02. Technical Infrastructure', 20, 75);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const stackDesc = "Our architecture leverages a robust cloud-native stack designed for 99.99% uptime and regional data sovereignty within Zimbabwe.";
  doc.text(doc.splitTextToSize(stackDesc, 170), 20, 85);

  (doc as any).autoTable({
    startY: 95,
    head: [['Component', 'Technology', 'Role']],
    body: [
      ['Database', 'PostgreSQL (Neon)', 'Immutable Forensic Storage'],
      ['Frontend', 'React / TypeScript', 'High-Fidelity Interaction Layer'],
      ['Automation', 'Resend Email API', 'CRON Reporting & Email Stack'],
      ['Fintech', 'Paynow Integration', 'Real-time Payment Verification'],
      ['Security', 'JWT & Row Level Security', 'Statutory Data Access Walls'],
      ['Typography', 'Plus Jakarta Sans', 'Official Brand Typeface']
    ],
    theme: 'grid',
    headStyles: { fillColor: fcGold, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 4 }
  });

  // --- PAGE 3: FINANCIAL HUB & FORENSICS ---
  doc.addPage();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('03. Financial Hub & Settlement Engine', 20, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const financeDesc = "The ERP handles complex settlement logic across multiple currency streams (Nostro, RTGS, Cash). The Paynow Fintech Node ensures that every digital transaction is verified in real-time, triggering automated legal receipting and ledger updates.";
  doc.text(doc.splitTextToSize(financeDesc, 170), 20, 42);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Automated Reconciliation logic:', 20, 65);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text([
    '• Automated grouping of yields by Development Node.',
    '• Real-time split calculation (Agent Commission vs. Developer Net).',
    '• CRON-scheduled Monday 08:00 CAT broadcast of financial manifests.',
    '• PDF Forensic Integrity Seals with unique temporal Pulse IDs.'
  ], 25, 75);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('04. The "Pulse" Forensic Module', 20, 110);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const pulseDesc = "Integrity is enforced via the global_forensic_log. Every mutation—from a stand price change to a user role upgrade—is forensically logged with a 256-bit hash, IP fingerprint, and temporal signature. This ensures a 'Never Forget' database state that is audit-ready for regulatory bodies.";
  doc.text(doc.splitTextToSize(pulseDesc, 170), 20, 122);

  // --- PAGE 4: STAKEHOLDER PORTALS ---
  doc.addPage();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('05. Stakeholder Portals & RLS Architecture', 20, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const rlsDesc = "Row Level Security (RLS) acts as a 'Data Wall' within the PostgreSQL kernel. Access is strictly compartmentalized based on personnel role and regional node assignment.";
  doc.text(doc.splitTextToSize(rlsDesc, 170), 20, 42);

  (doc as any).autoTable({
    startY: 60,
    head: [['Role', 'Access Tier', 'Core Functionality']],
    body: [
      ['Private Client', 'Restricted Portfolio', 'Payment Tracking, MoA Vault, Progress Stepper'],
      ['Agency Agent', 'Inventory & Clients', 'Stand Reservations, Client Onboarding, Deal Notes'],
      ['Branch Manager', 'Regional Analytics', 'Revenue Monitoring, Staff KPI Tracking, Settlement Approval'],
      ['Admin', 'Full VPC Control', 'System Branding, RBAC, Forensic Audit, Global Settings']
    ],
    theme: 'grid',
    headStyles: { fillColor: fcSlate, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 5 }
  });

  drawSeal(105, 220, 'BRAND\nAPPROVED');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TECHNICAL ENDORSEMENT', 105, 245, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('This white paper serves as the official technical manual for the Fine & Country Zimbabwe ERP ecosystem.', 105, 252, { align: 'center' });

  drawFooter();
  doc.save(`FC_Zimbabwe_Technical_Whitepaper_${branch}.pdf`);

  await logAudit({
    userId: 'system',
    action: 'GENERATE_WHITEPAPER',
    entity: 'system_branding',
    entityId: generationId,
    metadata: {
      version: '5.0',
      edition: 'Forensic',
      branch,
      action_summary: `Technical White Paper Generated: Version 5.0 (Forensic Edition) for ${branch}.`
    }
  });
};
