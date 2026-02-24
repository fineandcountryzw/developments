/**
 * Live Lead Log Component
 * 
 * Real-time activity feed for admin dashboard.
 * Shows the last 20 forensic events with user avatars and action badges.
 * Auto-refreshes every 30 seconds for live monitoring.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
type ActivityType = {
  id: string;
  type: 'LOGIN' | 'RESERVATION' | 'PAYMENT_UPLOAD' | 'VERIFICATION' | 'STAND_UPDATE' | 'USER_CREATED' | 'AGENT_ASSIGNED';
  description: string;
  metadata: any;
  userId: string;
  createdAt: Date;
};

type ActivityEnum = ActivityType['type'];

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image: string | null;
};
import { getActivities } from '../../app/actions/activity';
import { 
  User as UserIcon,
  ShieldCheck,
  FileUp,
  CheckCircle2,
  Edit3,
  UserPlus,
  Users,
  LogIn,
  AlertCircle,
  Loader2,
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
} from 'lucide-react';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ActivityWithUser extends ActivityType {
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'image'>;
}

interface LeadLogProps {
  refreshInterval?: number; // milliseconds (default: 30000)
  maxItems?: number; // max activities to show (default: 20)
}

// ============================================
// ACTIVITY BADGE COMPONENT
// ============================================

interface ActivityBadgeProps {
  type: ActivityEnum;
}

function ActivityBadge({ type }: ActivityBadgeProps) {
  const badges: Record<ActivityEnum, { icon: React.ElementType; label: string; className: string }> = {
    LOGIN: {
      icon: LogIn,
      label: 'Login',
      className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    },
    RESERVATION: {
      icon: ShieldCheck,
      label: 'Reservation',
      className: 'bg-[#85754E]/10 text-[#85754E] border-[#85754E]/20',
    },
    PAYMENT_UPLOAD: {
      icon: FileUp,
      label: 'Payment Upload',
      className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    },
    VERIFICATION: {
      icon: CheckCircle2,
      label: 'Sale',
      className: 'bg-green-500/10 text-green-500 border-green-500/20',
    },
    STAND_UPDATE: {
      icon: Edit3,
      label: 'Update',
      className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    },
    USER_CREATED: {
      icon: UserPlus,
      label: 'New User',
      className: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    },
    AGENT_ASSIGNED: {
      icon: Users,
      label: 'Assignment',
      className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    },
  };

  const badge = badges[type];
  const Icon = badge.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {badge.label}
    </div>
  );
}

// ============================================
// USER AVATAR COMPONENT
// ============================================

interface UserAvatarProps {
  user: Pick<User, 'name' | 'email' | 'image'>;
}

function UserAvatar({ user }: UserAvatarProps) {
  // Get initials from name or email
  const getInitials = () => {
    if (user.name) {
      const parts = user.name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  // Generate consistent color from email
  const getBgColor = () => {
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-yellow-500',
      'bg-lime-500',
      'bg-green-500',
      'bg-emerald-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-sky-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-violet-500',
      'bg-purple-500',
      'bg-fuchsia-500',
      'bg-pink-500',
    ];
    
    const hash = user.email.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name || user.email}
        className="w-10 h-10 rounded-full object-cover border-2 border-[#0A1629]/10"
      />
    );
  }

  return (
    <div
      className={`w-10 h-10 rounded-full ${getBgColor()} flex items-center justify-center text-white text-sm font-bold border-2 border-[#0A1629]/10`}
    >
      {getInitials()}
    </div>
  );
}

// ============================================
// LEAD LOG COMPONENT
// ============================================

export default function LeadLog({ refreshInterval = 30000, maxItems = 20 }: LeadLogProps) {
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch activities
  const fetchActivities = async () => {
    try {
      const result = await getActivities({ limit: maxItems });
      
      if (result.success && result.activities) {
        setActivities(result.activities as ActivityWithUser[]);
        setError(null);
        setLastUpdate(new Date());
      } else {
        setError(result.error || 'Failed to load activities');
      }
    } catch (err) {
      console.error('[LEAD_LOG][ERROR]', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchActivities();
  }, []);

  // Auto-refresh interval (fallback if real-time fails)
  useEffect(() => {
    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Real-time updates for activities
  useRealtime({
    onActivity: async (event) => {
      if (event.action === 'created') {
        // Add new activity to the top of the list
        await fetchActivities();
      }
    },
    enabled: true
  });

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-[#0A1629]/10 p-8">
        <div className="flex items-center justify-center gap-3 text-[#0A1629]/40">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading activity log...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-500/20 p-8">
        <div className="flex items-center justify-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchActivities}
              className="text-xs text-red-500/70 hover:text-red-500 mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#0A1629]/10 p-8">
        <div className="text-center text-[#0A1629]/40">
          <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs mt-1">User actions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#0A1629]/10">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#0A1629]/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#0A1629]">Live Activity Feed</h3>
            <p className="text-sm text-[#0A1629]/60 mt-0.5">
              Real-time forensic log of all user actions
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#0A1629]/40">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Updated {formatRelativeTime(lastUpdate)}
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="divide-y divide-[#0A1629]/5">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="px-6 py-4 hover:bg-[#0A1629]/[0.02] transition-colors group"
            >
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <UserAvatar user={activity.user} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0A1629] truncate">
                        {activity.user.name || activity.user.email}
                      </p>
                      <p className="text-xs text-[#0A1629]/60">
                        {activity.user.role.toLowerCase()}
                      </p>
                    </div>
                    <ActivityBadge type={activity.type} />
                  </div>

                  <p className="text-sm text-[#0A1629]/80 mb-2">
                    {activity.description}
                  </p>

                  {/* Security Context (IP, Device, Browser) */}
                  {activity.metadata && typeof activity.metadata === 'object' && activity.metadata.security && (
                    <div className="flex items-center gap-3 text-xs text-[#0A1629]/60 mb-2">
                      {/* Device Type */}
                      {activity.metadata.security.deviceType === 'mobile' && (
                        <div className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          <span>Mobile</span>
                        </div>
                      )}
                      {activity.metadata.security.deviceType === 'tablet' && (
                        <div className="flex items-center gap-1">
                          <Tablet className="w-3 h-3" />
                          <span>Tablet</span>
                        </div>
                      )}
                      {activity.metadata.security.deviceType === 'desktop' && (
                        <div className="flex items-center gap-1">
                          <Monitor className="w-3 h-3" />
                          <span>Desktop</span>
                        </div>
                      )}
                      
                      {/* Browser & OS */}
                      {activity.metadata.security.browser && activity.metadata.security.os && (
                        <span className="text-[#0A1629]/40">
                          {activity.metadata.security.browser} · {activity.metadata.security.os}
                        </span>
                      )}
                      
                      {/* IP Address */}
                      {activity.metadata.security.ipAddress && (
                        <div className="flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3" />
                          <span>{activity.metadata.security.ipAddress}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Business Metadata (if exists) */}
                  {activity.metadata && typeof activity.metadata === 'object' && Object.keys(activity.metadata).length > 1 && (
                    <div className="bg-[#0A1629]/[0.03] rounded px-3 py-2 mb-2">
                      <code className="text-xs text-[#0A1629]/60 font-mono">
                        {JSON.stringify(
                          // Exclude security context from display (already shown above)
                          Object.fromEntries(
                            Object.entries(activity.metadata).filter(([key]) => key !== 'security')
                          ),
                          null,
                          2
                        )}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-[#0A1629]/40">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-[#0A1629]/10 bg-[#0A1629]/[0.02]">
        <div className="flex items-center justify-between text-xs text-[#0A1629]/60">
          <span>Showing {activities.length} recent activities</span>
          <button
            onClick={fetchActivities}
            className="text-[#85754E] hover:text-[#85754E]/80 font-medium"
          >
            Refresh now
          </button>
        </div>
      </div>
    </div>
  );
}
