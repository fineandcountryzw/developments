'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, User } from 'lucide-react';

interface DealModalProps {
  deal: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DealModal({ deal, isOpen, onClose, onUpdate }: DealModalProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (isOpen && deal) {
      fetchComments();
      fetchMetrics();
    }
  }, [isOpen, deal]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/admin/deals/${deal.id}/comments`);
      if (response.ok) {
        const { data } = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/admin/deals/${deal.id}/intelligence`);
      if (response.ok) {
        const { data } = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/deals/${deal.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });

      if (response.ok) {
        setNewComment('');
        await fetchComments();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{deal.title}</h2>
            <div className="flex gap-4 text-sm">
              <span className="font-semibold text-gray-700">
                Value: ${(deal.value / 1000).toFixed(1)}K
              </span>
              <span className="font-semibold text-gray-700">
                Probability: {deal.probability}%
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Metrics Section */}
          {metrics && (
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Win Probability</p>
                <p className="text-2xl font-bold text-fcGold">
                  {metrics.metrics.winProbability}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Health Score</p>
                <p className={`text-2xl font-bold ${
                  metrics.metrics.healthScore >= 70 ? 'text-green-600' :
                  metrics.metrics.healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {metrics.metrics.healthScore}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expected Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(metrics.metrics.expectedValue / 1000).toFixed(1)}K
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Risk Level</p>
                <p className={`text-lg font-bold capitalize ${
                  metrics.metrics.riskLevel === 'high' ? 'text-red-600' :
                  metrics.metrics.riskLevel === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {metrics.metrics.riskLevel}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {deal.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 text-sm">{deal.description}</p>
            </div>
          )}

          {/* Owner and Collaborators */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Team</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">
                  <strong>Owner:</strong> {deal.owner.name}
                </span>
              </div>
              {deal.collaborators.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Collaborators:</p>
                  <div className="flex flex-wrap gap-2">
                    {deal.collaborators.map((collab: any) => (
                      <span
                        key={collab.id}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm"
                      >
                        {collab.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comments ({comments.length})
            </h3>

            <div className="space-y-3 mb-4">
              {comments.map(comment => (
                <div key={comment.id} className="bg-gray-50 p-3 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-900">
                      {comment.user.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-fcGold"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                disabled={loading || !newComment.trim()}
                className="w-full bg-fcGold text-white py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition"
              >
                {loading ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
