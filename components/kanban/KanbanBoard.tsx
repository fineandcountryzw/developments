'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import StageColumn from './StageColumn';
import DealModal from './DealModal';

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  deals: Deal[];
}

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

interface KanbanBoardProps {
  boardId: string;
}

export default function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showDealModal, setShowDealModal] = useState(false);

  // Fetch board data
  useEffect(() => {
    const fetchBoard = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/kanban/${boardId}`);
        if (response.ok) {
          const { data } = await response.json();
          setStages(data.stages);
        }
      } catch (error) {
        console.error('Error fetching board:', error);
      } finally {
        setLoading(false);
      }
    };

    if (boardId) {
      fetchBoard();
    }
  }, [boardId]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDropOnStage = useCallback(async (stageId: string, dealId: string) => {
    try {
      const response = await fetch(`/api/admin/deals/${dealId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId })
      });

      if (response.ok) {
        // Update local state
        setStages(stages.map(stage => ({
          ...stage,
          deals: stage.deals.filter(d => d.id !== dealId)
        })));

        // Refresh board
        const boardResponse = await fetch(`/api/admin/kanban/${boardId}`);
        if (boardResponse.ok) {
          const { data } = await boardResponse.json();
          setStages(data.stages);
        }
      }
    } catch (error) {
      console.error('Error moving deal:', error);
    }
  }, [boardId, stages]);

  const handleDealClick = async (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDealModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-fcGold" />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-x-auto bg-white">
      <div className="flex gap-6 p-6 min-w-full">
        {stages.map(stage => (
          <StageColumn
            key={stage.id}
            stage={stage}
            onDragOver={handleDragOver}
            onDropDeal={(dealId) => handleDropOnStage(stage.id, dealId)}
            onDealClick={handleDealClick}
          />
        ))}
      </div>

      {showDealModal && selectedDeal && (
        <DealModal
          deal={selectedDeal}
          isOpen={showDealModal}
          onClose={() => {
            setShowDealModal(false);
            setSelectedDeal(null);
          }}
          onUpdate={() => {
            // Refresh board after deal update
            fetch(`/api/admin/kanban/${boardId}`).then(res => {
              if (res.ok) {
                res.json().then(({ data }) => setStages(data.stages));
              }
            });
          }}
        />
      )}
    </div>
  );
}
