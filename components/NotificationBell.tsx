import React, { useEffect, useState } from 'react';
import { Bell, Dot } from 'lucide-react';
import { getNotificationsForRecipient, getNotificationsForBranch, realtime } from '../lib/db';
import { Branch, Notification } from '../types.ts';

interface NotificationBellProps {
  branch?: Branch;
  recipientType?: 'Agent' | 'Client';
  recipientId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ branch, recipientType, recipientId }) => {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [hasNew, setHasNew] = useState(false);

  const load = async () => {
    let items: Notification[] = [];
    if (recipientType && recipientId) {
      items = await getNotificationsForRecipient(recipientType, recipientId);
    } else if (branch) {
      items = await getNotificationsForBranch(branch);
    }
    setNotifs(items);
  };

  useEffect(() => {
    load();
    const dispose = realtime.on('notifications:new', (payload: any) => {
      const incoming: Notification[] = [payload.agent, payload.client].filter(Boolean);
      const forRecipient = recipientType && recipientId 
        ? incoming.filter(n => n.recipientType === recipientType && n.recipientId === recipientId)
        : incoming.filter(n => branch ? n.branch === branch : true);
      if (forRecipient.length > 0) {
        setHasNew(true);
        setNotifs(prev => [...forRecipient, ...prev]);
      }
    });
    return () => { dispose && dispose(); };
  }, [branch, recipientType, recipientId]);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setHasNew(false); }}
        className="relative p-3 bg-fcCream text-fcSlate rounded-xl border border-fcDivider hover:bg-white transition-all flex items-center font-sans"
        title="Notifications"
      >
        <Bell size={18} />
        {hasNew && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[#85754E]">New</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-fcDivider overflow-hidden">
          <div className="p-4 border-b border-fcDivider flex items-center justify-between bg-[#F9F8F6]">
            <span className="text-[10px] font-black uppercase tracking-widest text-fcSlate font-sans">Activity Feed</span>
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest font-sans">
              {recipientType && recipientId ? `${recipientType}: ${recipientId}` : branch ? (branch === 'Harare' ? 'Harare (HQ)' : 'Bulawayo (Branch)') + ' REGION' : 'Global'}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="p-8 text-center text-[10px] font-bold text-gray-600 uppercase tracking-widest font-sans">No notifications</div>
            ) : notifs.map(n => (
              <div key={n.id} className="p-4 border-b border-fcDivider bg-white hover:bg-[#F9F8F6] transition-colors">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold text-[#0F172A] leading-tight font-sans">{n.message}</p>
                  <span className="text-[9px] font-bold text-[#85754E] uppercase tracking-widest font-sans">NEW</span>
                </div>
                <div className="mt-2 text-[9px] font-bold text-gray-600 uppercase tracking-widest font-sans">
                  {new Date(n.timestamp).toLocaleString('en-GB')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
