/**
 * Admin Command Center Component
 * 
 * Unified dashboard combining:
 * - Left: System Diagnostics (Neon, Resend, UploadThing health)
 * - Right: Live Lead Log (Real-time activity feed)
 * - Bottom: Active Reservations (72-hour countdown table)
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertCircle, Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import LeadLog from './admin/LeadLog';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DiagnosticData {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  database: {
    status: 'operational' | 'degraded' | 'offline';
    latencyMs: number;
    coldStart: boolean;
  };
  auth: {
    status: 'operational' | 'degraded' | 'offline';
    activeSessions24h: number;
    totalUsers: number;
  };
  email: {
    status: 'operational' | 'degraded' | 'offline';
    deliveryRate: number;
    lastChecked: string;
  };
  storage: {
    status: 'operational' | 'degraded' | 'offline';
    usagePercent: number;
    totalBytes: number;
  };
  businessMetrics: {
    activeHolds: number;
    leadVelocity: Array<{
      date: string;
      reservations: number;
      confirmations: number;
    }>;
  };
}

interface ActiveReservation {
  id: string;
  standNumber: string;
  developmentName: string;
  clientName: string;
  clientEmail: string;
  expiresAt: string;
  timeRemaining: string;
  status: 'PENDING' | 'PAYMENT_PENDING';
}

// ============================================
// VITAL SIGN CARD COMPONENT
// ============================================

interface VitalSignCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'critical';
  icon: React.ElementType;
  subtitle?: string;
}

function VitalSignCard({ title, value, unit, status, icon: Icon, subtitle }: VitalSignCardProps) {
  const statusColors = {
    good: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    critical: 'bg-red-500/10 border-red-500/20',
  };

  const textColors = {
    good: 'text-green-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
  };

  return (
    <div className={`border rounded-lg p-4 ${statusColors[status]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded ${statusColors[status]}`}>
          <Icon className={`w-5 h-5 ${textColors[status]}`} />
        </div>
        {status === 'good' && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Healthy</span>
          </div>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-fcSlate/60 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${textColors[status]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm text-fcSlate/40 font-medium">{unit}</span>
        )}
      </div>
      
      {subtitle && (
        <p className="text-xs text-fcSlate/40 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================
// MAIN COMMAND CENTER COMPONENT
// ============================================

export const CommandCenter: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [reservations, setReservations] = useState<ActiveReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch diagnostics data
  const fetchDiagnostics = async () => {
    try {
      const response = await fetch('/api/admin/diagnostics');
      if (!response.ok) throw new Error('Failed to fetch diagnostics');
      
      const data = await response.json();
      setDiagnostics(data);
      setError(null);
    } catch (err) {
      console.error('[COMMAND_CENTER][ERROR]', err);
      setError('Failed to load diagnostics');
    }
  };

  // Fetch active reservations
  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/admin/active-reservations');
      if (!response.ok) throw new Error('Failed to fetch reservations');
      
      const data = await response.json();
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('[COMMAND_CENTER][RESERVATIONS_ERROR]', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    Promise.all([fetchDiagnostics(), fetchReservations()])
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDiagnostics();
      fetchReservations();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-fcCream flex items-center justify-center">
        <div className="flex items-center gap-3 text-fcSlate/60">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Loading Command Center...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !diagnostics) {
    return (
      <div className="min-h-screen bg-fcCream flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-fcSlate mb-2">Failed to Load</h2>
          <p className="text-fcSlate/60 mb-4">{error || 'Unknown error'}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchDiagnostics().finally(() => setLoading(false));
            }}
            className="px-4 py-2 bg-fcGold text-white rounded-lg hover:bg-fcGold/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Ensure diagnostics and nested properties exist before accessing
  const dbLatency = diagnostics?.database?.latencyMs ?? 0;
  const dbStatus = dbLatency < 100 ? 'good' : 
                   dbLatency < 500 ? 'warning' : 'critical';
  
  const emailDeliveryRate = diagnostics?.email?.deliveryRate ?? 0;
  const emailStatus = emailDeliveryRate >= 95 ? 'good' :
                      emailDeliveryRate >= 80 ? 'warning' : 'critical';
  
  const activeHolds = diagnostics?.businessMetrics?.activeHolds ?? 0;
  const holdsStatus = activeHolds < 10 ? 'good' :
                      activeHolds < 20 ? 'warning' : 'critical';

  return (
    <div className="w-full min-w-0 min-h-screen bg-fcCream">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-fcGold rounded">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-fcSlate">Admin Command Center</h1>
          </div>
          <p className="text-fcSlate/60">
            Real-time system diagnostics, activity monitoring, and reservation management
          </p>
        </div>

        {/* Top Row: Diagnostics + Lead Log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Left Column: System Diagnostics */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Vital Signs */}
            <div>
              <h2 className="text-xl font-bold text-fcSlate mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-fcGold" />
                System Vital Signs
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <VitalSignCard
                  title="Database Latency"
                  value={dbLatency}
                  unit="ms"
                  status={dbStatus}
                  icon={Activity}
                  subtitle={diagnostics?.database?.coldStart ? 'Cold start detected' : 'Connection warm'}
                />
                
                <VitalSignCard
                  title="Email Health"
                  value={emailDeliveryRate.toFixed(1)}
                  unit="%"
                  status={emailStatus}
                  icon={Activity}
                  subtitle={`${emailDeliveryRate >= 95 ? 'Excellent' : 'Needs attention'} delivery rate`}
                />
                
                <VitalSignCard
                  title="Active Holds"
                  value={activeHolds}
                  unit="pending"
                  status={holdsStatus}
                  icon={Clock}
                  subtitle="72-hour reservations"
                />
              </div>
            </div>

            {/* Service Status */}
            <div className="bg-white rounded-lg border border-fcSlate/10 p-6">
              <h3 className="text-lg font-bold text-fcSlate mb-4">Service Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <ServiceStatusBadge 
                  name="Neon Database" 
                  status={diagnostics?.database?.status ?? 'offline'} 
                />
                <ServiceStatusBadge 
                  name="Better Auth" 
                  status={diagnostics?.auth?.status ?? 'offline'} 
                />
                <ServiceStatusBadge 
                  name="Resend Email" 
                  status={diagnostics?.email?.status ?? 'offline'} 
                />
                <ServiceStatusBadge 
                  name="UploadThing" 
                  status={diagnostics?.storage?.status ?? 'offline'} 
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Lead Log */}
          <div className="lg:col-span-1">
            <LeadLog refreshInterval={30000} maxItems={15} />
          </div>
        </div>

        {/* Bottom Row: Active Reservations */}
        {reservations.length > 0 && (
          <div className="bg-white rounded-lg border border-fcSlate/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-fcSlate">Active 72-Hour Countdown</h3>
                  <p className="text-sm text-fcSlate/60 mt-0.5">
                    {reservations.length} reservation{reservations.length !== 1 ? 's' : ''} pending payment confirmation
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-fcGold">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Live Timer</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-fcSlate/[0.02]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-fcSlate/60 uppercase tracking-wider">Stand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-fcSlate/60 uppercase tracking-wider">Development</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-fcSlate/60 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-fcSlate/60 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-fcSlate/60 uppercase tracking-wider">Time Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fcSlate/5">
                  {reservations.map((reservation) => {
                    const hoursLeft = Math.floor(
                      (new Date(reservation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
                    );
                    const isUrgent = hoursLeft < 12;
                    
                    return (
                      <tr key={reservation.id} className="hover:bg-fcSlate/[0.02] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-fcSlate">{reservation.standNumber}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-fcSlate/80">{reservation.developmentName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-fcSlate">{reservation.clientName}</p>
                            <p className="text-xs text-fcSlate/60">{reservation.clientEmail}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            reservation.status === 'PAYMENT_PENDING'
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}>
                            {reservation.status === 'PAYMENT_PENDING' ? 'Payment Uploaded' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-fcGold'}`} />
                            <span className={`text-sm font-mono font-medium ${isUrgent ? 'text-red-600' : 'text-fcSlate'}`}>
                              {reservation.timeRemaining}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for service status badges
function ServiceStatusBadge({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-fcSlate/[0.02] rounded">
      <span className="text-sm font-medium text-fcSlate">{name}</span>
      <span className={`text-xs px-2 py-1 rounded ${
        status === 'operational'
          ? 'bg-green-500/10 text-green-600'
          : 'bg-amber-500/10 text-amber-600'
      }`}>
        {status}
      </span>
    </div>
  );
}
