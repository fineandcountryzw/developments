"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = "" }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(data.data.unreadCount);
        }
      }
    } catch (error) {
      console.error("[NotificationBell] Failed to fetch unread count:", error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Handle mark as read
  const handleMarkAsRead = async (ids: string[]) => {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update local count
          setUnreadCount((prev) => Math.max(0, prev - data.data.markedAsRead));
        }
      }
    } catch (error) {
      console.error("[NotificationBell] Failed to mark as read:", error);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(0);
        }
      }
    } catch (error) {
      console.error("[NotificationBell] Failed to mark all as read:", error);
    }
  };

  // Handle dropdown open
  const handleDropdownOpen = () => {
    setIsDropdownOpen(true);
    fetchUnreadCount();
  };

  // Handle dropdown close
  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => (isDropdownOpen ? handleDropdownClose() : handleDropdownOpen())}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full min-w-[18px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <NotificationDropdown
          onClose={handleDropdownClose}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
}
