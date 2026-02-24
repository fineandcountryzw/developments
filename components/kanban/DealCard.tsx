'use client';

import React from 'react';
import { GripVertical, AlertCircle, Zap } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  healthScore?: number;
  riskLevel?: string;
  owner: { id: string; name: string };
  collaborators: Array<{ id: string; name: string }>;
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

export default function DealCard({ deal, onClick }: DealCardProps) {
  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'high':
        return 'bg-red-100 border-red-300';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300';
      default:
        return 'bg-green-100 border-green-300';
    }
  };

  const getHealthColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer?.setData('dealId', deal.id)}
      onClick={onClick}
      className={`p-4 rounded-lg border-2 cursor-move hover:shadow-lg transition ${getRiskColor(deal.riskLevel)}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <h4 className="font-semibold text-sm flex-1 text-gray-800 line-clamp-2">
          {deal.title}
        </h4>
      </div>

      {/* Value and Probability */}
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-lg text-gray-900">
          ${(deal.value / 1000).toFixed(1)}K
        </span>
        <span className="text-xs font-semibold text-gray-600 bg-white/80 px-2 py-1 rounded">
          {deal.probability}%
        </span>
      </div>

      {/* Health Score and Risk */}
      <div className="flex items-center justify-between text-xs mb-2">
        {deal.healthScore !== undefined && (
          <span className={`font-semibold ${getHealthColor(deal.healthScore)}`}>
            Health: {deal.healthScore}
          </span>
        )}
        {deal.riskLevel && (
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {deal.riskLevel}
          </span>
        )}
      </div>

      {/* Owner */}
      <div className="text-xs text-gray-600 mb-2">
        <p className="font-medium">{deal.owner.name}</p>
      </div>

      {/* Collaborators */}
      {deal.collaborators.length > 0 && (
        <div className="flex -space-x-2">
          {deal.collaborators.slice(0, 3).map(collab => (
            <div
              key={collab.id}
              className="w-6 h-6 rounded-full bg-fcGold text-white text-xs flex items-center justify-center font-bold border border-white"
              title={collab.name}
            >
              {collab.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {deal.collaborators.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-700 text-xs flex items-center justify-center font-bold border border-white">
              +{deal.collaborators.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
