"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Check, CheckCheck, Loader2, FileText, DollarSign, User, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  title: string;
  message: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
  entityType: string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface NotificationDropdownProps {
  onClose: () => void;
  onMarkAsRead: (ids: string[]) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  unreadCount: number;
}

// Icon mapping based on notification type
const getNotificationIcon = (type: string, severity: string) => {
  const iconClass = severity === "CRITICAL" ? "text-red-500" : severity === "WARN" ? "text-amber-500" : "text-blue-500";
  
  if (type.includes("CONTRACT")) return <FileText className={`w-4 h-4 ${iconClass}`} />;
  if (type.includes("PAYMENT")) return <DollarSign className={`w-4 h-4 ${iconClass}`} />;
  if (type.includes("USER")) return <User className={`w-4 h-4 ${iconClass}`} />;
  if (type.includes("ACCESS")) return <Shield className={`w-4 h-4 ${iconClass}`} />;
  return <AlertCircle className={`w-4 h-4 ${iconClass}`} />;
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function NotificationDropdown({
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  unreadCount,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications?limit=10");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.data.notifications);
        }
      }
    } catch (error) {
      console.error("[NotificationDropdown] Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Handle mark as read for a single notification
  const handleMarkAsReadClick = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (notification.isRead) return;

    await onMarkAsRead([notification.id]);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
  };

  // Handle mark all as read
  const handleMarkAllAsReadClick = async () => {
    setIsMarkingAll(true);
    await onMarkAllAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setIsMarkingAll(false);
  };

  // Get link for notification based on entity type
  const getNotificationLink = (notification: Notification): string => {
    switch (notification.entityType) {
      case "CONTRACT":
        return `/contracts/${notification.entityId}`;
      case "PAYMENT":
        return `/payments/${notification.entityId}`;
      case "DEVELOPMENT":
        return `/developments/${notification.entityId}`;
      case "STAND":
        return `/stands/${notification.entityId}`;
      case "USER":
        return `/admin/users/${notification.entityId}`;
      default:
        return "#";
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsReadClick}
              disabled={isMarkingAll}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
            >
              {isMarkingAll ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCheck className="w-3 h-3" />
              )}
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLink(notification)}
                className={`flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${
                  !notification.isRead ? "bg-blue-50/50" : ""
                }`}
                onClick={() => !notification.isRead && onMarkAsRead([notification.id])}
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type, notification.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
                    {notification.title}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                    {notification.actor?.name && (
                      <span className="text-xs text-gray-400">
                        by {notification.actor.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mark as read button */}
                {!notification.isRead && (
                  <button
                    onClick={(e) => handleMarkAsReadClick(e, notification)}
                    className="flex-shrink-0 p-1 hover:bg-blue-100 rounded-full transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-blue-500" />
                  </button>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
        <Link
          href="/notifications"
          className="text-sm text-primary hover:text-primary/80 font-medium"
          onClick={onClose}
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
