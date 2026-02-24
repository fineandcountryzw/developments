'use client';

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Grid3x3,
  Loader2,
  Home,
  DollarSign,
  Ruler,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';

interface Stand {
  id: string;
  standNumber: string;
  size: number;
  price: number;
  status: string;
  x?: number; // X coordinate on map (0-100)
  y?: number; // Y coordinate on map (0-100)
  width?: number; // Width on map (relative)
  height?: number; // Height on map (relative)
  development?: {
    name: string;
  };
}

interface InteractiveDevelopmentMapProps {
  developmentId: string;
  stands: Stand[];
  selectedStandId: string | null;
  onStandSelect: (stand: Stand) => void;
  onViewToggle?: () => void;
  compactFilter?: boolean; // Enable compact filter mode
}

type StatusFilter = 'all' | 'available' | 'reserved' | 'sold';

export function InteractiveDevelopmentMap({
  developmentId,
  stands,
  selectedStandId,
  onStandSelect,
  onViewToggle,
  compactFilter = false
}: InteractiveDevelopmentMapProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredStandId, setHoveredStandId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Auto-generate grid positions if not provided
  const standsWithPositions = stands.map((stand, index) => {
    if (stand.x !== undefined && stand.y !== undefined) {
      return stand;
    }

    // Auto-generate grid layout (5 columns)
    const cols = 5;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const standWidth = 18; // % width per stand
    const standHeight = 15; // % height per stand
    const gapX = 2;
    const gapY = 3;

    return {
      ...stand,
      x: col * (standWidth + gapX) + 5,
      y: row * (standHeight + gapY) + 5,
      width: standWidth,
      height: standHeight
    };
  });

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getStandColor = (stand: Stand, isHovered: boolean, isSelected: boolean) => {
    if (isSelected) return '#D4AF37'; // fcGold - selected highlight
    if (isHovered && stand.status === 'Available') return '#16A34A'; // darker green on hover
    
    switch (stand.status) {
      case 'Available':
        return '#22C55E'; // Green - Available
      case 'Reserved':
        return '#F59E0B'; // Orange - Reserved
      case 'Sold':
        return '#EF4444'; // Red - Taken/Sold
      default:
        return '#94A3B8'; // slate-400
    }
  };

  const selectedStand = standsWithPositions.find(s => s.id === selectedStandId);
  const hoveredStand = standsWithPositions.find(s => s.id === hoveredStandId);

  // Filter stands based on status
  const filteredStands = standsWithPositions.filter(stand => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'available') return stand.status === 'Available';
    if (statusFilter === 'reserved') return stand.status === 'Reserved';
    if (statusFilter === 'sold') return stand.status === 'Sold';
    return true;
  });

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <MapPin size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Interactive Site Map</h3>
            <p className="text-sm text-slate-600">Click a unit to select</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-medium text-slate-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors ml-2"
            title="Fullscreen"
          >
            <Maximize2 size={18} />
          </button>

          {/* Grid View Toggle */}
          {onViewToggle && (
            <button
              onClick={onViewToggle}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Switch to Grid View"
            >
              <Grid3x3 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Compact Filter (Mobile-First) */}
      {compactFilter && (
        <div className="mb-4">
          <button
            onClick={() => setShowFilterSheet(true)}
            className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-fcGold" />
              <span className="font-medium text-fcSlate">
                {statusFilter === 'all' ? 'All Stands' : 
                 statusFilter === 'available' ? 'Available' : 
                 statusFilter === 'reserved' ? 'Reserved' : 'Sold'}
              </span>
              <span className="text-sm text-gray-500">
                ({filteredStands.length} stands)
              </span>
            </div>
            <ChevronDown size={18} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* Filter Sheet */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowFilterSheet(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-fcSlate">Filter Stands</h3>
              <button onClick={() => setShowFilterSheet(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2">
              {(['all', 'available', 'reserved', 'sold'] as StatusFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => {
                    setStatusFilter(filter);
                    setShowFilterSheet(false);
                  }}
                  className={`w-full p-4 rounded-xl text-left font-medium transition-colors ${
                    statusFilter === filter 
                      ? 'bg-fcGold text-white' 
                      : 'bg-gray-50 text-fcSlate hover:bg-gray-100'
                  }`}
                >
                  {filter === 'all' ? 'All Stands' : 
                   filter === 'available' ? 'Available' : 
                   filter === 'reserved' ? 'Reserved' : 'Sold'}
                  <span className="float-right opacity-70">
                    {filter === 'all' ? standsWithPositions.length : 
                     filter === 'available' ? standsWithPositions.filter(s => s.status === 'Available').length :
                     filter === 'reserved' ? standsWithPositions.filter(s => s.status === 'Reserved').length :
                     standsWithPositions.filter(s => s.status === 'Sold').length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-gray-200 overflow-hidden shadow-xl" style={{ height: compactFilter ? '60vh' : '600px' }}>
        <div 
          className="overflow-auto"
          style={{ 
            height: '100%',
            cursor: 'grab'
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              transition: 'transform 0.2s ease-out'
            }}
          >
            {/* Background Grid */}
            <defs>
              <pattern
                id="grid"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* Render Stands */}
            {filteredStands.map((stand) => {
              const isHovered = hoveredStandId === stand.id;
              const isSelected = selectedStandId === stand.id;
              const isAvailable = stand.status === 'Available';
              const color = getStandColor(stand, isHovered, isSelected);

              return (
                <g key={stand.id}>
                  {/* Stand Rectangle */}
                  <rect
                    x={stand.x}
                    y={stand.y}
                    width={stand.width || 18}
                    height={stand.height || 15}
                    fill={color}
                    fillOpacity={isSelected ? 0.9 : isHovered ? 0.8 : 0.7}
                    stroke={isSelected ? '#D4AF37' : isHovered ? '#0EA5E9' : '#64748B'}
                    strokeWidth={isSelected ? 0.8 : isHovered ? 0.5 : 0.3}
                    rx="1"
                    className={`transition-all duration-200 ${
                      isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'
                    }`}
                    onClick={() => isAvailable && onStandSelect(stand)}
                    onMouseEnter={() => setHoveredStandId(stand.id)}
                    onMouseLeave={() => setHoveredStandId(null)}
                    style={{
                      filter: isSelected 
                        ? 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.6))' 
                        : isHovered 
                          ? 'drop-shadow(0 0 4px rgba(14, 165, 233, 0.4))'
                          : 'none'
                    }}
                  />

                  {/* Stand Number Label */}
                  <text
                    x={(stand.x || 0) + (stand.width || 18) / 2}
                    y={(stand.y || 0) + (stand.height || 15) / 2}
                    fontSize="3"
                    fontWeight="bold"
                    fill="white"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    pointerEvents="none"
                    style={{
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      userSelect: 'none'
                    }}
                  >
                    {stand.standNumber}
                  </text>

                  {/* Home Icon for Selected */}
                  {isSelected && (
                    <g transform={`translate(${(stand.x || 0) + 1}, ${(stand.y || 0) + 1})`}>
                      <circle cx="2" cy="2" r="1.5" fill="white" opacity="0.9" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Stand Info Panel */}
        {selectedStand && (
          <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-fcGold/10 rounded-lg">
                    <Home size={20} className="text-fcGold" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">
                      Stand {selectedStand.standNumber}
                    </h4>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      selectedStand.status === 'Available' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedStand.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Ruler size={16} className="text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-600">Size</div>
                      <div className="text-lg font-bold text-slate-900">
                        {selectedStand.size} m²
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-600">Price</div>
                      <div className="text-lg font-bold text-fcGold">
                        ${selectedStand.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onStandSelect(selectedStand)}
                className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* Hovered Stand Tooltip */}
        {hoveredStand && hoveredStand.id !== selectedStandId && (
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-sm text-white rounded-lg px-4 py-2 shadow-xl animate-in fade-in duration-150">
            <div className="text-sm font-bold mb-1">Stand {hoveredStand.standNumber}</div>
            <div className="text-xs opacity-90">
              {hoveredStand.size} m² • ${hoveredStand.price.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!selectedStandId && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-900 flex items-center gap-2">
            <MapPin size={16} className="shrink-0" />
            Click on any available (green) stand to select it for reservation
          </p>
        </div>
      )}
    </div>
  );
}
