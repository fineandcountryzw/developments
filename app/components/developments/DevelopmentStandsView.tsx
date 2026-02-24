'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { StandTableView } from '../stands/StandTableView';
import { Map, Table, Loader2 } from 'lucide-react';

// Dynamic import for map to avoid SSR issues
const PlotSelectorMap = dynamic(
  () => import('../../../components/PlotSelectorMap').then((mod) => mod.PlotSelectorMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    ),
  }
);

interface DevelopmentStandsViewProps {
  developmentId: string;
  hasGeoJsonMap?: boolean;
  disableMapView?: boolean;
  onReserve?: (standId: string) => void;
}

export function DevelopmentStandsView({
  developmentId,
  hasGeoJsonMap: initialHasGeoJsonMap,
  disableMapView: initialDisableMapView,
  onReserve,
}: DevelopmentStandsViewProps) {
  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [stands, setStands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disableMapView, setDisableMapView] = useState(false);

  useEffect(() => {
    const fetchStands = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/developments/${developmentId}/stands/table`);
        if (!response.ok) throw new Error('Failed to fetch stands');
        const data = await response.json();
        setStands(data.stands || []);

        // Use API values, fall back to props
        const apiDisableMapView = data.disableMapView ?? initialDisableMapView ?? false;
        setDisableMapView(apiDisableMapView);

        // Set initial view mode based on both hasGeoJsonMap and disableMapView
        const apiHasGeoJsonMap = data.hasGeoJsonMap ?? initialHasGeoJsonMap ?? false;
        if (!apiHasGeoJsonMap || apiDisableMapView) {
          setViewMode('table');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stands');
      } finally {
        setLoading(false);
      }
    };

    fetchStands();
  }, [developmentId, initialHasGeoJsonMap, initialDisableMapView]);

  // Calculate if map is available
  const isMapAvailable = (initialHasGeoJsonMap ?? false) && !disableMapView;

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('map')}
            disabled={!isMapAvailable}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            } ${!isMapAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Map className="w-4 h-4" />
            Map View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table className="w-4 h-4" />
            Table View
          </button>
        </div>
      </div>

      {/* View Content */}
      {loading ? (
        <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : viewMode === 'map' && isMapAvailable ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <PlotSelectorMap
            development={{
              id: developmentId,
              geoJsonData: null,
            } as any}
            onReserve={onReserve || (() => {})}
          />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <StandTableView
            stands={stands}
            onStandClick={(stand) => {
              console.log('Stand clicked:', stand);
            }}
          />
        </div>
      )}
    </div>
  );
}
