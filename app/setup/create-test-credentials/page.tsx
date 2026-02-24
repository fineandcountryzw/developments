'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function CreateTestCredentialsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCredentials = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/setup/create-test-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create test credentials');
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            Test Credentials Setup
          </h1>
          <p className="text-slate-300 text-lg">
            Create test users for all dashboard types
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                🔐 One-Click Setup
              </h2>
              <p className="text-slate-400">
                Creates 9 test users with all necessary dashboards
              </p>
            </div>
            <button
              onClick={handleCreateCredentials}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg flex items-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Credentials
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-700/30 border border-slate-700 rounded p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Test Users Being Created:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                '👤 Admin (Full Access)',
                '🤝 Agent (3x Harare/Bulawayo)',
                '💼 Client (3x Multi-branch)',
                '🏢 Manager (Branch Ops)',
                '📞 Account (Support)',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-300">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-slate-800 rounded-lg border border-green-600/30 p-8 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  ✨ Success!
                </h3>
                <p className="text-slate-300">
                  {result.count} test credentials created successfully
                </p>
              </div>
            </div>

            {/* Credentials Table */}
            {result.credentials && result.credentials.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">
                        Dashboard
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">
                        Password
                      </th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">
                        Branch
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.credentials.map(
                      (
                        cred: {
                          role: string;
                          email: string;
                          password: string;
                          branch: string;
                        },
                        idx: number
                      ) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-700 hover:bg-slate-700/20"
                        >
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-semibold">
                              {cred.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white font-mono text-sm">
                            {cred.email}
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-sm">
                            {cred.password}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {cred.branch}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 p-4 bg-blue-600/10 border border-blue-600/30 rounded text-blue-300 text-sm">
              📋 All credentials are listed above. Copy them to your password manager
              or notes for easy reference during testing.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-slate-800 rounded-lg border border-red-600/30 p-8 mb-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Error</h3>
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-3">🎯 For Admins</h3>
            <p className="text-slate-300 text-sm mb-4">
              Full system access including user management, settings, and audits.
            </p>
            <p className="text-slate-400 text-xs">
              <strong>Email:</strong> admin@fineandcountryerp.com
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-3">👤 For Agents</h3>
            <p className="text-slate-300 text-sm mb-4">
              Sales workflow - clients, properties, deals, and commissions.
            </p>
            <p className="text-slate-400 text-xs">
              <strong>Emails:</strong> agent@... (3 users)
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-3">💼 For Clients</h3>
            <p className="text-slate-300 text-sm mb-4">
              Property portal - reservations, payments, and portfolio.
            </p>
            <p className="text-slate-400 text-xs">
              <strong>Emails:</strong> client@... (3 users)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-amber-900/20 border border-amber-700/30 rounded-lg">
          <h4 className="text-amber-300 font-semibold mb-2">
            ⚠️ Important Security Notice
          </h4>
          <ul className="text-amber-300/80 text-sm space-y-1">
            <li>✓ Test credentials are for development only</li>
            <li>✓ Delete all test users before production deployment</li>
            <li>✓ Change passwords if sharing with team members</li>
            <li>✓ This feature is disabled in production environments</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
