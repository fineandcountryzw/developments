'use client';

import { useState, useEffect } from 'react';
import { StandTableView } from './stands/StandTableView';
import { Table, Loader2 } from 'lucide-react';

interface DevelopmentStandsViewProps {
  developmentId: string;
  hasGeoJsonMap: boolean;
}

export function DevelopmentStandsView({
  developmentId,
  hasGeoJsonMap,
}: DevelopmentStandsViewProps) {
  const [viewMode, setViewMode] = useState<'table'>('table');
  const [stands, setStands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For developments without GeoJSON maps, always show table view
    if (!hasGeoJsonMap) {
      setViewMode('table');
    }
  }, [hasGeoJsonMap]);

  useEffect(() => {
    const fetchStands = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/developments/${developmentId}/stands/table`);
        if (!response.ok) throw new Error('Failed to fetch stands');
        const data = await response.json();
        setStands(data.stands || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stands');
      } finally {
        setLoading(false);
      }
    };

    fetchStands();
  }, [developmentId]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <StandTableView
        stands={stands}
        onStandClick={(stand) => {
          console.log('Stand clicked:', stand);
        }}
      />
    </div>
  );
}
