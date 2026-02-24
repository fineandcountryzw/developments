'use client';

import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import DealCard from './DealCard';

interface StageColumnProps {
  stage: {
    id: string;
    name: string;
    color: string;
    deals: any[];
  };
  onDragOver: (e: React.DragEvent) => void;
  onDropDeal: (dealId: string) => void;
  onDealClick: (deal: any) => void;
}

export default function StageColumn({
  stage,
  onDragOver,
  onDropDeal,
  onDealClick
}: StageColumnProps) {
  const [isAddingDeal, setIsAddingDeal] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId) {
      onDropDeal(dealId);
    }
  };

  return (
    <div className="flex-shrink-0 w-80">
      {/* Header */}
      <div
        className="p-4 rounded-t-lg text-white font-semibold flex items-center justify-between"
        style={{ backgroundColor: stage.color }}
      >
        <div>
          <h3>{stage.name}</h3>
          <p className="text-sm font-normal opacity-90">{stage.deals.length} deals</p>
        </div>
        <button
          onClick={() => setIsAddingDeal(!isAddingDeal)}
          className="hover:bg-white/20 p-2 rounded transition"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Deals Container */}
      <div
        className="bg-gray-50 rounded-b-lg p-4 space-y-3 min-h-96 max-h-[calc(100vh-300px)] overflow-y-auto border-2 border-dashed border-gray-300"
        onDragOver={onDragOver}
        onDrop={handleDrop}
      >
        {stage.deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={() => onDealClick(deal)}
          />
        ))}

        {stage.deals.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <p className="text-sm">Drop deals here</p>
          </div>
        )}
      </div>
    </div>
  );
}
