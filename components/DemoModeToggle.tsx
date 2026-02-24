/**
 * Demo Mode Toggle Component
 * 
 * Allows users to easily enable/disable demo data mode
 * Shows in development mode only
 */

import { useState, useEffect } from 'react';
import { Database, X } from 'lucide-react';
import { initDemoData, clearDemoData, isDemoMode, getAllDemoData } from '../lib/demo-data';

export function DemoModeToggle() {
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const enabled = isDemoMode();
    setDemoEnabled(enabled);
    setShowBanner(enabled);
  }, []);

  const enableDemoMode = () => {
    initDemoData();
    setDemoEnabled(true);
    setShowBanner(true);
    window.location.reload();
  };

  const disableDemoMode = () => {
    clearDemoData();
    setDemoEnabled(false);
    setShowBanner(false);
    window.location.reload();
  };

  const demoData = demoEnabled ? getAllDemoData() : null;

  // Only show in development or when demo is enabled
  if (typeof window !== 'undefined' && !demoEnabled) {
    // Check if we're in production build (use process.env.NODE_ENV for Next.js)
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) return null;
  }

  return (
    <>
      {/* Demo Mode Banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5" />
              <div>
                <p className="font-semibold">Demo Mode Active</p>
                <p className="text-xs opacity-90">
                  Using mock data: {demoData?.developments.length || 0} developments, 
                  {' '}{demoData?.stands.length || 0} stands, 
                  {' '}{demoData?.clients.length || 0} clients
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={disableDemoMode}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition"
              >
                Disable Demo Mode
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="p-1 hover:bg-white/20 rounded transition"
                title="Hide banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button (when not in demo mode) */}
      {!demoEnabled && (
        <button
          onClick={enableDemoMode}
          className="fixed bottom-4 right-4 z-[9998] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 group"
          title="Enable demo data mode"
        >
          <Database className="w-4 h-4 group-hover:animate-pulse" />
          <span className="font-medium">Enable Demo Data</span>
        </button>
      )}
    </>
  );
}
