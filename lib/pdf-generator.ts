import puppeteer from 'puppeteer';

interface StatementData {
  standNumber: string;
  developmentName: string;
  branch: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  standPrice: number;
  totalPaid: number;
  balance: number;
  payments: Array<{
    date: string;
    amount: number;
    method: string;
    reference: string;
  }>;
  installments: Array<{
    number: number;
    dueDate: string;
    amountDue: number;
    amountPaid: number;
    status: string;
  }>;
  generatedAt: string;
}

interface ReceiptData {
  receiptNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  method: string;
  description: string;
  standNumber?: string;
  developmentName?: string;
  receivedBy: string;
  date: string;
}

interface ReportData {
  title: string;
  branch: string;
  generatedAt: string;
  headers: string[];
  data: Record<string, unknown>[];
}

interface ContractData {
  id: string;
  templateName: string;
  clientName: string;
  standNumber?: string;
  developmentName?: string;
  htmlContent: string;  // The full HTML content with styling
  status: string;
  createdAt: string;
  signedAt?: string;
  signedBy?: string;
}

export async function generatePDF(
  type: 'statement' | 'receipt' | 'report' | 'contract',
  data: StatementData | ReceiptData | ReportData | ContractData
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    let htmlContent: string;

    if (type === 'statement') {
      htmlContent = generateStatementHTML(data as StatementData);
    } else if (type === 'receipt') {
      htmlContent = generateReceiptHTML(data as ReceiptData);
    } else if (type === 'report') {
      htmlContent = generateReportHTML(data as ReportData);
    } else if (type === 'contract') {
      htmlContent = (data as ContractData).htmlContent;  // Use pre-generated HTML
    } else {
      throw new Error(`Unknown PDF type: ${type}`);
    }

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function generateStatementHTML(data: StatementData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #B8860B; padding-bottom: 20px; }
        .header h1 { color: #B8860B; font-size: 28px; margin-bottom: 5px; }
        .header p { color: #666; font-size: 14px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 18px; font-weight: bold; color: #B8860B; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { display: flex; flex-direction: column; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .info-value { font-size: 14px; font-weight: 600; }
        .summary-box { background: #f9f9f9; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
        .summary-item { padding: 10px; }
        .summary-label { font-size: 12px; color: #666; margin-bottom: 5px; }
        .summary-value { font-size: 20px; font-weight: bold; color: #B8860B; }
        .summary-value.balance { color: ${data.balance > 0 ? '#dc2626' : '#16a34a'}; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #B8860B; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        td { padding: 10px 12px; border-bottom: 1px solid #ddd; font-size: 13px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .status-paid { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-overdue { background: #fee2e2; color: #991b1b; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Client Statement</h1>
        <p>Fine & Country Zimbabwe - ${data.branch} Branch</p>
        <p style="margin-top: 10px; font-size: 12px;">Generated on ${formatDate(data.generatedAt)}</p>
      </div>

      <div class="section">
        <div class="section-title">Stand Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Stand Number</span>
            <span class="info-value">${data.standNumber}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Development</span>
            <span class="info-value">${data.developmentName}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Client Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Name</span>
            <span class="info-value">${data.clientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Email</span>
            <span class="info-value">${data.clientEmail || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Phone</span>
            <span class="info-value">${data.clientPhone || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Payment Summary</div>
        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Stand Price</div>
              <div class="summary-value">${formatCurrency(data.standPrice)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value">${formatCurrency(data.totalPaid)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Balance</div>
              <div class="summary-value balance">${formatCurrency(data.balance)}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Payment History</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Method</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.payments.map(payment => `
              <tr>
                <td>${formatDate(payment.date)}</td>
                <td>${payment.reference}</td>
                <td>${payment.method}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency(payment.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${data.installments.length > 0 ? `
      <div class="section">
        <div class="section-title">Installment Schedule</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th style="text-align: right;">Amount Due</th>
              <th style="text-align: right;">Amount Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.installments.map(inst => `
              <tr>
                <td>${inst.number}</td>
                <td>${formatDate(inst.dueDate)}</td>
                <td style="text-align: right;">${formatCurrency(inst.amountDue)}</td>
                <td style="text-align: right;">${formatCurrency(inst.amountPaid)}</td>
                <td><span class="status status-${inst.status.toLowerCase()}">${inst.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="footer">
        <p>This statement is generated electronically and is valid without signature.</p>
        <p style="margin-top: 5px;">For inquiries, please contact your branch office.</p>
      </div>
    </body>
    </html>
  `;
}

function generateReceiptHTML(data: ReceiptData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #B8860B; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #B8860B; font-size: 32px; margin-bottom: 5px; }
        .header p { color: #666; font-size: 14px; }
        .receipt-number { text-align: center; background: #B8860B; color: white; padding: 10px; margin: 20px 0; font-size: 18px; font-weight: bold; }
        .amount-box { text-align: center; background: #f9f9f9; border: 2px solid #B8860B; padding: 30px; margin: 20px 0; }
        .amount-label { font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
        .amount-value { font-size: 48px; font-weight: bold; color: #B8860B; }
        .details { margin: 30px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { color: #666; font-size: 14px; }
        .detail-value { font-weight: 600; font-size: 14px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        .stamp { text-align: center; margin-top: 30px; }
        .stamp-box { display: inline-block; border: 3px solid #16a34a; color: #16a34a; padding: 10px 30px; font-size: 18px; font-weight: bold; text-transform: uppercase; transform: rotate(-5deg); }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>OFFICIAL RECEIPT</h1>
          <p>Fine & Country Zimbabwe</p>
        </div>

        <div class="receipt-number">
          Receipt No: ${data.receiptNumber}
        </div>

        <div class="amount-box">
          <div class="amount-label">Amount Received</div>
          <div class="amount-value">${formatCurrency(data.amount)}</div>
        </div>

        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${formatDate(data.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Received From</span>
            <span class="detail-value">${data.clientName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">${data.method}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${data.description}</span>
          </div>
          ${data.standNumber ? `
          <div class="detail-row">
            <span class="detail-label">Stand Number</span>
            <span class="detail-value">${data.standNumber}</span>
          </div>
          ` : ''}
          ${data.developmentName ? `
          <div class="detail-row">
            <span class="detail-label">Development</span>
            <span class="detail-value">${data.developmentName}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Received By</span>
            <span class="detail-value">${data.receivedBy}</span>
          </div>
        </div>

        <div class="stamp">
          <div class="stamp-box">PAID</div>
        </div>

        <div class="footer">
          <p>Thank you for your payment!</p>
          <p style="margin-top: 10px;">This is an official receipt issued by Fine & Country Zimbabwe.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateReportHTML(data: ReportData): string {
  const formatCurrency = (amount: unknown) => {
    if (typeof amount === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return String(amount);
  };

  const formatValue = (value: unknown, header: string) => {
    if (header.toLowerCase().includes('amount') || header.toLowerCase().includes('price')) {
      return formatCurrency(value);
    }
    return String(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #B8860B; padding-bottom: 20px; }
        .header h1 { color: #B8860B; font-size: 28px; margin-bottom: 5px; }
        .header .branch { color: #666; font-size: 16px; margin-top: 5px; }
        .header .date { color: #999; font-size: 12px; margin-top: 10px; }
        .summary { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .summary p { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #B8860B; color: white; padding: 12px 8px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 600; }
        td { padding: 10px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.title}</h1>
        <p class="branch">Fine & Country Zimbabwe - ${data.branch} Branch</p>
        <p class="date">Generated on ${formatDate(data.generatedAt)}</p>
      </div>

      <div class="summary">
        <p><strong>Total Records:</strong> ${data.data.length}</p>
      </div>

      <table>
        <thead>
          <tr>
            ${data.headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.data.map((row, index) => `
            <tr>
              ${data.headers.map(header => `<td>${formatValue(row[header], header)}</td>`).join('')}
            </tr>
            ${(index + 1) % 25 === 0 && index !== data.data.length - 1 ? '<tr class="page-break"></tr>' : ''}
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>This report is generated electronically and is valid without signature.</p>
        <p style="margin-top: 5px;">For inquiries, please contact your branch office.</p>
      </div>
    </body>
    </html>
  `;
}
