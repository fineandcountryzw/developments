'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, ShoppingCart, CreditCard, FileText, Receipt,
  Plus, Search, ChevronLeft, Download, Printer, Eye,
  Building2, MapPin, Calendar, DollarSign, AlertCircle,
  CheckCircle, Clock, XCircle, RefreshCw, Filter
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  nationalId?: string;
  branch: string;
  createdAt: string;
  purchases?: Purchase[];
}

interface Purchase {
  id: string;
  clientId: string;
  developmentId: string;
  standId: string;
  purchasePrice: number;
  depositAmount: number;
  periodMonths: number;
  monthlyAmount: number;
  startDate: string;
  status: string;
  notes?: string;
  branch: string;
  client?: { id: string; name: string; email: string };
  development?: { id: string; name: string; location?: string };
  stand?: { id: string; standNumber: string; price?: number };
  purchasePayments?: PurchasePayment[];
  totalPaid?: number;
  balance?: number;
}

interface PurchasePayment {
  id: string;
  clientPurchaseId: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  description?: string;
  receiptNo?: string;
  status: string;
  createdAt: string;
}

interface StatementData {
  purchase: any;
  client: any;
  development: any;
  stand: any;
  schedule: any[];
  lines: any[];
  summary: { totalDue: number; totalPaid: number; balance: number; paymentsCount: number };
  generatedAt: string;
}

interface Props {
  activeBranch: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    CANCELLED: 'bg-red-100 text-red-800',
    SUSPENDED: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ClientManagementModule: React.FC<Props> = ({ activeBranch }) => {
  // View state
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'payments' | 'statements' | 'receipts'>('overview');

  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Selected purchase for payments/statements/receipts
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Add payment form
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentDate: '', method: 'CASH', reference: '', description: '' });

  // Add purchase form
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    developmentId: '', standId: '', purchasePrice: '', depositAmount: '', periodMonths: '12', monthlyAmount: '', startDate: '', notes: ''
  });
  const [developments, setDevelopments] = useState<any[]>([]);
  const [stands, setStands] = useState<any[]>([]);

  // Statement management
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState<string | null>(null);
  const [stmtSuccess, setStmtSuccess] = useState(false);

  // ─── Fetch Clients ───────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeBranch && activeBranch !== 'All') params.set('branch', activeBranch);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/clients?${params}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data?.data || json.data || [];
        // Enrich with purchase summaries
        const enriched = data.map((c: any) => {
          const purch = c.purchases || [];
          const totalPaid = purch.reduce((sum: number, p: any) => {
            const ppaid = (p.purchasePayments || []).reduce((s: number, pp: any) => s + Number(pp.amount), 0);
            return sum + ppaid;
          }, 0);
          const totalPrice = purch.reduce((sum: number, p: any) => sum + Number(p.purchasePrice), 0);
          return { ...c, _purchaseCount: purch.length, _totalPaid: totalPaid, _totalOutstanding: totalPrice - totalPaid };
        });
        setClients(enriched);
      }
    } catch (err) {
      console.error('Failed to fetch clients', err);
    } finally {
      setLoading(false);
    }
  }, [activeBranch, search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // ─── Fetch Purchases for Client ──────────────────────────────────────────

  const fetchPurchases = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/admin/client-purchases?clientId=${clientId}`);
      const json = await res.json();
      if (json.success) {
        setPurchases(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch purchases', err);
    }
  }, []);

  // ─── Fetch Payments for Purchase ─────────────────────────────────────────

  const fetchPayments = useCallback(async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/admin/client-purchases/${purchaseId}/payments`);
      const json = await res.json();
      if (json.success) {
        setPayments(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch payments', err);
    }
  }, []);

  // ─── Fetch Statement ────────────────────────────────────────────────────

  const fetchStatement = useCallback(async (purchaseId: string) => {
    setStmtLoading(true);
    setStmtError(null);
    setStmtSuccess(false);
    try {
      const params = new URLSearchParams();
      if (stmtFrom) params.set('from', stmtFrom);
      if (stmtTo) params.set('to', stmtTo);
      const res = await fetch(`/api/admin/client-purchases/${purchaseId}/statement?${params}`);
      const json = await res.json();
      if (json.success) {
        setStatement(json.data);
        setStmtSuccess(true);
        setTimeout(() => setStmtSuccess(false), 3000);
      } else {
        setStmtError(json.error || 'Failed to generate statement');
      }
    } catch (err) {
      setStmtError('Error fetching statement. Please try again.');
      console.error('Failed to fetch statement', err);
    } finally {
      setStmtLoading(false);
    }
  }, [stmtFrom, stmtTo]);

  // ─── Fetch Receipts ─────────────────────────────────────────────────────

  const fetchReceipts = useCallback(async (purchaseId: string) => {
    try {
      const res = await fetch(`/api/admin/client-purchases/${purchaseId}/receipts`);
      const json = await res.json();
      if (json.success) {
        setReceipts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch receipts', err);
    }
  }, []);

  // ─── Fetch Developments & Stands ────────────────────────────────────────

  const fetchDevelopments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/developments');
      const json = await res.json();
      if (json.success) {
        setDevelopments(json.data || []);
      }
    } catch (err) { /* ignore */ }
  }, []);

  const fetchStands = useCallback(async (devId: string) => {
    try {
      const res = await fetch(`/api/admin/stands?developmentId=${devId}&status=AVAILABLE`);
      const json = await res.json();
      if (json.success) {
        setStands(json.data?.stands || []);
      }
    } catch (err) { /* ignore */ }
  }, []);

  // ─── Select Client ──────────────────────────────────────────────────────

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setView('detail');
    setActiveTab('overview');
    setSelectedPurchase(null);
    fetchPurchases(client.id);
  };

  // ─── Tab Change Handler ─────────────────────────────────────────────────

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'purchases' && selectedClient) {
      fetchPurchases(selectedClient.id);
    }
    if (tab === 'payments' && selectedPurchase) {
      fetchPayments(selectedPurchase.id);
    }
    if (tab === 'statements' && selectedPurchase) {
      fetchStatement(selectedPurchase.id);
    }
    if (tab === 'receipts' && selectedPurchase) {
      fetchReceipts(selectedPurchase.id);
    }
  };

  // ─── Add Payment ────────────────────────────────────────────────────────

  const handleAddPayment = async () => {
    if (!selectedPurchase || !paymentForm.amount || !paymentForm.paymentDate) return;
    try {
      const res = await fetch(`/api/admin/client-purchases/${selectedPurchase.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddPayment(false);
        setPaymentForm({ amount: '', paymentDate: '', method: 'CASH', reference: '', description: '' });
        fetchPayments(selectedPurchase.id);
        fetchPurchases(selectedClient!.id);
      } else {
        alert(json.error || 'Failed to add payment');
      }
    } catch (err) {
      alert('Failed to add payment');
    }
  };

  // ─── Add Purchase ───────────────────────────────────────────────────────

  const handleAddPurchase = async () => {
    if (!selectedClient || !purchaseForm.developmentId || !purchaseForm.standId || !purchaseForm.purchasePrice || !purchaseForm.startDate) return;
    try {
      const res = await fetch('/api/admin/client-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          ...purchaseForm,
          branch: activeBranch || 'Harare',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddPurchase(false);
        setPurchaseForm({ developmentId: '', standId: '', purchasePrice: '', depositAmount: '', periodMonths: '12', monthlyAmount: '', startDate: '', notes: '' });
        fetchPurchases(selectedClient.id);
      } else {
        alert(json.error || 'Failed to create purchase');
      }
    } catch (err) {
      alert('Failed to create purchase');
    }
  };

  // ─── Print Receipt ──────────────────────────────────────────────────────

  const printReceipt = (receipt: any) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt ${receipt.receiptNo}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;background:#fff}
        .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #C5A059;padding-bottom:20px}
        .logo{font-size:28px;font-weight:bold;color:#333;letter-spacing:2px;margin-bottom:5px}
        .tagline{font-size:11px;color:#666;letter-spacing:0.5px;margin-bottom:10px}
        .branch-info{font-size:10px;color:#888;text-align:right;position:absolute;top:40px;right:40px}
        .receipt-title{font-size:18px;font-weight:bold;text-align:center;margin:30px 0 20px;letter-spacing:1px}
        .receipt-no{text-align:center;color:#666;font-size:12px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th{background:#f5f5f5;padding:12px;text-align:left;font-weight:600;border-bottom:2px solid #C5A059;font-size:12px}
        td{padding:10px 12px;border-bottom:1px solid #eee;font-size:11px}
        tr:hover{background:#fafafa}
        .amount-section{background:#f9f9f9;margin:20px 0;padding:20px;border-left:4px solid #C5A059}
        .amount-row{display:flex;justify-content:space-between;margin:8px 0;font-size:13px}
        .amount-row.total{font-weight:bold;font-size:16px;color:#333;border-top:2px solid #C5A059;padding-top:10px;margin-top:10px}
        .footer{margin-top:40px;padding-top:20px;border-top:1px solid #ddd;text-align:center;font-size:10px;color:#999}
        .signature-section{margin-top:40px;display:flex;justify-content:space-between}
        .signature-line{text-align:center;width:45%;margin-top:50px}
        .line{border-top:1px solid #333;margin-bottom:5px;min-height:1px}
        .signature-label{font-size:10px;color:#333}
        @media print{body{padding:20px}margin:0}.header{page-break-after:avoid}}
      </style>
      </head><body>
      <div class="branch-info">
        <div style="font-weight:bold;margin-bottom:5px">${receipt.client?.branch || 'Harare'}</div>
        <div>📍 Zimbabwe</div>
      </div>
      
      <div class="header">
        <div class="logo" style="color:#C5A059">FINE & COUNTRY</div>
        <div class="tagline">RESIDENTIAL & COMMERCIAL REAL ESTATE</div>
        <div style="font-size:10px;color:#555;margin-top:8px">Zimbabwe Property Solutions</div>
      </div>
      
      <div class="receipt-title">OFFICIAL TRANSACTION RECEIPT</div>
      <div class="receipt-no">Receipt #: <strong>${receipt.receiptNo}</strong></div>
      
      <table>
        <tr>
          <th style="width:50%">Client Information</th>
          <th style="width:50%">Payment Details</th>
        </tr>
        <tr>
          <td><strong>Name:</strong><br/>${receipt.client?.name || 'N/A'}<br/><br/><strong>Development:</strong><br/>${receipt.development?.name || 'N/A'}<br/><br/><strong>Stand:</strong><br/>Stand ${receipt.stand?.standNumber || 'N/A'}</td>
          <td><strong>Date:</strong><br/>${fmtDate(receipt.paymentDate)}<br/><br/><strong>Reference:</strong><br/>${receipt.reference || 'N/A'}<br/><br/><strong>Method:</strong><br/>${receipt.method || 'N/A'}</td>
        </tr>
      </table>
      
      <div class="amount-section">
        <div class="amount-row">
          <span>Amount Paid:</span>
          <span>${fmt(receipt.amount)}</span>
        </div>
        <div class="amount-row total">
          <span>Total:</span>
          <span>${fmt(receipt.amount)}</span>
        </div>
      </div>
      
      <div style="background:#f0f0f0;padding:15px;border-radius:5px;margin:20px 0;font-size:10px;color:#555">
        <strong>Payment Status:</strong> CONFIRMED<br/>
        <strong>Transaction Date:</strong> ${new Date(receipt.createdAt || new Date()).toLocaleString()}<br/>
        <strong>Description:</strong> ${receipt.description || 'Property Payment'}
      </div>
      
      <div class="signature-section">
        <div class="signature-line">
          <div class="line"></div>
          <div class="signature-label">Client/Payer Signature</div>
        </div>
        <div class="signature-line">
          <div class="line"></div>
          <div class="signature-label">Authorized Officer</div>
        </div>
      </div>
      
      <div class="footer">
        <strong>Fine & Country Zimbabwe</strong><br/>
        Professional Real Estate Services<br/>
        Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br/>
        <br/>
        <em>This is an official transaction receipt. For inquiries, please contact your branch office.</em>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // ─── Print Statement ────────────────────────────────────────────────────

  const printStatement = (stmt: StatementData, purchase: any) => {
    if (!stmt || !purchase) return;
    
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    
    const totalDue = fmt(stmt.summary.totalDue);
    const totalPaid = fmt(stmt.summary.totalPaid);
    const balance = fmt(stmt.summary.balance);
    
    const lines = stmt.lines.map((line: any) => `
      <tr class="border-b border-gray-50">
        <td class="px-4 py-2">${fmtDate(line.date)}</td>
        <td class="px-4 py-2">${line.description}</td>
        <td class="px-4 py-2 text-right">${line.debit > 0 ? fmt(line.debit) : '-'}</td>
        <td class="px-4 py-2 text-right text-green-700">${line.credit > 0 ? fmt(line.credit) : '-'}</td>
        <td class="px-4 py-2 text-right font-medium">${fmt(line.balance)}</td>
      </tr>
    `).join('');

    w.document.write(`
      <html><head><title>Statement ${purchase.id}</title>
      <style>
        body { font-family:'Segoe UI',Arial,sans-serif; padding:40px; max-width:900px; margin:0 auto; background:#fff }
        .header { text-align:center; margin-bottom:30px; border-bottom:3px solid #C5A059; padding-bottom:20px }
        .logo { font-size:28px; font-weight:bold; color:#333; letter-spacing:2px; margin-bottom:5px }
        .tagline { font-size:11px; color:#666; letter-spacing:0.5px; margin-bottom:10px }
        .title { font-size:18px; font-weight:bold; text-align:center; margin:30px 0 20px; letter-spacing:1px; color:#333 }
        .section-title { font-size:12px; font-weight:bold; color:#C5A059; background:#f5f5f5; padding:8px 12px; margin-top:20px; margin-bottom:10px }
        table { width:100%; border-collapse:collapse; margin:15px 0 }
        th { background:#f5f5f5; padding:12px; text-align:left; font-weight:600; border-bottom:2px solid #C5A059; font-size:11px }
        td { padding:10px 12px; border-bottom:1px solid #eee; font-size:11px }
        .summary { background:#f9f9f9; padding:15px; border-left:4px solid #C5A059; margin:20px 0 }
        .summary-row { display:flex; justify-content:space-between; margin:8px 0; font-size:12px }
        .summary-row.total { font-weight:bold; font-size:14px; color:#333; border-top:2px solid #C5A059; padding-top:10px; margin-top:10px }
        .footer { margin-top:40px; padding-top:20px; border-top:1px solid #ddd; text-align:center; font-size:9px; color:#999 }
        @media print { body { padding:20px } }
      </style></head><body>
      <div class="header">
        <div class="logo" style="color:#C5A059">FINE & COUNTRY</div>
        <div class="tagline">RESIDENTIAL & COMMERCIAL REAL ESTATE</div>
        <div style="font-size:10px;color:#555;margin-top:8px">Zimbabwe Property Solutions</div>
      </div>
      
      <div class="title">ACCOUNT STATEMENT</div>
      
      <table>
        <tr>
          <th>Client Information</th>
          <th>Property Details</th>
        </tr>
        <tr>
          <td><strong>${purchase.client?.name || 'N/A'}</strong><br/>${purchase.client?.email || ''}<br/>${purchase.client?.phone || ''}</td>
          <td><strong>Development:</strong> ${purchase.development?.name || 'N/A'}<br/><strong>Stand:</strong> ${purchase.stand?.standNumber || 'N/A'}<br/><strong>Branch:</strong> ${activeBranch || 'Harare'}</td>
        </tr>
      </table>

      <div class="section-title">FINANCIAL SUMMARY</div>
      <div class="summary">
        <div class="summary-row">
          <span>Total Due:</span>
          <span>${totalDue}</span>
        </div>
        <div class="summary-row">
          <span>Total Paid:</span>
          <span style="color:#22c55e">${totalPaid}</span>
        </div>
        <div class="summary-row total">
          <span>Outstanding Balance:</span>
          <span style="color:#${Math.abs(stmt.summary.balance) > 0 ? 'dc2626' : '22c55e'}">${balance}</span>
        </div>
      </div>

      <div class="section-title">TRANSACTION HISTORY</div>
      <table>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th style="text-align:right">Debit</th>
          <th style="text-align:right">Credit</th>
          <th style="text-align:right">Balance</th>
        </tr>
        ${lines}
      </table>

      <div class="footer">
        <strong>FINE & COUNTRY ZIMBABWE</strong><br/>
        Professional Real Estate Services<br/>
        Generated: ${new Date().toLocaleString()}<br/>
        <em>This is a computer-generated statement. For inquiries, contact your branch office.</em>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // ─── Email Statement ────────────────────────────────────────────────────

  const emailStatement = async (purchase: any) => {
    if (!selectedClient) return;
    try {
      const res = await fetch(`/api/admin/client-purchases/${purchase.id}/email-statement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          clientEmail: selectedClient.email,
          developmentName: purchase.development?.name,
          standNumber: purchase.stand?.standNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStmtSuccess(true);
        setTimeout(() => setStmtSuccess(false), 3000);
        alert('Statement sent to: ' + selectedClient.email);
      } else {
        setStmtError(json.error || 'Failed to send statement email');
      }
    } catch (err) {
      setStmtError('Error sending email. Please try again.');
      console.error('Failed to email statement', err);
    }
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Client List View ───────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage clients, purchases, payments, and statements</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search clients by name, email, or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] outline-none"
            />
          </div>
          <button onClick={fetchClients} className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Client Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600"># Purchases</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Outstanding</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Branch</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No clients found</td></tr>
                ) : (
                  clients.map((c: any) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer" onClick={() => selectClient(c)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#C5A059]/10 text-[#C5A059] font-semibold text-xs">
                          {c._purchaseCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(c._totalPaid || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{fmt(c._totalOutstanding || 0)}</td>
                      <td className="px-4 py-3 text-gray-600">{c.branch}</td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-[#C5A059] hover:text-[#B08D3E] font-medium text-xs" onClick={e => { e.stopPropagation(); selectClient(c); }}>
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Client Detail View ─────────────────────────────────────────────────

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Users },
    { id: 'purchases' as const, label: 'Purchases', icon: ShoppingCart },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard },
    { id: 'statements' as const, label: 'Statements', icon: FileText },
    { id: 'receipts' as const, label: 'Receipts', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => { setView('list'); setSelectedClient(null); }} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{selectedClient?.name}</h1>
          <p className="text-sm text-gray-500">{selectedClient?.email} · {selectedClient?.phone || 'No phone'} · {selectedClient?.branch}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && selectedClient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Client Info</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd className="font-medium">{selectedClient.name}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium">{selectedClient.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd className="font-medium">{selectedClient.phone || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">National ID</dt><dd className="font-medium">{selectedClient.nationalId || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Branch</dt><dd className="font-medium">{selectedClient.branch}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Since</dt><dd className="font-medium">{fmtDate(selectedClient.createdAt)}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Purchase Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#C5A059]/10 flex items-center justify-center">
                  <ShoppingCart size={18} className="text-[#C5A059]" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{purchases.length}</div>
                  <div className="text-xs text-gray-500">Total Purchases</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <DollarSign size={18} className="text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">
                    {fmt(purchases.reduce((s, p) => s + (p.totalPaid || 0), 0))}
                  </div>
                  <div className="text-xs text-gray-500">Total Paid</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertCircle size={18} className="text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {fmt(purchases.reduce((s, p) => s + (p.balance || 0), 0))}
                  </div>
                  <div className="text-xs text-gray-500">Outstanding Balance</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Activity</h3>
            {purchases.length === 0 ? (
              <p className="text-sm text-gray-400">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {purchases.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-sm">
                    <StatusBadge status={p.status} />
                    <div className="flex-1 truncate">
                      <span className="font-medium">{p.development?.name}</span>
                      <span className="text-gray-400"> · Stand {p.stand?.standNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Purchases Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Purchases</h3>
            <button
              onClick={() => { setShowAddPurchase(true); fetchDevelopments(); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E] transition-colors"
            >
              <Plus size={16} /> New Purchase
            </button>
          </div>

          {/* Add Purchase Modal */}
          {showAddPurchase && (
            <div className="bg-white rounded-xl border-2 border-[#C5A059]/30 p-6 space-y-4">
              <h4 className="font-semibold text-gray-900">Create New Purchase</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Development</label>
                  <select
                    value={purchaseForm.developmentId}
                    onChange={e => { setPurchaseForm(f => ({ ...f, developmentId: e.target.value, standId: '' })); if (e.target.value) fetchStands(e.target.value); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select development...</option>
                    {developments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stand</label>
                  <select
                    value={purchaseForm.standId}
                    onChange={e => setPurchaseForm(f => ({ ...f, standId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select stand...</option>
                    {stands.map((s: any) => <option key={s.id} value={s.id}>Stand {s.standNumber} - {fmt(Number(s.price))}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Price</label>
                  <input type="number" value={purchaseForm.purchasePrice} onChange={e => setPurchaseForm(f => ({ ...f, purchasePrice: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Deposit Amount</label>
                  <input type="number" value={purchaseForm.depositAmount} onChange={e => setPurchaseForm(f => ({ ...f, depositAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Period (months)</label>
                  <input type="number" value={purchaseForm.periodMonths} onChange={e => setPurchaseForm(f => ({ ...f, periodMonths: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Amount</label>
                  <input type="number" value={purchaseForm.monthlyAmount} onChange={e => setPurchaseForm(f => ({ ...f, monthlyAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Auto-calculated if blank" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input type="date" value={purchaseForm.startDate} onChange={e => setPurchaseForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={purchaseForm.notes} onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddPurchase} className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E]">Create Purchase</button>
                <button onClick={() => setShowAddPurchase(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Purchases Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Development</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Stand</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No purchases found</td></tr>
                ) : (
                  purchases.map(p => (
                    <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer ${selectedPurchase?.id === p.id ? 'bg-[#C5A059]/5' : ''}`}
                      onClick={() => setSelectedPurchase(p)}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.development?.name || '-'}</div>
                        <div className="text-xs text-gray-400">{p.development?.location}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">Stand {p.stand?.standNumber}</div>
                        <div className="text-xs text-gray-400">ID: {p.standId?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(Number(p.purchasePrice))}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(p.totalPaid || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{fmt(p.balance || 0)}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedPurchase(p); handleTabChange('payments'); }}
                          className="text-xs text-[#C5A059] hover:underline font-medium"
                        >
                          View Payments
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Payments Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {!selectedPurchase ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Select a purchase from the Purchases tab first</p>
              <button onClick={() => handleTabChange('purchases')} className="mt-3 text-sm text-[#C5A059] hover:underline font-medium">Go to Purchases →</button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Payments for {selectedPurchase.development?.name} - Stand {selectedPurchase.stand?.standNumber}</h3>
                  <p className="text-sm text-gray-500">Price: {fmt(Number(selectedPurchase.purchasePrice))} · Paid: {fmt(selectedPurchase.totalPaid || 0)} · Balance: {fmt(selectedPurchase.balance || 0)}</p>
                </div>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E]"
                >
                  <Plus size={16} /> Add Payment
                </button>
              </div>

              {/* Add Payment Form */}
              {showAddPayment && (
                <div className="bg-white rounded-xl border-2 border-[#C5A059]/30 p-6 space-y-4">
                  <h4 className="font-semibold text-gray-900">Record Payment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                      <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                      <input type="date" value={paymentForm.paymentDate} onChange={e => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                      <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="ECOCASH">EcoCash</option>
                        <option value="CARD">Card</option>
                        <option value="CHEQUE">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
                      <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <input type="text" value={paymentForm.description} onChange={e => setPaymentForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleAddPayment} className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E]">Record Payment</button>
                    <button onClick={() => setShowAddPayment(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  </div>
                  <p className="text-xs text-gray-400">A receipt number will be auto-generated upon recording.</p>
                </div>
              )}

              {/* Payments Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reference</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Receipt No</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">No payments recorded</td></tr>
                    ) : (
                      payments.map(p => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="px-4 py-3">{fmtDate(p.paymentDate)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmt(Number(p.amount))}</td>
                          <td className="px-4 py-3">{p.method}</td>
                          <td className="px-4 py-3 text-gray-500">{p.reference || '-'}</td>
                          <td className="px-4 py-3 font-mono text-xs">{p.receiptNo || '-'}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Statements Tab ────────────────────────────────────────────────── */}
      {activeTab === 'statements' && (
        <div className="space-y-4">
          {/* Error Alert */}
          {stmtError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{stmtError}</p>
              </div>
              <button onClick={() => setStmtError(null)} className="text-red-600 hover:text-red-700">
                ✕
              </button>
            </div>
          )}

          {/* Success Alert */}
          {stmtSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">Statement generated successfully!</p>
            </div>
          )}

          {!selectedPurchase ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileText size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Select a purchase from the Purchases tab first</p>
              <button onClick={() => handleTabChange('purchases')} className="mt-3 text-sm text-[#C5A059] hover:underline font-medium">Go to Purchases →</button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Statement: {selectedPurchase.development?.name} - Stand {selectedPurchase.stand?.standNumber}</h3>
                </div>
                <div className="flex items-end gap-3 ml-auto flex-wrap">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button 
                    onClick={() => fetchStatement(selectedPurchase.id)} 
                    disabled={stmtLoading}
                    className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-sm font-medium hover:bg-[#B08D3E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {stmtLoading ? <>⏳ Loading...</> : <>Generate</>}
                  </button>
                </div>
              </div>

              {statement ? (
                <div className="space-y-4">
                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      onClick={() => printStatement(statement, selectedPurchase)} 
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                      <Printer size={16} /> Print
                    </button>
                    <button 
                      onClick={() => emailStatement(selectedPurchase)} 
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                      📧 Email to Client
                    </button>
                  </div>

                  {/* Branded Header */}
                  <div className="bg-gradient-to-r from-[#C5A059] to-[#B08D3E] text-white rounded-lg p-6 mb-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-1">FINE & COUNTRY</h2>
                      <p className="text-sm opacity-90">RESIDENTIAL & COMMERCIAL REAL ESTATE</p>
                      <p className="text-xs opacity-75 mt-2">Zimbabwe Property Solutions</p>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500">Total Due</div>
                      <div className="text-xl font-bold">{fmt(statement.summary.totalDue)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500">Total Paid</div>
                      <div className="text-xl font-bold text-green-700">{fmt(statement.summary.totalPaid)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500">Balance</div>
                      <div className="text-xl font-bold text-red-600">{fmt(statement.summary.balance)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs text-gray-500">Payments</div>
                      <div className="text-xl font-bold">{statement.summary.paymentsCount}</div>
                    </div>
                  </div>

                  {/* Installment Schedule */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h4 className="font-semibold text-sm text-gray-700">Installment Schedule</h4>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-gray-500 font-medium">#</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-medium">Due Date</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-medium">Type</th>
                          <th className="text-right px-4 py-2 text-gray-500 font-medium">Amount Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.schedule.map((s: any, i: number) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-4 py-2">{s.installmentNo}</td>
                            <td className="px-4 py-2">{fmtDate(s.dueDate)}</td>
                            <td className="px-4 py-2"><StatusBadge status={s.type} /></td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(s.amountDue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Statement Lines */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h4 className="font-semibold text-sm text-gray-700">Transaction History (Running Balance)</h4>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-gray-500 font-medium">Date</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-medium">Description</th>
                          <th className="text-right px-4 py-2 text-gray-500 font-medium">Debit</th>
                          <th className="text-right px-4 py-2 text-gray-500 font-medium">Credit</th>
                          <th className="text-right px-4 py-2 text-gray-500 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.lines.map((line: any, i: number) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-4 py-2">{fmtDate(line.date)}</td>
                            <td className="px-4 py-2">{line.description}</td>
                            <td className="px-4 py-2 text-right">{line.debit > 0 ? fmt(line.debit) : '-'}</td>
                            <td className="px-4 py-2 text-right text-green-700">{line.credit > 0 ? fmt(line.credit) : '-'}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(line.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-gray-400 text-right">Generated: {new Date(statement.generatedAt).toLocaleString()}</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Click "Generate" to create a statement</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Receipts Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          {!selectedPurchase ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Select a purchase from the Purchases tab first</p>
              <button onClick={() => handleTabChange('purchases')} className="mt-3 text-sm text-[#C5A059] hover:underline font-medium">Go to Purchases →</button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Receipts for {selectedPurchase.development?.name} - Stand {selectedPurchase.stand?.standNumber}</h3>
                <button onClick={() => fetchReceipts(selectedPurchase.id)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Receipt No</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reference</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">No receipts found</td></tr>
                    ) : (
                      receipts.map((r: any) => (
                        <tr key={r.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 font-mono text-xs font-medium">{r.receiptNo}</td>
                          <td className="px-4 py-3">{fmtDate(r.paymentDate)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmt(r.amount)}</td>
                          <td className="px-4 py-3">{r.method}</td>
                          <td className="px-4 py-3 text-gray-500">{r.reference || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => printReceipt(r)} className="inline-flex items-center gap-1 text-xs text-[#C5A059] hover:underline font-medium">
                              <Printer size={14} /> Print
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientManagementModule;
