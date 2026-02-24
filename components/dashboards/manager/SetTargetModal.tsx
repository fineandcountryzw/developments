'use client';

import React from 'react';
import { RefreshCw, X } from 'lucide-react';

type AgentOption = { id: string; name: string; email: string };
type DevelopmentOption = { id: string; name: string; location: string };

type Props = {
  targetError: string | null;
  agents: AgentOption[];
  developments: DevelopmentOption[];

  selectedTargetAgent: string;
  setSelectedTargetAgent: (value: string) => void;

  selectedTargetDevelopment: string;
  setSelectedTargetDevelopment: (value: string) => void;

  targetRevenue: string;
  setTargetRevenue: (value: string) => void;

  targetDeals: string;
  setTargetDeals: (value: string) => void;

  targetNotes: string;
  setTargetNotes: (value: string) => void;

  targetSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

export function ManagerSetTargetModal({
  targetError,
  agents,
  developments,
  selectedTargetAgent,
  setSelectedTargetAgent,
  selectedTargetDevelopment,
  setSelectedTargetDevelopment,
  targetRevenue,
  setTargetRevenue,
  targetDeals,
  setTargetDeals,
  targetNotes,
  setTargetNotes,
  targetSubmitting,
  onClose,
  onSubmit,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Set Sales Target</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {targetError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {targetError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
            <select
              value={selectedTargetAgent}
              onChange={(e) => setSelectedTargetAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Development (Optional)</label>
            <select
              value={selectedTargetDevelopment}
              onChange={(e) => setSelectedTargetDevelopment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All developments</option>
              {developments.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} ({dev.location})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Target (USD)</label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deals Target</label>
              <input
                type="number"
                placeholder="e.g., 5"
                value={targetDeals}
                onChange={(e) => setTargetDeals(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              placeholder="Add any notes about this target..."
              value={targetNotes}
              onChange={(e) => setTargetNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              disabled={targetSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center"
              disabled={targetSubmitting}
            >
              {targetSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Set Target'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

