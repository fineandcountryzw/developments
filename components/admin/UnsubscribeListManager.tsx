import React, { useState, useEffect } from 'react';
import { Search, Trash2, RotateCcw, Plus } from 'lucide-react';

interface UnsubscribeRecord {
  id: string;
  recipientEmail: string;
  clientId: string;
  reason: string;
  description?: string;
  unsubscribedAt: string;
  unsubscribedBy: string;
  resubscribeAttemptAt?: string;
}

interface UnsubscribeListManagerProps {
  branch?: string;
}

export const UnsubscribeListManager: React.FC<UnsubscribeListManagerProps> = ({ branch = 'Harare' }) => {
  const [unsubscribed, setUnsubscribed] = useState<UnsubscribeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const limit = 50;

  useEffect(() => {
    fetchUnsubscribed();
  }, [branch, search, reason, page]);

  const fetchUnsubscribed = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        branch,
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(reason && { reason })
      });

      const response = await fetch(`/api/admin/unsubscribes/list?${params}`);
      if (!response.ok) throw new Error('Failed to fetch unsubscribe list');
      const data = await response.json();
      setUnsubscribed(data.unsubscribed);
      setTotal(data.pagination.total);
      setPages(data.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResubscribe = async (email: string, clientId: string) => {
    try {
      const response = await fetch(`/api/admin/unsubscribes/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: email, clientId })
      });

      if (!response.ok) throw new Error('Failed to resubscribe');
      setSelectedEmail(null);
      fetchUnsubscribed();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading && page === 1) {
    return <div className="p-6 text-center">Loading unsubscribe list...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Unsubscribe Management</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search email or client..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Reasons</option>
            <option value="requested">User Request</option>
            <option value="hard_bounce">Hard Bounce</option>
            <option value="spam">Marked as Spam</option>
            <option value="other">Other</option>
          </select>

          <div className="text-sm text-gray-600 py-2">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} records
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Client ID</th>
                <th className="px-4 py-2 text-center">Reason</th>
                <th className="px-4 py-2 text-left">Unsubscribed</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {unsubscribed.map((record) => (
                <tr key={record.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{record.recipientEmail}</td>
                  <td className="px-4 py-3 text-sm">{record.clientId}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs capitalize">
                      {record.reason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(record.unsubscribedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (window.confirm(`Resubscribe ${record.recipientEmail}?`)) {
                          handleResubscribe(record.recipientEmail, record.clientId);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Resubscribe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(5, pages) }).map((_, idx) => {
              const pageNum = page > 2 ? page - 2 + idx : idx + 1;
              if (pageNum > pages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 rounded ${
                    page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
