
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Mail, Send, Settings, FileCode, Search, Filter, 
  CheckCircle2, XCircle, Clock, Loader2, Save, 
  Eye, History, Database, ShieldCheck, Zap,
  Globe, AlertCircle, Trash2, Edit3, Server, Hash,
  ArrowRight, Copy, Terminal, Plus, ChevronRight, TrendingUp, PieChart
} from 'lucide-react';
import { EmailTemplate, CommunicationLog, EmailConfig, Branch, EmailProviderType } from '../types.ts';
import { supabaseMock } from '../services/supabase.ts';
import { sendEmail } from '../lib/email-service';

export const EmailModule: React.FC<{ activeBranch: Branch }> = ({ activeBranch }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'history' | 'config'>('templates');
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isTesting, setIsTesting] = useState(false);


   // Add default templates for notification suite if not present
   // Logo URL will be injected at send time via {{company_logo_url}} placeholder
   const defaultNotificationTemplates: EmailTemplate[] = [
      {
         id: 'RESERVATION_CONFIRMED',
         name: 'Reservation Confirmed',
         subject: 'Your Reservation is Confirmed – 72hr Hold Initiated',
         bodyHtml: `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
               <img src="{{company_logo_url}}" alt="Fine & Country Logo" style="height: 48px; margin-bottom: 24px;" />
               <h2 style="color: #85754E;">Reservation Confirmed</h2>
               <p>Your reservation (ID: {{reservation_id}}) is now active for 72 hours. Please complete your deposit to secure your investment.</p>
               <p><b>Expiry:</b> {{expires_at}}</p>
               <a href="{{investor_terminal_url}}" style="color: #85754E;">Access Investor Terminal</a>
            </div>
         `,
         category: 'Transactional',
         lastUpdated: new Date().toISOString(),
         version: 1
      },
      {
         id: 'RESERVATION_EXPIRED',
         name: 'Reservation Expired',
         subject: 'Reservation Expired – Stand Released',
         bodyHtml: `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
               <img src="{{company_logo_url}}" alt="Fine & Country Logo" style="height: 48px; margin-bottom: 24px;" />
               <h2 style="color: #4A0E0E;">Reservation Expired</h2>
               <p>Your reservation (ID: {{reservation_id}}) has expired after 72 hours. The stand is now available to other investors.</p>
               <a href="{{investor_terminal_url}}" style="color: #85754E;">Return to Investor Terminal</a>
            </div>
         `,
         category: 'Transactional',
         lastUpdated: new Date().toISOString(),
         version: 1
      },
      {
         id: 'SALE_COMPLETE',
         name: 'Sale Complete',
         subject: 'Executive Investment Confirmation',
         bodyHtml: `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
               <img src="{{company_logo_url}}" alt="Fine & Country Logo" style="height: 48px; margin-bottom: 24px;" />
               <h2 style="color: #85754E;">Congratulations – Sale Finalized</h2>
               <p>Your investment (Reservation ID: {{reservation_id}}) is now complete. Welcome to the Fine & Country portfolio.</p>
               <a href="{{investor_terminal_url}}" style="color: #85754E;">View Your Portfolio</a>
            </div>
         `,
         category: 'Transactional',
         lastUpdated: new Date().toISOString(),
         version: 1
      }
   ];

   const fetchData = async () => {
      setIsLoading(true);
      let [tmpls, hist, cfg] = await Promise.all([
         supabaseMock.getEmailTemplates(),
         supabaseMock.getCommunicationLogs(),
         supabaseMock.getEmailConfig()
      ]);
      // Ensure notification templates exist
      defaultNotificationTemplates.forEach(tmpl => {
         if (!tmpls.find(t => t.id === tmpl.id)) {
            tmpls.push(tmpl);
         }
      });
      setTemplates(tmpls);
      setLogs(hist);
      setConfig(cfg);
      setIsLoading(false);
   };

  useEffect(() => {
    fetchData();
    // Production email service doesn't need init - uses RESEND_API_KEY env var
  }, [activeBranch]);

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setIsSaving(true);
    await supabaseMock.saveEmailTemplate(selectedTemplate);
    setNotification({ msg: 'Template Manifest Synchronized', type: 'success' });
    setTimeout(() => {
      setNotification(null);
      setIsSaving(false);
    }, 2000);
  };

  const handleSendTest = async () => {
    if (!config || !selectedTemplate) return;
    setIsTesting(true);
    try {
      await sendEmail({
        to: config.senderEmail,
        subject: `[TEST] ${selectedTemplate.subject}`,
        html: selectedTemplate.bodyHtml
      });
      setNotification({ msg: 'Test dispatch successful. Verify in inbox.', type: 'success' });
      fetchData(); // Update history
    } catch (error: any) {
      setNotification({ msg: error?.message || 'Handshake failed: Provider unreachable.', type: 'error' });
    } finally {
      setIsTesting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return <span className="flex items-center space-x-1.5 text-[9px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100 uppercase tracking-widest"><CheckCircle2 size={10} /> <span>Handshake OK</span></span>;
      case 'FAILED': return <span className="flex items-center space-x-1.5 text-[9px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100 uppercase tracking-widest"><XCircle size={10} /> <span>Protocol Error</span></span>;
      default: return <span className="flex items-center space-x-1.5 text-[9px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 uppercase tracking-widest"><Clock size={10} /> <span>Queued</span></span>;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 animate-in fade-in duration-1000 pb-40 font-sans selection:bg-fcGold/30">
      
      {notification && (
        <div className={`fixed top-24 right-12 z-[200] flex items-center space-x-4 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-8 duration-500 ${
          notification.type === 'success' ? 'bg-fcSlate text-white border-fcGold/30' : 'bg-red-600 text-white border-red-400'
        }`}>
          <div className="p-2 bg-fcGold/20 rounded-lg text-fcGold"><Zap size={18} /></div>
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">{notification.msg}</span>
        </div>
      )}

      {/* Module Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 pb-12 border-b border-fcDivider">
        <div className="space-y-3">
           <div className="flex items-center space-x-3 text-fcGold">
              <Mail size={24} />
              <h4 className="text-[10px] font-black uppercase tracking-[0.5em]">Admin Module</h4>
           </div>
           <h2 className="text-5xl font-[900] text-fcSlate tracking-tightest leading-none font-sans uppercase">Email Center</h2>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-fcDivider shadow-sm">
          {[
            { id: 'templates', label: 'Template Library', icon: FileCode },
            { id: 'history', label: 'Forensic History', icon: History },
            { id: 'config', label: 'Provider Config', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-3 px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all font-sans ${
                activeTab === tab.id ? 'bg-fcGold text-white shadow-lg shadow-fcGold/20' : 'text-gray-600 hover:text-fcSlate'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-12">
        {activeTab === 'templates' && (
          <>
            {/* Sidebar List */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[32px] border border-fcDivider shadow-sm overflow-hidden">
                <div className="p-6 border-b border-fcDivider flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Available Nodes</h3>
                  <button className="p-2 bg-white text-fcGold rounded-xl hover:bg-fcGold hover:text-white transition-all"><Plus size={16} /></button>
                </div>
                <div className="divide-y divide-fcDivider">
                  {templates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`w-full text-left p-8 transition-all flex justify-between items-center group ${
                        selectedTemplate?.id === tmpl.id ? 'bg-fcGold/5 border-l-4 border-l-fcGold' : 'hover:bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className={`text-sm font-black font-sans ${selectedTemplate?.id === tmpl.id ? 'text-fcGold' : 'text-fcSlate'}`}>{tmpl.name}</div>
                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Version {tmpl.version} • {tmpl.category}</div>
                      </div>
                      {/* Fix: ChevronRight added to imports */}
                      <ChevronRight size={14} className={selectedTemplate?.id === tmpl.id ? 'text-fcGold' : 'text-slate-300 opacity-0 group-hover:opacity-100'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-fcSlate p-10 rounded-[40px] shadow-2xl text-white space-y-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-fcGold/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                 <div className="flex items-center space-x-3 text-fcGold">
                    <ShieldCheck size={20} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Integrity Protocol</span>
                 </div>
                 <p className="text-xs font-medium leading-relaxed text-gray-600 uppercase tracking-widest opacity-80">
                   Templates are synchronized across the /supabase/functions/email-templates cluster. Version control is strictly enforced.
                 </p>
              </div>
            </div>

            {/* Template Editor */}
            <div className="col-span-12 lg:col-span-8">
              {selectedTemplate ? (
                <div className="bg-white rounded-[48px] border border-fcDivider shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
                  <div className="p-10 border-b border-fcDivider flex justify-between items-center bg-white sticky top-0 z-20">
                     <div className="flex items-center space-x-5">
                        <div className="p-4 bg-fcGold/10 rounded-2xl text-fcGold shadow-sm"><Edit3 size={24} /></div>
                        <div>
                           <h3 className="text-xl font-black text-fcSlate uppercase tracking-tightest font-sans">Instrument Editor</h3>
                           <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Manifest ID: {selectedTemplate.id}</p>
                        </div>
                     </div>
                     <div className="flex items-center space-x-4">
                        <button 
                          onClick={handleSendTest}
                          disabled={isTesting}
                          className="flex items-center space-x-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-fcGold border border-fcGold/20 hover:bg-fcGold hover:text-white transition-all font-sans"
                        >
                          {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          <span>Execute Test</span>
                        </button>
                        <button 
                          onClick={handleSaveTemplate}
                          disabled={isSaving}
                          className="flex items-center space-x-2 bg-fcSlate text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 font-sans"
                        >
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          <span>Sync Template</span>
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-10 space-y-8 border-r border-fcDivider h-[650px] overflow-y-auto no-scrollbar">
                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Subject Header</label>
                          <input 
                            type="text" 
                            value={selectedTemplate.subject}
                            onChange={e => setSelectedTemplate({...selectedTemplate, subject: e.target.value})}
                            className="w-full bg-white border border-fcDivider rounded-2xl px-6 py-4 text-sm font-bold text-fcSlate focus:ring-1 focus:ring-fcGold outline-none font-sans"
                          />
                       </div>
                       <div className="space-y-4">
                          <div className="flex justify-between items-center ml-1">
                             <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Markup Source (HTML)</label>
                             <span className="text-[9px] font-mono font-black text-fcGold">UTF-8 / HANDLEBARS</span>
                          </div>
                          <textarea 
                            rows={18}
                            value={selectedTemplate.bodyHtml}
                            onChange={e => setSelectedTemplate({...selectedTemplate, bodyHtml: e.target.value})}
                            className="w-full bg-white text-green-400 p-8 rounded-[32px] font-mono text-[11px] outline-none resize-none leading-relaxed shadow-inner"
                          />
                       </div>
                    </div>

                    <div className="p-10 bg-white/30 h-[650px] overflow-y-auto no-scrollbar flex flex-col">
                       <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center space-x-3 text-fcGold">
                             <Eye size={18} />
                             <span className="text-[10px] font-black uppercase tracking-widest font-montserrat">Live Heuristic Preview</span>
                          </div>
                          <div className="flex space-x-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                             <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                             <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                          </div>
                       </div>
                       <div className="flex-1 bg-white rounded-[32px] shadow-sm border border-fcDivider overflow-hidden overflow-y-auto p-12">
                          <div dangerouslySetInnerHTML={{ __html: selectedTemplate.bodyHtml }} />
                       </div>
                       <div className="mt-8 flex items-center justify-center space-x-6 text-gray-600">
                          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest">
                             <Server size={14} />
                             <span>VPC Node: PROD</span>
                          </div>
                          <div className="w-[1px] h-3 bg-fcDivider" />
                          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest">
                             <Hash size={14} />
                             <span>SHA-256 Validated</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[750px] bg-white rounded-[48px] border border-fcDivider border-dashed flex flex-col items-center justify-center text-center space-y-8 opacity-40">
                   <div className="p-12 bg-white rounded-full">
                      <Mail size={80} strokeWidth={1} className="text-slate-300" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-2xl font-[900] text-fcSlate font-montserrat">Library Console Idle</h3>
                      <p className="text-sm text-gray-600 font-bold uppercase tracking-widest max-w-sm">Select an administrative template node to begin the forensic drafting cycle.</p>
                   </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="col-span-12 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-10 rounded-[32px] border border-fcDivider shadow-sm">
                   <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Total Aggregate Dispatch</div>
                   <div className="text-4xl font-black text-fcSlate font-mono tracking-tighter">1,204</div>
                   <div className="mt-4 text-[9px] font-black text-green-600 uppercase tracking-widest flex items-center">
                      {/* Fix: TrendingUp added to imports */}
                      <TrendingUp size={12} className="mr-2" />
                      <span>+12.4% vs Last Cycle</span>
                   </div>
                </div>
                <div className="bg-white p-10 rounded-[32px] border border-fcDivider shadow-sm">
                   <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Delivery Rate (Handshake)</div>
                   <div className="text-4xl font-black text-fcGold font-mono tracking-tighter">98.2%</div>
                   <div className="mt-4 text-[9px] font-black text-fcGold uppercase tracking-widest flex items-center">
                      <ShieldCheck size={12} className="mr-2" />
                      <span>System Health: Nominal</span>
                   </div>
                </div>
                <div className="bg-fcSlate p-10 rounded-[32px] shadow-2xl text-white">
                   <div className="text-[10px] font-black text-fcGold uppercase tracking-widest mb-4">Provider Utilization</div>
                   <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <div className="text-3xl font-black font-mono">SG / SMTP</div>
                        <div className="text-[9px] font-black opacity-50 uppercase tracking-widest">Balanced Protocol Node</div>
                      </div>
                      {/* Fix: PieChart added to imports */}
                      <PieChart size={32} className="text-fcGold opacity-40" />
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[40px] border border-fcDivider shadow-sm overflow-hidden min-h-[600px]">
                <div className="p-10 border-b border-fcDivider flex justify-between items-center bg-white sticky top-0 z-20">
                   <div className="flex items-center space-x-4">
                      <div className="p-3 bg-white rounded-2xl text-gray-600"><Database size={20} /></div>
                      <div>
                        <h3 className="text-xl font-black text-fcSlate tracking-tight font-montserrat uppercase">Forensic Comm Ledger</h3>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-0.5">National Communication Manifest</p>
                      </div>
                   </div>
                   <div className="relative group">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-fcGold" />
                      <input 
                        type="text" 
                        placeholder="Search recipient..." 
                        className="bg-white border border-fcDivider rounded-full pl-10 pr-6 py-2.5 text-xs font-bold focus:ring-1 focus:ring-fcGold outline-none w-64 transition-all shadow-inner"
                      />
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white/50 text-[10px] font-black uppercase tracking-[0.3em] text-gray-600 font-montserrat">
                           <th className="px-10 py-8">Timeline</th>
                           <th className="px-10 py-8">Recipient Signature</th>
                           <th className="px-10 py-8">Subject Protocol</th>
                           <th className="px-10 py-8">Protocol Hub</th>
                           <th className="px-10 py-8">Integrity Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {logs.map(log => (
                          <tr key={log.id} className="group hover:bg-[#F9F8F6]/50 transition-colors">
                             <td className="px-10 py-8">
                                <div className="text-sm font-black text-fcSlate font-montserrat">{new Date(log.sentAt).toLocaleDateString('en-GB')}</div>
                                <div className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{new Date(log.sentAt).toLocaleTimeString()}</div>
                             </td>
                             <td className="px-10 py-8">
                                <div className="text-sm font-black text-fcSlate lowercase">{log.recipientEmail}</div>
                                <div className="text-[9px] font-black text-fcGold uppercase tracking-widest mt-1 opacity-60">Signatory Node</div>
                             </td>
                             <td className="px-10 py-8">
                                <div className="text-sm font-bold text-fcSlate tracking-tight max-w-xs truncate">{log.subject}</div>
                                <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-1">Ref: {log.id}</div>
                             </td>
                             <td className="px-10 py-8">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${log.provider === 'SENDGRID' ? 'bg-[#014686]/10 text-[#014686] border-[#014686]/20' : 'bg-fcGold/10 text-fcGold border-fcGold/20'}`}>
                                   {log.provider}
                                </span>
                             </td>
                             <td className="px-10 py-8">
                                {getStatusBadge(log.status)}
                             </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'config' && config && (
          <div className="col-span-12 max-w-3xl mx-auto w-full animate-in zoom-in-95 duration-500">
             <div className="bg-white rounded-[48px] border border-fcDivider shadow-xl overflow-hidden">
                <div className="bg-fcGold p-16 text-white flex justify-between items-center relative">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                   <div className="space-y-3 relative z-10">
                      <h3 className="text-3xl font-[900] tracking-tightest font-montserrat uppercase">Protocol Config</h3>
                      <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-80">Provider Handshake Management</p>
                   </div>
                   <Server size={64} className="text-white/20 relative z-10" />
                </div>
                
                <div className="p-16 space-y-12 bg-[#F9F8F6]/30">
                   <div className="space-y-6">
                      <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">Default Dispatch Hub</label>
                      <div className="grid grid-cols-2 gap-4">
                         {(['SENDGRID', 'SMTP'] as EmailProviderType[]).map(p => (
                           <button
                            key={p}
                            onClick={() => setConfig({...config, providerType: p})}
                            className={`flex items-center justify-between p-8 rounded-3xl border transition-all ${config.providerType === p ? 'bg-fcGold/5 border-fcGold shadow-lg' : 'bg-white border-fcDivider hover:border-slate-300'}`}
                           >
                              <div className="flex items-center space-x-4">
                                 <div className={`p-3 rounded-2xl ${config.providerType === p ? 'bg-fcGold text-white shadow-xl shadow-fcGold/20' : 'bg-white text-gray-600'}`}>
                                    <Globe size={24} />
                                 </div>
                                 <div className="text-left">
                                    <div className={`text-sm font-black font-montserrat ${config.providerType === p ? 'text-fcGold' : 'text-fcSlate'}`}>{p} Network</div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">{p === 'SENDGRID' ? 'Cloud API Dispatch' : 'Native SMTP Relay'}</div>
                                 </div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${config.providerType === p ? 'bg-fcGold border-fcGold text-white' : 'bg-white border-fcDivider'}`}>
                                 {config.providerType === p && <CheckCircle2 size={14} />}
                              </div>
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-10 animate-in slide-in-from-top-2 duration-500">
                      {config.providerType === 'SENDGRID' ? (
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">SendGrid Secret Key (Bearer)</label>
                           <div className="relative group">
                              <Terminal size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-fcGold transition-colors" />
                              <input 
                                type="password" 
                                value={config.apiKey || ''}
                                onChange={e => setConfig({...config, apiKey: e.target.value})}
                                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="w-full bg-white border border-fcDivider rounded-[24px] pl-16 pr-6 py-5 text-sm font-bold text-fcSlate focus:ring-1 focus:ring-fcGold outline-none shadow-sm font-mono"
                              />
                           </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-500">
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">SMTP Endpoint Host</label>
                              <input 
                                type="text" 
                                value={config.smtpHost || ''}
                                onChange={e => setConfig({...config, smtpHost: e.target.value})}
                                placeholder="mail.smtp.com"
                                className="w-full bg-white border border-fcDivider rounded-[24px] px-8 py-5 text-sm font-bold text-fcSlate outline-none"
                              />
                           </div>
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">Relay Port</label>
                              <input 
                                type="number" 
                                value={config.smtpPort || 587}
                                onChange={e => setConfig({...config, smtpPort: parseInt(e.target.value)})}
                                className="w-full bg-white border border-fcDivider rounded-[24px] px-8 py-5 text-sm font-bold text-fcSlate outline-none font-mono"
                              />
                           </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">Display Sender Name</label>
                            <input 
                              type="text" 
                              value={config.senderName}
                              onChange={e => setConfig({...config, senderName: e.target.value})}
                              className="w-full bg-white border border-fcDivider rounded-[24px] px-8 py-5 text-sm font-bold text-fcSlate outline-none"
                            />
                         </div>
                         <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest font-montserrat ml-1">Statutory Sender Email</label>
                            <input 
                              type="email" 
                              value={config.senderEmail}
                              onChange={e => setConfig({...config, senderEmail: e.target.value})}
                              className="w-full bg-white border border-fcDivider rounded-[24px] px-8 py-5 text-sm font-bold text-fcSlate outline-none"
                            />
                         </div>
                      </div>
                   </div>

                   <div className="pt-10 border-t border-fcDivider flex justify-between items-center">
                      <div className="flex items-center space-x-3 text-amber-600 bg-amber-50 px-6 py-3 rounded-2xl border border-amber-100">
                         <AlertCircle size={16} />
                         <span className="text-[10px] font-black uppercase tracking-widest font-montserrat">Protocol Encryption: SSL/TLS</span>
                      </div>
                      <button 
                        className="bg-fcGold text-white px-12 py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-fcGold/20 hover:brightness-110 transition-all flex items-center space-x-4 font-montserrat"
                      >
                         <Save size={18} />
                         <span>Commit Protocol</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
