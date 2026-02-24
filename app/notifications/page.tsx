"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  FileText,
  DollarSign,
  User,
  Shield,
  AlertCircle,
  ChevronLeft,
  Filter,
  Trash2,
} from "lucide-react";

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
  developmentId?: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

// Icon mapping based on notification type
const getNotificationIcon = (type: string, severity: string) => {
  const iconClass =
    severity === "CRITICAL"
      ? "text-red-500 bg-red-50"
      : severity === "WARN"
      ? "text-amber-500 bg-amber-50"
      : "text-blue-500 bg-blue-50";

  const icon = (() => {
    if (type.includes("CONTRACT")) return <FileText className="w-5 h-5" />;
    if (type.includes("PAYMENT")) return <DollarSign className="w-5 h-5" />;
    if (type.includes("USER")) return <User className="w-5 h-5" />;
    if (type.includes("ACCESS")) return <Shield className="w-5 h-5" />;
    return <Bell className="w-5 h-5" />;
  })();

  return <div className={`p-2 rounded-full ${iconClass}`}>{icon}</div>;
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
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Format full date
const formatFullDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (page: number = 1) => {
      try {
        setIsLoading(true);
        const unreadOnly = filter === "unread" ? "true" : "false";
        const response = await fetch(
          `/api/notifications?page=${page}&limit=20&unreadOnly=${unreadOnly}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            if (page === 1) {
              setNotifications(data.data.notifications);
            } else {
              setNotifications((prev) => [
                ...prev,
                ...data.data.notifications,
              ]);
            }
            setPagination(data.pagination);
          }
        }
      } catch (error) {
        console.error("[NotificationsPage] Failed to fetch:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [filter]
  );

  // Initial fetch and when filter changes
  useEffect(() => {
    if (status === "authenticated") {
      fetchNotifications(1);
    }
  }, [fetchNotifications, status]);

  // Handle mark as read
  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          )
        );
      }
    } catch (error) {
      console.error("[NotificationsPage] Failed to mark as read:", error);
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            isRead: true,
            readAt: new Date().toISOString(),
          }))
        );
      }
    } catch (error) {
      console.error("[NotificationsPage] Failed to mark all as read:", error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (pagination.hasMore && !isLoading) {
      fetchNotifications(pagination.page + 1);
    }
  };

  // Get link for notification
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

  // Count unread
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isMarkingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Mark all read
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            <button
              onClick={() => setFilter("all")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === "all"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === "unread"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No notifications
            </h3>
            <p className="text-gray-500">
              {filter === "unread"
                ? "You have no unread notifications"
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border transition-all hover:shadow-md ${
                  !notification.isRead
                    ? "border-blue-200 bg-blue-50/30"
                    : "border-gray-200"
                }`}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    {getNotificationIcon(
                      notification.type,
                      notification.severity
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Link
                            href={getNotificationLink(notification)}
                            className="text-lg font-semibold text-gray-900 hover:text-primary transition-colors"
                            onClick={() =>
                              !notification.isRead &&
                              handleMarkAsRead(notification.id)
                            }
                          >
                            {notification.title}
                          </Link>
                          <p className="text-gray-600 mt-1">
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() =>
                                handleMarkAsRead(notification.id)
                              }
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-500">
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                        <span>•</span>
                        <span>{formatFullDate(notification.createdAt)}</span>
                        {notification.actor?.name && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {notification.actor.name}
                            </span>
                          </>
                        )}
                        <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {notification.type.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* View Details Link */}
                      <div className="mt-3">
                        <Link
                          href={getNotificationLink(notification)}
                          className="text-sm font-medium text-primary hover:text-primary/80"
                          onClick={() =>
                            !notification.isRead &&
                            handleMarkAsRead(notification.id)
                          }
                        >
                          View details →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More */}
            {pagination.hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
