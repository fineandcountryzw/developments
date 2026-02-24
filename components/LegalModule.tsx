
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSignature, FileText, Plus, Save, Eye, History, 
  ChevronRight, Users, CheckCircle2, AlertCircle, 
  ArrowRight, Variable, Code, Layout, ShieldCheck,
  FileSearch, Download, Trash2, Edit3, Loader2, Link as LinkIcon,
  X, Briefcase, Folder, Search, FileCheck, Layers, FileCode
} from 'lucide-react';
import { ContractTemplate, GeneratedContract, Branch, Client, Stand, Development, DevelopmentDocument, ContractStatus } from '../types.ts';
import { getClients, getStandsByClient, getDevelopments, getDevelopmentById, getTemplates, getContracts, saveTemplate, saveContract, downloadDocument, BRANCH_SETTINGS } from '../lib/db';
import { generateContractPDF } from '../services/contractService.ts';

/**
 * Agreements Module v4.0
 * Redesigned for F&C Gold Standard Agreement Management.
 */

export const LegalModule: React.FC<{ activeBranch: Branch }> = ({ activeBranch }) => {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [generatedContracts, setGeneratedContracts] = useState<GeneratedContract[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'vault' | 'generator'>('vault');
  const [vaultFolder, setVaultFolder] = useState<'MoA' | 'Addendum' | 'Annexure'>('MoA');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  
  // Added developments state to fix 'Cannot find name developments' error
  const [developments, setDevelopments] = useState<Development[]>([]);

  // Binding State
  const [bindingContract, setBindingContract] = useState<GeneratedContract | null>(null);
  const [availableDocs, setAvailableDocs] = useState<DevelopmentDocument[]>([]);
  const [selectedAnnexIds, setSelectedAnnexIds] = useState<string[]>([]);
  const [isBinding, setIsBinding] = useState(false);

  // Generator State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientStands, setClientStands] = useState<Stand[]>([]);
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [activeDev, setActiveDev] = useState<Development | null>(null);

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // Updated loadData to fetch developments
  const loadData = async () => {
    try {
      const [tmpls, contracts, cls, devs] = await Promise.all([
        getTemplates(activeBranch),
        getContracts(),
        getClients(),
        getDevelopments(activeBranch)
      ]);
      setTemplates(tmpls);
      setGeneratedContracts(contracts);
      setClients(cls);
      setDevelopments(devs);
    } catch (error) {
      console.error('[LegalModule] Error loading data:', error);
      // Set empty arrays on error to prevent crashes
      setTemplates([]);
      setGeneratedContracts([]);
      setClients([]);
      setDevelopments([]);
    }
  };

  const handleCreateTemplate = () => {
    const newTmpl: ContractTemplate = {
      id: `tmpl-${Date.now()}`,
      name: 'New Legal Instrument',
      content: '# NEW AGREEMENT\n\nGenerated on behalf of {{legal_name}}...',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branchContext: activeBranch,
      category: 'MoA'
    };
    setSelectedTemplate(newTmpl);
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    await saveTemplate(selectedTemplate);
    loadData();
    setIsEditorOpen(false);
  };

  const handleClientSelect = async (c: Client) => {
    setSelectedClient(c);
    const stands = await getStandsByClient(c.id);
    setClientStands(stands);
    // Document pick-up logic: automatically load available dev documents
    if (stands.length > 0) {
      const dev = await getDevelopmentById(stands[0].developmentId);
      if (dev) {
        setAvailableDocs(dev.documentUrls || []);
        setActiveDev(dev);
      }
    }
  };

  const handleStandSelect = async (s: Stand) => {
    setSelectedStand(s);
    const dev = await getDevelopmentById(s.developmentId);
    if (dev) {
      setActiveDev(dev);
      setAvailableDocs(dev.documentUrls || []);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedClient || !selectedStand || !activeDev) return;
    
    // Pass selected pick-up documents to bundle
    const annexesToBundle = availableDocs.filter(d => selectedAnnexIds.includes(d.id));

    await generateContractPDF(
      selectedTemplate,
      selectedClient,
      selectedStand,
      activeDev,
      BRANCH_SETTINGS[activeBranch],
      annexesToBundle
    );

    const newContract: GeneratedContract = {
      id: `cont-${Date.now()}`,
      clientId: selectedClient.id,
      standId: selectedStand.id,
      templateId: selectedTemplate.id,
      status: 'DRAFTING',
      createdAt: new Date().toISOString(),
      category: selectedTemplate.category,
      annexures: selectedAnnexIds
    };
    
    await saveContract(newContract);
    loadData();
    setActiveTab('vault');
    // Fix: Map 'Cession' to 'Addendum' folder for UI grouping
    setVaultFolder(selectedTemplate.category === 'Cession' ? 'Addendum' : selectedTemplate.category as any);
  };

  const handleDownloadVaultDoc = async (contract: GeneratedContract, fullBundle: boolean = false) => {
    const client = clients.find(cl => cl.id === contract.clientId);
    const template = templates.find(t => t.id === contract.templateId);
    const stand = await getStandsByClient(contract.clientId);
    const standData = stand.find(s => s.id === contract.standId);
    
    if (!client || !template || !standData) {
       setIsDownloading(contract.id);
       const name = client ? client.name.replace(/\s+/g, '_') : 'Client';
       const fileName = `${name}_${contract.standId}_Agreement.pdf`;
       await downloadDocument(`vault/${contract.id}`, fileName);
       setIsDownloading(null);
       return;
    }

    const dev = await getDevelopmentById(standData.developmentId);
    if (!dev) return;

    setIsDownloading(contract.id);
    const annexesToBundle = fullBundle ? (dev.documentUrls || []).filter((d: { id: string }) => contract.annexures?.includes(d.id)) : [];

    await generateContractPDF(
      template,
      client,
      standData,
      dev,
      BRANCH_SETTINGS[activeBranch],
      annexesToBundle
    );
    setIsDownloading(null);
  };

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case 'DRAFTING': return 'bg-white text-blue-600 border-blue-100';
      case 'SENT FOR SIGNATURE': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'EXECUTED': return 'bg-green-50 text-green-600 border-green-100';
      case 'STAMPED': return 'bg-fcGold/10 text-fcGold border-fcGold/20';
    }
  };

  return (
    <div className="animate-in fade-in duration-700 space-y-10 pb-20">
      {/* Tab Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-fcDivider w-fit shadow-sm">
        {[
          { id: 'vault', label: 'Agreement Vault', icon: Briefcase },
          { id: 'generator', label: 'Execution Core', icon: FileSignature },
          { id: 'library', label: 'Template Library', icon: Layers }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-3 px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all font-sans ${
              activeTab === tab.id ? 'bg-fcSlate text-white shadow-lg' : 'text-gray-600 hover:text-fcSlate'
            }`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'vault' && (
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Folders Navigation */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl border border-fcDivider shadow-sm overflow-hidden">
               <div className="p-6 border-b border-fcDivider">
                  <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-sans">Document Folders</h3>
               </div>
               <div className="p-2 space-y-1">
                  {[
                    { id: 'MoA', label: 'Sale Agreements (MoA)', icon: FileCheck },
                    { id: 'Addendum', label: 'Addendums & Cessions', icon: FileCode },
                    { id: 'Annexure', label: 'Binding Annexures', icon: LinkIcon }
                  ].map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => setVaultFolder(folder.id as any)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group ${
                        vaultFolder === folder.id ? 'bg-fcGold/5 text-fcGold shadow-sm' : 'text-gray-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <folder.icon size={16} className={vaultFolder === folder.id ? 'text-fcGold' : 'text-slate-300'} />
                        <span className="text-[11px] font-bold uppercase tracking-tight font-sans">{folder.label}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${vaultFolder === folder.id ? 'bg-fcGold text-white' : 'bg-slate-100 text-gray-600'}`}>
                        {folder.id === 'Annexure' 
                          ? developments.reduce((acc, d) => acc + (d.documentUrls?.length || 0), 0)
                          // Fix: Correctly count Cessions under the Addendum folder
                          : generatedContracts.filter(c => folder.id === 'Addendum' ? (c.category === 'Addendum' || c.category === 'Cession') : c.category === folder.id).length
                        }
                      </span>
                    </button>
                  ))}
               </div>
            </div>

            <div className="bg-fcGold p-8 rounded-[32px] shadow-xl shadow-fcGold/10 text-white space-y-4">
               <ShieldCheck size={28} />
               <h3 className="text-xl font-bold tracking-tight font-sans">Transactional Integrity</h3>
               <p className="text-[11px] font-medium leading-relaxed opacity-80 font-sans">
                 All agreements are forensically logged. Execution shifts are captured in the global ledger. Access is restricted via 5-minute expiring Signed URLs.
               </p>
            </div>
          </div>

          {/* Agreements Table */}
          <div className="col-span-12 lg:col-span-9 bg-white rounded-[32px] border border-fcDivider shadow-sm overflow-hidden min-h-[600px]">
            <div className="p-8 border-b border-fcDivider flex justify-between items-center bg-white">
              <div>
                <h3 className="text-lg font-bold text-fcSlate tracking-tight font-sans">{vaultFolder === 'MoA' ? 'Executed Sales' : vaultFolder === 'Addendum' ? 'Cession Registry' : 'Statutory Manifest'}</h3>
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Vault Branch: {activeBranch}</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search agreements..." 
                  className="bg-white border border-fcDivider rounded-full pl-10 pr-6 py-2.5 text-xs font-bold focus:ring-1 focus:ring-fcGold outline-none w-64 transition-all"
                />
              </div>
            </div>

            {vaultFolder === 'Annexure' ? (
               <div className="divide-y divide-slate-50">
                  {developments.map(dev => (
                    <div key={dev.id} className="p-8 space-y-6">
                       <div className="flex items-center space-x-3 text-fcGold">
                          <Folder size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest font-montserrat">{dev.name} Statutory Pack</span>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(dev.documentUrls || []).map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-5 bg-white/50 rounded-2xl border border-fcDivider group hover:border-fcGold/30 transition-all">
                               <div className="flex items-center space-x-4">
                                  <div className="p-2 bg-white rounded-lg text-gray-600 shadow-sm"><FileText size={16} /></div>
                                  <div>
                                     <div className="text-[11px] font-bold text-fcSlate font-montserrat">{doc.name}</div>
                                     <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">v{doc.version} • Posted {doc.uploadedAt}</div>
                                  </div>
                               </div>
                               <button 
                                onClick={() => downloadDocument(doc.url, doc.name)}
                                className="p-2 text-slate-300 hover:text-fcGold transition-colors"
                               >
                                 <Download size={18} />
                               </button>
                            </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/50 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
                      <th className="px-10 py-5">Agreement Title / Signatory</th>
                      <th className="px-10 py-5">Asset</th>
                      <th className="px-10 py-5">Execution Status</th>
                      <th className="px-10 py-5">Date Executed</th>
                      <th className="px-10 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* Fix: Group Cessions under the Addendum folder in the table view */}
                    {generatedContracts.filter(c => vaultFolder === 'Addendum' ? (c.category === 'Addendum' || c.category === 'Cession') : c.category === vaultFolder).map(c => {
                      const client = clients.find(cl => cl.id === c.clientId);
                      return (
                        <tr key={c.id} className="group hover:bg-white/50 transition-colors font-sans">
                          <td className="px-10 py-6">
                             <div className="text-[14px] font-bold text-fcSlate font-montserrat tracking-tight">{client?.name || 'Unknown'} - Agreement</div>
                             <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Ref: {c.id}</div>
                          </td>
                          <td className="px-10 py-6 text-sm font-bold text-fcGold font-mono">{c.standId}</td>
                          <td className="px-10 py-6">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border font-montserrat ${getStatusColor(c.status)}`}>
                               {c.status}
                             </span>
                          </td>
                          <td className="px-10 py-6 text-sm font-medium text-gray-600">
                             {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-10 py-6 text-right">
                             <div className="flex items-center justify-end space-x-2">
                                <button 
                                  onClick={() => handleDownloadVaultDoc(c, false)}
                                  className="p-3 bg-white text-gray-600 rounded-xl hover:bg-fcGold hover:text-white transition-all shadow-sm"
                                  title="View Agreement"
                                >
                                   <Eye size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDownloadVaultDoc(c, true)}
                                  className="p-3 bg-fcGold/10 text-fcGold rounded-xl hover:bg-fcGold hover:text-white transition-all shadow-sm"
                                  title="Download Bundle"
                                >
                                   <Briefcase size={16} />
                                </button>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'generator' && (
        <div className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white rounded-[40px] border border-fcDivider shadow-xl overflow-hidden">
             <div className="bg-fcSlate p-16 text-white flex justify-between items-center relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-fcGold/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="space-y-3 relative z-10">
                  <h2 className="text-4xl font-bold tracking-tightest font-montserrat">Execution Core</h2>
                  <p className="text-[11px] font-bold text-fcGold uppercase tracking-[0.4em] font-montserrat">Automated Transactional Drafting</p>
                </div>
                <ShieldCheck size={64} className="text-fcGold/20 relative z-10" />
             </div>

             <div className="p-16 space-y-16">
                <div className="grid grid-cols-2 gap-12">
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">1. Target Signatory</label>
                      <select 
                        onChange={(e) => {
                          const c = clients.find(cl => cl.id === e.target.value);
                          if (c) handleClientSelect(c);
                        }}
                        className="w-full bg-white border border-fcDivider rounded-2xl px-6 py-4 text-sm font-bold text-fcSlate focus:ring-1 focus:ring-fcGold outline-none"
                      >
                        <option value="">Select client account...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">2. Asset Selection</label>
                      <select 
                        disabled={!selectedClient}
                        onChange={(e) => {
                          const s = clientStands.find(st => st.id === e.target.value);
                          if (s) handleStandSelect(s);
                        }}
                        className="w-full bg-white border border-fcDivider rounded-2xl px-6 py-4 text-sm font-bold text-fcSlate focus:ring-1 focus:ring-fcGold outline-none disabled:opacity-30"
                      >
                        <option value="">Select inventory item...</option>
                        {clientStands.map(s => <option key={s.id} value={s.id}>{s.number} ({s.developmentName})</option>)}
                      </select>
                   </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">3. Choose Instrument Template</label>
                  <div className="grid grid-cols-3 gap-4">
                    {templates.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedTemplate(tmpl)}
                        className={`flex flex-col items-start p-6 rounded-3xl border transition-all space-y-4 ${selectedTemplate?.id === tmpl.id ? 'bg-fcGold/5 border-fcGold shadow-sm' : 'bg-white/50 border-fcDivider hover:border-slate-300'}`}
                      >
                        <div className={`p-3 rounded-xl ${selectedTemplate?.id === tmpl.id ? 'bg-fcGold text-white' : 'bg-white text-slate-300'}`}>
                          <FileSignature size={20} />
                        </div>
                        <div className="text-left">
                           <div className={`text-[12px] font-bold uppercase tracking-tight font-montserrat ${selectedTemplate?.id === tmpl.id ? 'text-fcGold' : 'text-gray-600'}`}>{tmpl.name}</div>
                           <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-1">v{tmpl.version} • {tmpl.category}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedTemplate && selectedClient && (
                  <div className="space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">4. Binding Annexures (Pick-up statutory docs)</label>
                       <span className="text-[9px] font-bold text-fcGold uppercase tracking-widest">Available for: {activeDev?.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       {availableDocs.map(doc => (
                         <button
                           key={doc.id}
                           onClick={() => {
                             setSelectedAnnexIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                           }}
                           className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${selectedAnnexIds.includes(doc.id) ? 'bg-fcGold/5 border-fcGold' : 'bg-white/50 border-fcDivider'}`}
                         >
                           <div className="flex items-center space-x-4">
                              <div className={`p-2 rounded-lg ${selectedAnnexIds.includes(doc.id) ? 'bg-fcGold text-white' : 'bg-white text-slate-300 border border-slate-100'}`}><LinkIcon size={14} /></div>
                              <span className={`text-[10px] font-bold uppercase font-montserrat ${selectedAnnexIds.includes(doc.id) ? 'text-fcGold' : 'text-gray-600'}`}>{doc.name}</span>
                           </div>
                           <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedAnnexIds.includes(doc.id) ? 'bg-fcGold border-fcGold text-white' : 'border-slate-200'}`}>
                              {selectedAnnexIds.includes(doc.id) && <CheckCircle2 size={12} />}
                           </div>
                         </button>
                       ))}
                       {availableDocs.length === 0 && (
                         <div className="col-span-2 py-8 text-center opacity-30 italic text-sm">No statutory docs available for pick-up.</div>
                       )}
                    </div>

                    <div className="pt-10 border-t border-fcDivider flex items-center justify-between">
                       <div className="space-y-1">
                          <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] font-montserrat">Transactional Checksum</h4>
                          <p className="text-sm font-bold text-fcSlate font-sans">Drafting {selectedTemplate.name} for {selectedClient.name}</p>
                       </div>
                       <button 
                        onClick={handleGenerate}
                        className="bg-fcGold text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-fcGold/20 hover:brightness-110 transition-all flex items-center justify-center space-x-4 font-montserrat"
                       >
                         <span>Execute Transactional Flow</span>
                         <ArrowRight size={18} />
                       </button>
                    </div>
                  </div>
                )}
             </div>
           </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="grid grid-cols-12 gap-12 items-start">
           <div className="col-span-4 space-y-6">
              <div className="bg-white rounded-2xl border border-fcDivider shadow-sm overflow-hidden">
                <div className="p-6 border-b border-fcDivider flex justify-between items-center bg-white">
                  <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">Drafting Studio</h3>
                  <button 
                    onClick={handleCreateTemplate}
                    className="p-2 bg-fcGold text-white rounded-lg hover:brightness-110 transition-all shadow-lg shadow-fcGold/20"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="divide-y divide-fcDivider">
                  {templates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => { setSelectedTemplate(tmpl); setIsEditorOpen(true); }}
                      className={`w-full text-left p-6 transition-all hover:bg-white flex items-center justify-between group ${selectedTemplate?.id === tmpl.id ? 'bg-fcGold/5 border-l-4 border-l-fcGold' : ''}`}
                    >
                      <div>
                        <div className={`text-[13px] font-bold font-montserrat transition-colors ${selectedTemplate?.id === tmpl.id ? 'text-fcGold' : 'text-fcSlate'}`}>{tmpl.name}</div>
                        <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">Version {tmpl.version} • {tmpl.category}</div>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
           </div>

           <div className="col-span-8">
             {isEditorOpen && selectedTemplate ? (
               <div className="bg-white rounded-[32px] border border-fcDivider shadow-xl overflow-hidden animate-in slide-in-from-right-4 duration-500">
                  <div className="p-8 border-b border-fcDivider flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="p-2.5 bg-fcGold/10 rounded-xl text-fcGold"><Edit3 size={18} /></div>
                      <div>
                         <h3 className="text-lg font-bold text-fcSlate tracking-tight font-montserrat">Instrument Editor</h3>
                         <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{selectedTemplate.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                       <button onClick={() => setIsEditorOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-6 font-montserrat">Discard</button>
                       <button onClick={handleSaveTemplate} className="bg-fcSlate text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-white transition-all flex items-center space-x-2 font-montserrat">
                          <Save size={14} />
                          <span>Commit Manifest</span>
                       </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 h-[600px]">
                     <div className="p-10 border-r border-fcDivider overflow-y-auto space-y-8">
                        <div className="space-y-4">
                           <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest font-montserrat">Instrument Metadata</label>
                           <div className="grid grid-cols-2 gap-4">
                              <input 
                                type="text" 
                                value={selectedTemplate.name}
                                onChange={(e) => setSelectedTemplate({...selectedTemplate, name: e.target.value})}
                                className="col-span-2 bg-white border border-fcDivider rounded-xl px-5 py-3 text-xs font-bold text-fcSlate outline-none"
                              />
                              <select 
                                value={selectedTemplate.category}
                                onChange={(e) => setSelectedTemplate({...selectedTemplate, category: e.target.value as any})}
                                className="bg-white border border-fcDivider rounded-xl px-4 py-3 text-[10px] font-bold text-fcSlate outline-none uppercase"
                              >
                                 <option value="MoA">Standard MoA</option>
                                 <option value="Addendum">Addendum</option>
                                 <option value="Cession">Cession</option>
                              </select>
                           </div>
                        </div>
                        <textarea 
                          rows={15}
                          value={selectedTemplate.content}
                          onChange={(e) => setSelectedTemplate({...selectedTemplate, content: e.target.value})}
                          className="w-full bg-white text-green-400 p-8 rounded-2xl font-mono text-[11px] outline-none resize-none leading-relaxed shadow-inner"
                        />
                     </div>
                     <div className="p-10 bg-fcCream/30 overflow-y-auto space-y-8">
                        <div className="flex items-center justify-between text-fcGold">
                           <Variable size={16} />
                           <span className="text-[10px] font-bold uppercase tracking-widest font-montserrat">Heuristic Preview</span>
                        </div>
                        <div className="bg-white p-12 rounded-[28px] shadow-sm border border-fcDivider text-[12px] text-gray-600 whitespace-pre-wrap leading-relaxed font-serif min-h-[400px]">
                           {selectedTemplate.content}
                        </div>
                     </div>
                  </div>
               </div>
             ) : (
               <div className="h-[700px] flex flex-col items-center justify-center bg-white rounded-[32px] border border-fcDivider opacity-40 text-center space-y-6 shadow-sm">
                  <div className="p-10 bg-fcCream rounded-full">
                    <FileSignature size={80} strokeWidth={1} className="text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-bold text-fcSlate tracking-tight font-montserrat">Library Console Idle</h3>
                  <p className="text-sm font-medium text-gray-600 max-w-sm font-sans">Select or create a legal instrument to begin the compliance drafting cycle.</p>
               </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};
