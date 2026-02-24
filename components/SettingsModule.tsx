
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Globe, Landmark, ShieldCheck, Mail, Phone, MapPin, Loader2, Image as ImageIcon, Info, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { UploadButton } from '@uploadthing/react';
import { CompanySettings, Branch } from '../types.ts';
import { saveSettings, BRANCH_SETTINGS } from '../lib/db';
import type { OurFileRouter } from '../app/api/uploadthing/core';

interface SettingsModuleProps {
  activeBranch: Branch;
  onSettingsUpdate: (settings: CompanySettings) => void;
  onLogoUpdate?: (logoUrl: string) => void; // Callback to notify parent of logo changes
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ activeBranch, onSettingsUpdate, onLogoUpdate }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch>(activeBranch);
  const [settings, setSettings] = useState<CompanySettings>({ ...BRANCH_SETTINGS[selectedBranch] });
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [currentDbLogoUrl, setCurrentDbLogoUrl] = useState<string | null>(null);

  // Fetch current settings from database (per branch) to hydrate fields that must persist server-side.
  useEffect(() => {
    const fetchCurrentSettings = async () => {
      try {
        const response = await fetch(`/api/admin/settings?branch=${encodeURIComponent(selectedBranch)}`);
        if (response.ok) {
          const data = await response.json();
          const dbSettings = data.data || {};

          if (dbSettings.logo_url) {
            setCurrentDbLogoUrl(dbSettings.logo_url);
          }

          // Merge only server-backed fields into the local branch settings state.
          setSettings((prev) => ({
            ...prev,
            logo_url: dbSettings.logo_url || prev.logo_url,
            principalAgentName: dbSettings.principalAgentName ?? prev.principalAgentName ?? '',
            principalAgentEmail: dbSettings.principalAgentEmail ?? prev.principalAgentEmail ?? '',
          }));
        }
      } catch (err) {
        console.error('[SettingsModule] Failed to fetch branch settings from DB:', err);
      }
    };
    fetchCurrentSettings();
  }, [selectedBranch]);

  /**
   * Save logo to database for both branches
   * Returns true if successful, false otherwise
   */
  const saveLogoToDatabase = async (newLogoUrl: string): Promise<boolean> => {
    setIsSaving(true);
    console.log('[SettingsModule] Saving logo URL to database:', newLogoUrl);
    
    try {
      // Save logo to database for Harare
      const harareResponse = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'Harare',
          logo_url: newLogoUrl
        })
      });

      if (!harareResponse.ok) {
        const errorData = await harareResponse.json();
        throw new Error(errorData.error || 'Failed to save logo for Harare');
      }

      // Save logo to database for Bulawayo
      const bulawayoResponse = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: 'Bulawayo',
          logo_url: newLogoUrl
        })
      });

      if (!bulawayoResponse.ok) {
        const errorData = await bulawayoResponse.json();
        throw new Error(errorData.error || 'Failed to save logo for Bulawayo');
      }

      // Verify the save by fetching back
      const verifyResponse = await fetch('/api/admin/settings?branch=Harare');
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log('[SettingsModule] Verified logo in DB:', verifyData.data?.logo_url);
        setCurrentDbLogoUrl(verifyData.data?.logo_url);
      }

      return true;
    } catch (err: any) {
      console.error('[SettingsModule] Error saving logo:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle successful logo upload from UploadButton
   */
  const handleUploadComplete = async (res: Array<{ url: string }>) => {
    setIsUploading(false);
    
    if (res && res.length > 0) {
      const uploadedLogoUrl = res[0].url;
      console.log('[SettingsModule] Upload complete. Logo URL:', uploadedLogoUrl);

      try {
        await saveLogoToDatabase(uploadedLogoUrl);

        // Update BRANCH_SETTINGS in memory
        BRANCH_SETTINGS.Harare.logo_url = uploadedLogoUrl;
        BRANCH_SETTINGS.Bulawayo.logo_url = uploadedLogoUrl;

        // Local State Sync
        const updatedSettings = { ...settings, logo_url: uploadedLogoUrl };
        setSettings(updatedSettings);
        onSettingsUpdate(updatedSettings);
        
        // Notify parent about logo change (for App.tsx to refresh)
        if (onLogoUpdate) {
          onLogoUpdate(uploadedLogoUrl);
        }
        
        setNotification({ msg: 'Logo saved to database & applied to both branches!', type: 'success' });
        setTimeout(() => setNotification(null), 4000);
      } catch (err: any) {
        console.error('[Logo Upload Error]', err);
        setNotification({ msg: err.message || 'Failed to save logo to database', type: 'error' });
        setTimeout(() => setNotification(null), 6000);
      }
    }
  };

  const handleUploadError = (error: Error) => {
    console.error('[Logo Upload Error]', error);
    setNotification({ msg: `Upload failed: ${error.message}`, type: 'error' });
  };

  const handleSetLogoUrl = async () => {
    if (!logoUrl.trim()) {
      setNotification({ msg: 'Please paste a logo URL', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    // Validate URL format
    try {
      new URL(logoUrl);
    } catch {
      setNotification({ msg: 'Please enter a valid URL', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    console.log('[SettingsModule] Setting logo from URL:', logoUrl);

    try {
      await saveLogoToDatabase(logoUrl);

      // Update BRANCH_SETTINGS in memory
      BRANCH_SETTINGS.Harare.logo_url = logoUrl;
      BRANCH_SETTINGS.Bulawayo.logo_url = logoUrl;

      // Local State Sync
      const updatedSettings = { ...settings, logo_url: logoUrl };
      setSettings(updatedSettings);
      onSettingsUpdate(updatedSettings);
      
      // Notify parent about logo change
      if (onLogoUpdate) {
        onLogoUpdate(logoUrl);
      }
      
      setLogoUrl('');
      
      setNotification({ msg: 'Logo URL saved to database & applied to both branches!', type: 'success' });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('[Logo URL Error]', err);
      setNotification({ msg: err.message || 'Failed to save logo', type: 'error' });
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Persist locally for immediate UI continuity.
      await saveSettings(settings);
      (BRANCH_SETTINGS as any)[selectedBranch] = settings;

      // Persist the fields the backend requires (contracts/signing workflow).
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: selectedBranch,
          logo_url: settings.logo_url,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          principal_agent_name: settings.principalAgentName || '',
          principal_agent_email: settings.principalAgentEmail || '',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save branch settings to database');
      }

      if (selectedBranch === activeBranch) {
        onSettingsUpdate(settings);
      }

      setNotification({ msg: `${selectedBranch} Settings Saved Successfully`, type: 'success' });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('[SettingsModule] Save settings error:', err);
      setNotification({ msg: err.message || 'Failed to save settings', type: 'error' });
      setTimeout(() => setNotification(null), 6000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-screen-lg space-y-8 animate-in fade-in duration-700 pb-20 relative">
      
      {/* Dynamic Toast Feedback in F&C Gold */}
      {notification && (
        <div className={`fixed top-24 right-12 z-[200] flex items-center space-x-4 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-8 duration-500 ${
          notification.type === 'success' ? 'bg-[#85754E] text-white border-fcGold/30' : 'bg-red-600 text-white border-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-xs font-bold uppercase tracking-widest">{notification.msg}</span>
        </div>
      )}

      {/* Branch Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-white rounded-lg text-fcGold">
            <Globe size={18} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Configure Branch</h3>
        </div>
        <div className="flex space-x-4">
          {(['Harare', 'Bulawayo'] as Branch[]).map((branch) => (
            <button
              key={branch}
              onClick={() => {
                setSelectedBranch(branch);
                setSettings({ ...BRANCH_SETTINGS[branch] });
              }}
              className={`flex-1 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
                selectedBranch === branch
                  ? 'bg-fcGold text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4 flex items-center space-x-2">
          <Info size={14} />
          <span>Logo uploads apply to both Harare and Bulawayo branches</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Identity & Asset Management */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
               <div className="p-2 bg-white rounded-lg text-fcGold">
                 <ImageIcon size={18} />
               </div>
               <h3 className="text-lg font-bold text-gray-900">Brand identity</h3>
            </div>
            <div className="p-8 space-y-8">
               <div 
                 className={`relative group aspect-square bg-white border border-gray-200 rounded-xl flex items-center justify-center transition-all overflow-hidden shadow-inner`}
               >
                 {isUploading ? (
                   <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col space-y-3 z-10">
                     <Loader2 size={32} className="text-fcGold animate-spin" />
                     <span className="text-[10px] font-bold text-fcGold uppercase tracking-widest">Uploading Logo...</span>
                   </div>
                 ) : settings.logo_url ? (
                   <>
                     <img 
                       src={settings.logo_url} 
                       alt="Logo" 
                       className="w-full h-full object-contain p-8 group-hover:opacity-20 transition-opacity" 
                     />
                     <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 backdrop-blur-[2px]">
                       <Camera size={24} className="text-fcGold mb-2" />
                       <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Change Logo</span>
                     </div>
                   </>
                 ) : (
                    <div className="flex flex-col items-center space-y-4">
                       <div className="w-16 h-16 bg-white rounded flex items-center justify-center text-white font-bold text-xl opacity-10 group-hover:opacity-100 transition-opacity">F&C</div>
                       <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">Fine & Country Logo</span>
                    </div>
                 )}
                 
                 {/* UploadButton overlaid */}
                 <div className="absolute inset-0 flex items-center justify-center">
                   <UploadButton<OurFileRouter, 'branchLogo'>
                     endpoint="branchLogo"
                     input={{ branch: selectedBranch }}
                     onClientUploadComplete={handleUploadComplete}
                     onUploadBegin={() => setIsUploading(true)}
                     onUploadError={handleUploadError}
                     appearance={{
                       button: "hidden",
                       allowedContent: "hidden",
                       container: "w-full h-full"
                     }}
                     content={{
                       button: "",
                       allowedContent: ""
                     }}
                     className="w-full h-full"
                   />
                 </div>
               </div>
               
               <div className="space-y-4">
                  <p className="text-sm text-gray-600 font-medium leading-relaxed">
                    Define the visual signature for both Harare and Bulawayo branches. Logo updates apply globally to both locations.
                  </p>
                  
                  {/* Quick URL Input */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Paste logo URL here..."
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fcGold"
                    />
                    {logoUrl && (
                      <button
                        onClick={handleSetLogoUrl}
                        className="w-full px-4 py-2 bg-fcGold text-white text-sm font-bold rounded-lg hover:bg-opacity-90 transition-all"
                      >
                        Apply Logo URL
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 text-[10px] text-fcGold bg-fcGold/10 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    <span>Shared Brand Identity • Both Branches</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Branch Details */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
               <div className="p-2 bg-white rounded-lg text-fcGold">
                 <Landmark size={18} />
               </div>
               <h3 className="text-lg font-bold text-gray-900">Branch Details</h3>
            </div>
            
            <div className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Administrative entity</label>
                  <input 
                    type="text" 
                    value={settings.legal_name}
                    onChange={(e) => setSettings({...settings, legal_name: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                    placeholder="Pvt Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Registry number</label>
                  <input 
                    type="text" 
                    value={settings.registration_number}
                    onChange={(e) => setSettings({...settings, registration_number: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                    placeholder="Registry ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Taxation identifier</label>
                  <input 
                    type="text" 
                    value={settings.vat_number}
                    onChange={(e) => setSettings({...settings, vat_number: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                    placeholder="VAT ZW-X"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Communication footer email</label>
                  <input 
                    type="email" 
                    value={settings.email}
                    onChange={(e) => setSettings({...settings, email: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Contract signing contacts</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-fcGold bg-fcGold/10 px-3 py-1.5 rounded-full">
                    Principal Agent Required
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Principal Agent (Fine &amp; Country) email</label>
                    <input
                      type="email"
                      value={settings.principalAgentEmail || ''}
                      onChange={(e) => setSettings({ ...settings, principalAgentEmail: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                      placeholder="[email protected]"
                    />
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                      This email is used when sending contracts for e-signature for the selected branch.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Principal Agent name (optional)</label>
                    <input
                      type="text"
                      value={settings.principalAgentName || ''}
                      onChange={(e) => setSettings({ ...settings, principalAgentName: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                      placeholder="Principal Agent"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t border-gray-100">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Regional headquarters address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="text" 
                    value={settings.address}
                    onChange={(e) => setSettings({...settings, address: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-fcGold focus:border-fcGold outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="bg-white text-white px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-white transition-all flex items-center space-x-3"
              >
                <Save size={16} />
                <span>Synchronize administrative core</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
