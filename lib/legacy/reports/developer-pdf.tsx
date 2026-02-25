/**
 * Developer Report PDF Generation
 * 
 * Uses @react-pdf/renderer to generate professional PDF reports.
 */

'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Font,
} from '@react-pdf/renderer';
import { DeveloperReportData, formatCurrency, formatDate } from './developer-report-data';

// Register fonts if needed
// Font.register({
//   family: 'Helvetica',
//   fonts: [
//     { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica.ttf' },
//     { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica-Bold.ttf', fontWeight: 'bold' },
//   ],
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    borderBottom: '2pt solid #C5A028',
    paddingBottom: 20,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C5A028',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#C5A028',
    color: 'white',
    padding: 8,
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoItem: {
    width: '48%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '31%',
    border: '1pt solid #ddd',
    padding: 10,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C5A028',
  },
  table: {
    width: '100%',
    border: '1pt solid #ddd',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1pt solid #ddd',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #eee',
    padding: 6,
  },
  tableCell: {
    flex: 1,
    fontSize: 8,
  },
  tableCellSmall: {
    flex: 0.5,
    fontSize: 8,
  },
  tableCellLarge: {
    flex: 2,
    fontSize: 8,
  },
  statusBadge: {
    padding: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  statusAvailable: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusPaidUp: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusOnTrack: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  statusOverdue: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  statusNoAgreement: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusNoClient: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C5A028',
    borderRadius: 4,
  },
  alertBox: {
    backgroundColor: '#fee2e2',
    border: '1pt solid #ef4444',
    padding: 10,
    marginVertical: 10,
  },
  alertText: {
    color: '#991b1b',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1pt solid #ddd',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#666',
  },
  coverPage: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C5A028',
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  coverDeveloper: {
    fontSize: 20,
    marginBottom: 20,
    color: '#666',
    textAlign: 'center',
  },
  coverInfo: {
    fontSize: 12,
    color: '#666',
    marginVertical: 5,
  },
  coverDivider: {
    width: 100,
    height: 2,
    backgroundColor: '#C5A028',
    marginVertical: 30,
  },
  coverContact: {
    fontSize: 10,
    color: '#666',
    marginVertical: 3,
    textAlign: 'center',
  },
  confidential: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 40,
    padding: 10,
    border: '1pt solid #999',
  },
});

interface DeveloperReportPDFProps {
  data: DeveloperReportData;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'AVAILABLE': return styles.statusAvailable;
    case 'SOLD_PAID_UP': return styles.statusPaidUp;
    case 'SOLD_ON_TRACK': return styles.statusOnTrack;
    case 'SOLD_OVERDUE': return styles.statusOverdue;
    case 'SOLD_NO_AGREEMENT': return styles.statusNoAgreement;
    case 'SOLD_NO_CLIENT': return styles.statusNoClient;
    default: return styles.statusNoClient;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'AVAILABLE': return 'Available';
    case 'SOLD_PAID_UP': return 'Paid Up';
    case 'SOLD_ON_TRACK': return 'On Track';
    case 'SOLD_OVERDUE': return 'Overdue';
    case 'SOLD_NO_AGREEMENT': return 'No Agreement';
    case 'SOLD_NO_CLIENT': return 'No Client';
    default: return status;
  }
}

// Cover Page
function CoverPage({ data }: DeveloperReportPDFProps) {
  const periodText = data.reportPeriod.type === 'ALL_TIME' 
    ? 'All Time' 
    : data.reportPeriod.type === 'THIS_MONTH'
    ? 'This Month'
    : `${formatDate(data.reportPeriod.from)} - ${formatDate(data.reportPeriod.to)}`;

  return (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.coverLogo}>Fine & Country Zimbabwe</Text>
      <View style={styles.coverDivider} />
      <Text style={styles.coverTitle}>DEVELOPER PORTFOLIO REPORT</Text>
      <Text style={styles.coverDeveloper}>{data.developerName}</Text>
      <Text style={styles.coverInfo}>Period: {periodText}</Text>
      <Text style={styles.coverInfo}>Generated: {formatDate(data.generatedAt)}</Text>
      <Text style={styles.coverInfo}>Prepared by: {data.generatedBy}</Text>
      
      <View style={styles.coverDivider} />
      
      <Text style={styles.coverContact}>Natasha Mugabe</Text>
      <Text style={styles.coverContact}>Principal Real Estate Agent</Text>
      <Text style={styles.coverContact}>Fine & Country Zimbabwe</Text>
      <Text style={styles.coverContact}>15 Nigels Lane, Borrowdale, Harare</Text>
      <Text style={styles.coverContact}>08644 253731</Text>
      
      <Text style={styles.confidential}>CONFIDENTIAL</Text>
    </Page>
  );
}

// Executive Summary Page
function ExecutiveSummaryPage({ data }: DeveloperReportPDFProps) {
  const { summary } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Developer Portfolio Report</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
            <Text style={styles.subtitle}>{formatDate(data.generatedAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Stands in Portfolio</Text>
            <Text style={styles.statValue}>{summary.totalStands}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Stands Sold</Text>
            <Text style={styles.statValue}>{summary.soldStands}</Text>
            <Text style={{ fontSize: 8, color: '#666' }}>
              {summary.totalStands > 0 ? Math.round((summary.soldStands / summary.totalStands) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Stands Available</Text>
            <Text style={styles.statValue}>{summary.availableStands}</Text>
            <Text style={{ fontSize: 8, color: '#666' }}>
              {summary.totalStands > 0 ? Math.round((summary.availableStands / summary.totalStands) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Portfolio Value</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.totalPortfolioValue)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Collected to Date</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.totalCollected)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Outstanding</Text>
            <Text style={styles.statValue}>{formatCurrency(summary.totalOutstanding)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5 }}>
            Collection Rate: {summary.collectionRate.toFixed(1)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(summary.collectionRate, 100)}%` }]} />
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>Key Metrics</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Clients With Agreements</Text>
              <Text style={styles.infoValue}>
                {summary.clientsWithAgreements} of {summary.soldStands} 
                ({summary.soldStands > 0 ? Math.round((summary.clientsWithAgreements / summary.soldStands) * 100) : 0}%)
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Clients Without Agreements</Text>
              <Text style={[styles.infoValue, { color: summary.clientsWithoutAgreements > 0 ? '#dc2626' : '#166534' }]}>
                {summary.clientsWithoutAgreements}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Overdue Accounts</Text>
              <Text style={[styles.infoValue, { color: summary.overdueAccounts > 0 ? '#dc2626' : '#166534' }]}>
                {summary.overdueAccounts}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Overdue Amount</Text>
              <Text style={[styles.infoValue, { color: summary.overdueAmount > 0 ? '#dc2626' : '#166534' }]}>
                {formatCurrency(summary.overdueAmount)}
              </Text>
            </View>
          </View>
        </View>

        {summary.overdueAccounts > 0 && (
          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              ⚠️ Action Required: {summary.overdueAccounts} accounts are currently overdue.
            </Text>
          </View>
        )}

        {summary.clientsWithoutAgreements > 0 && (
          <View style={[styles.alertBox, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Text style={[styles.alertText, { color: '#92400e' }]}>
              ⚠️ Action Required: {summary.clientsWithoutAgreements} clients do not have signed agreements.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare</Text>
        <Text>Page 1</Text>
      </View>
    </Page>
  );
}

// Stands Table Page
function StandsPage({ data }: DeveloperReportPDFProps) {
  const stands = data.stands.slice(0, 25); // Limit to 25 per page
  
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Stands Breakdown</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STANDS BREAKDOWN</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellSmall}>Stand #</Text>
            <Text style={styles.tableCell}>Development</Text>
            <Text style={styles.tableCellSmall}>Size</Text>
            <Text style={styles.tableCell}>Price</Text>
            <Text style={styles.tableCellSmall}>Status</Text>
            <Text style={styles.tableCell}>Client</Text>
            <Text style={styles.tableCellSmall}>Paid</Text>
            <Text style={styles.tableCellSmall}>Outstanding</Text>
          </View>
          
          {stands.map((stand, i) => (
            <View key={stand.id} style={styles.tableRow}>
              <Text style={styles.tableCellSmall}>{stand.standNumber}</Text>
              <Text style={styles.tableCell}>{stand.developmentName}</Text>
              <Text style={styles.tableCellSmall}>
                {stand.sizeSqm ? `${stand.sizeSqm} sqm` : 'N/A'}
              </Text>
              <Text style={styles.tableCell}>{formatCurrency(stand.price)}</Text>
              <View style={styles.tableCellSmall}>
                <Text style={[styles.statusBadge, getStatusStyle(stand.status)]}>
                  {getStatusLabel(stand.status)}
                </Text>
              </View>
              <Text style={styles.tableCell}>{stand.clientName || 'N/A'}</Text>
              <Text style={styles.tableCellSmall}>{formatCurrency(stand.totalPaid)}</Text>
              <Text style={styles.tableCellSmall}>{formatCurrency(stand.outstanding)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 15, padding: 10, backgroundColor: '#f9fafb', border: '1pt solid #e5e7eb' }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold' }}>
            Totals: {data.stands.length} stands | 
            Portfolio Value: {formatCurrency(data.summary.totalPortfolioValue)} | 
            Collected: {formatCurrency(data.summary.totalCollected)} | 
            Outstanding: {formatCurrency(data.summary.totalOutstanding)}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare</Text>
        <Text>Page 2</Text>
      </View>
    </Page>
  );
}

// Collections Analysis Page
function CollectionsPage({ data }: DeveloperReportPDFProps) {
  const { collections } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Collections Analysis</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COLLECTION ANALYSIS</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Expected Total Revenue</Text>
            <Text style={styles.statValue}>{formatCurrency(collections.expectedRevenue)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Collected So Far</Text>
            <Text style={styles.statValue}>{formatCurrency(collections.totalCollected)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Outstanding</Text>
            <Text style={styles.statValue}>{formatCurrency(collections.totalOutstanding)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 15 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 5 }}>
            Collection Rate: {collections.collectionRate.toFixed(1)}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(collections.collectionRate, 100)}%` }]} />
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>Payment Type Breakdown</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Deposits Collected</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(collections.paymentTypeBreakdown.deposits.amount)} 
                ({collections.paymentTypeBreakdown.deposits.count} payments)
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Installments Collected</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(collections.paymentTypeBreakdown.installments.amount)} 
                ({collections.paymentTypeBreakdown.installments.count} payments)
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Legal Fees Collected</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(collections.paymentTypeBreakdown.legalFees.amount)} 
                ({collections.paymentTypeBreakdown.legalFees.count} payments)
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Other Payments</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(collections.paymentTypeBreakdown.other.amount)} 
                ({collections.paymentTypeBreakdown.other.count} payments)
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>
            Monthly Collections (Last 12 Months)
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Month</Text>
              <Text style={styles.tableCell}>Payment Count</Text>
              <Text style={styles.tableCell}>Amount Collected</Text>
              <Text style={styles.tableCell}>Cumulative Total</Text>
            </View>
            {collections.monthlyCollections.slice(-6).map((month, i) => (
              <View key={month.month} style={styles.tableRow}>
                <Text style={styles.tableCell}>{month.monthLabel}</Text>
                <Text style={styles.tableCell}>{month.paymentCount}</Text>
                <Text style={styles.tableCell}>{formatCurrency(month.amountCollected)}</Text>
                <Text style={styles.tableCell}>{formatCurrency(month.cumulativeTotal)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare</Text>
        <Text>Page 3</Text>
      </View>
    </Page>
  );
}

// Agreements Page
function AgreementsPage({ data }: DeveloperReportPDFProps) {
  const { agreements } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Agreement Status</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AGREEMENT STATUS</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Sold Stands</Text>
            <Text style={styles.statValue}>{agreements.totalSold}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Has Signed Agreement</Text>
            <Text style={[styles.statValue, { color: '#166534' }]}>
              {agreements.hasAgreement} ({agreements.totalSold > 0 ? Math.round((agreements.hasAgreement / agreements.totalSold) * 100) : 0}%)
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>No Agreement on File</Text>
            <Text style={[styles.statValue, { color: agreements.noAgreement > 0 ? '#dc2626' : '#166534' }]}>
              {agreements.noAgreement} ({agreements.totalSold > 0 ? Math.round((agreements.noAgreement / agreements.totalSold) * 100) : 0}%)
            </Text>
          </View>
        </View>

        {agreements.clientsWithoutAgreements.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10, color: '#dc2626' }}>
              ⚠️ CLIENTS WITHOUT AGREEMENTS - ACTION REQUIRED
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellSmall}>Stand #</Text>
                <Text style={styles.tableCell}>Client Name</Text>
                <Text style={styles.tableCellSmall}>Sale Date</Text>
                <Text style={styles.tableCellSmall}>Days Since</Text>
                <Text style={styles.tableCellSmall}>Price</Text>
                <Text style={styles.tableCell}>Agent</Text>
              </View>
              {agreements.clientsWithoutAgreements.slice(0, 15).map((client, i) => (
                <View key={client.standId} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall}>{client.standNumber}</Text>
                  <Text style={styles.tableCell}>{client.clientName}</Text>
                  <Text style={styles.tableCellSmall}>
                    {client.saleDate ? formatDate(client.saleDate) : 'N/A'}
                  </Text>
                  <Text style={[styles.tableCellSmall, { color: (client.daysSinceSale || 0) > 30 ? '#dc2626' : '#000' }]}>
                    {client.daysSinceSale || 'N/A'}
                  </Text>
                  <Text style={styles.tableCellSmall}>{formatCurrency(client.purchasePrice)}</Text>
                  <Text style={styles.tableCell}>{client.agentName || 'N/A'}</Text>
                </View>
              ))}
            </View>
            {agreements.clientsWithoutAgreements.length > 15 && (
              <Text style={{ fontSize: 8, color: '#666', marginTop: 10 }}>
                ... and {agreements.clientsWithoutAgreements.length - 15} more clients without agreements
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare</Text>
        <Text>Page 4</Text>
      </View>
    </Page>
  );
}

// Overdue Accounts Page
function OverduePage({ data }: DeveloperReportPDFProps) {
  const { overdue } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Overdue Accounts</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OVERDUE ACCOUNTS</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Overdue Clients</Text>
            <Text style={[styles.statValue, { color: overdue.totalOverdue > 0 ? '#dc2626' : '#166534' }]}>
              {overdue.totalOverdue}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Overdue Amount</Text>
            <Text style={[styles.statValue, { color: overdue.totalOverdueAmount > 0 ? '#dc2626' : '#166534' }]}>
              {formatCurrency(overdue.totalOverdueAmount)}
            </Text>
          </View>
        </View>

        {overdue.accounts.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10, color: '#dc2626' }}>
              ⚠️ OVERDUE ACCOUNTS - URGENT ACTION REQUIRED
            </Text>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 10 }}>
              Sorted by most critical (days overdue)
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellSmall}>Stand #</Text>
                <Text style={styles.tableCell}>Client</Text>
                <Text style={styles.tableCellSmall}>Last Payment</Text>
                <Text style={styles.tableCellSmall}>Days Overdue</Text>
                <Text style={styles.tableCellSmall}>Overdue Amt</Text>
                <Text style={styles.tableCellSmall}>Total Out.</Text>
                <Text style={styles.tableCell}>Agent</Text>
              </View>
              {overdue.accounts.slice(0, 15).map((account, i) => (
                <View key={account.standId} style={styles.tableRow}>
                  <Text style={styles.tableCellSmall}>{account.standNumber}</Text>
                  <Text style={styles.tableCell}>{account.clientName}</Text>
                  <Text style={styles.tableCellSmall}>
                    {account.lastPaymentDate ? formatDate(account.lastPaymentDate) : 'Never'}
                  </Text>
                  <Text style={[styles.tableCellSmall, { color: account.daysSinceLastPayment > 90 ? '#dc2626' : '#f59e0b' }]}>
                    {account.daysSinceLastPayment}
                  </Text>
                  <Text style={styles.tableCellSmall}>{formatCurrency(account.amountOverdue)}</Text>
                  <Text style={styles.tableCellSmall}>{formatCurrency(account.totalOutstanding)}</Text>
                  <Text style={styles.tableCell}>{account.agentName || 'N/A'}</Text>
                </View>
              ))}
            </View>
            {overdue.accounts.length > 15 && (
              <Text style={{ fontSize: 8, color: '#666', marginTop: 10 }}>
                ... and {overdue.accounts.length - 15} more overdue accounts
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare</Text>
        <Text>Page 5</Text>
      </View>
    </Page>
  );
}

// Agent Performance Page
function AgentsPage({ data }: DeveloperReportPDFProps) {
  const { agents } = data;
  
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logoText}>Fine & Country Zimbabwe</Text>
            <Text style={styles.subtitle}>Agent Performance</Text>
          </View>
          <View>
            <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{data.developerName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AGENT PERFORMANCE</Text>
        <Text style={{ fontSize: 9, color: '#666', marginBottom: 10 }}>
          Within this developer's portfolio only
        </Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCell}>Agent Code</Text>
            <Text style={styles.tableCellSmall}>Stands Sold</Text>
            <Text style={styles.tableCell}>Total Value</Text>
            <Text style={styles.tableCell}>Collected</Text>
            <Text style={styles.tableCellSmall}>Rate</Text>
            <Text style={styles.tableCellSmall}>Agreements</Text>
            <Text style={styles.tableCellSmall}>Overdue</Text>
          </View>
          {agents.sort((a, b) => b.totalCollected - a.totalCollected).map((agent, i) => (
            <View key={agent.agentCode || i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{agent.agentCode || 'Unknown'}</Text>
              <Text style={styles.tableCellSmall}>{agent.standsSold}</Text>
              <Text style={styles.tableCell}>{formatCurrency(agent.totalValue)}</Text>
              <Text style={styles.tableCell}>{formatCurrency(agent.totalCollected)}</Text>
              <Text style={[styles.tableCellSmall, { 
                color: agent.collectionRate >= 70 ? '#166534' : agent.collectionRate >= 40 ? '#f59e0b' : '#dc2626' 
              }]}>
                {agent.collectionRate.toFixed(1)}%
              </Text>
              <Text style={styles.tableCellSmall}>{agent.agreementsSigned}</Text>
              <Text style={[styles.tableCellSmall, { color: agent.overdueAccounts > 0 ? '#dc2626' : '#166534' }]}>
                {agent.overdueAccounts}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Fine & Country Zimbabwe | 15 Nigels Lane, Borrowdale, Harare | 08644 253731</Text>
        <Text>Page 6</Text>
      </View>
    </Page>
  );
}

// Main Document
export function DeveloperReportDocument({ data }: DeveloperReportPDFProps) {
  return (
    <Document>
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} />
      <StandsPage data={data} />
      <CollectionsPage data={data} />
      <AgreementsPage data={data} />
      <OverduePage data={data} />
      <AgentsPage data={data} />
    </Document>
  );
}

// Generate PDF blob
export async function generateDeveloperPDF(data: DeveloperReportData): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  return pdf(<DeveloperReportDocument data={data} />).toBlob();
}

// PDF Download Link Component
export function DeveloperPDFDownloadLink({ 
  data, 
  filename,
  children 
}: { 
  data: DeveloperReportData; 
  filename: string;
  children: React.ReactNode;
}) {
  return (
    <PDFDownloadLink 
      document={<DeveloperReportDocument data={data} />} 
      fileName={filename}
    >
      {children}
    </PDFDownloadLink>
  );
}
