'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, MapPin, Maximize2, ShieldCheck, 
  Droplets, Zap, Route, Lock, Wifi, Hammer,
  CheckCircle2, ArrowRight, Loader2, Landmark, RefreshCw
} from 'lucide-react';
import { Development, StandStatus } from '../types';

interface PlotSelectorMapProps {
  development: Development;
  onReserve: (standId: string) => void | Promise<void>;
}

export const PlotSelectorMap: React.FC<PlotSelectorMapProps> = ({ development, onReserve }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoLayerRef = useRef<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any | null>(null);
  const [selectedStand, setSelectedStand] = useState<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState(false);
  const [mapDataUnavailable, setMapDataUnavailable] = useState(false);

  const handleReserveClick = async () => {
    try {
      const standId =
        selectedStand?.stand_db_id ||
        selectedStand?.standId ||
        selectedStand?.stand_id ||
        selectedStand?.id;

      if (!standId) {
        setReserveError('This stand is missing an ID, so it cannot be reserved yet.');
        return;
      }

      setReserveError(null);
      setReserveSuccess(false);
      setIsReserving(true);

      const result = onReserve(String(standId));
      if (result instanceof Promise) {
        await result;
      }

      setReserveSuccess(true);

      // Refresh map styling/status in the background (never block UX on this).
      try {
        await fetchAndRenderGeometry();
      } catch {
        // Intentionally suppress GeoJSON/render warnings.
      }
    } catch (error) {
      setReserveError('Reservation failed. Please try again.');
    } finally {
      setIsReserving(false);
    }
  };

  // Status Color Mapping: Green (Available), Orange (Reserved), Red (Sold/Taken)
  const STATUS_COLORS: Record<StandStatus, string> = {
    'AVAILABLE': '#22C55E',
    'RESERVED': '#F59E0B',
    'SOLD': '#EF4444',
    'WITHDRAWN': '#6B7280'  // Gray for withdrawn stands
  };

  // Enhanced style function for better visibility
  const getFeatureStyle = (feature: any, isHighlighted: boolean = false) => {
    const status = feature?.properties?.status as any;
    const isAvailable = status === 'AVAILABLE';
    const isReserved = status === 'RESERVED';
    
    let fillColor = STATUS_COLORS.AVAILABLE;
    let strokeColor = '#15803d'; // Darker green for stroke
    let fillOpacity = 0.4;

    if (isReserved) {
      fillColor = STATUS_COLORS.RESERVED;
      strokeColor = '#b45309';
      fillOpacity = 0.5;
    } else if (!isAvailable && !isReserved) {
      // Sold, Taken, or Withdrawn
      fillColor = STATUS_COLORS.SOLD;
      strokeColor = '#b91c1c';
      fillOpacity = 0.35;
    }

    return {
      fillColor,
      strokeColor,
      fillOpacity,
      color: strokeColor,
      weight: isHighlighted ? 4 : 2,
      opacity: 1
    };
  };

  const fetchAndRenderGeometry = useCallback(async () => {
    if (!mapRef.current || !isMapReady || !development.id) return;

    try {
      // Fetch enriched GeoJSON from API
      const response = await fetch(`/api/stands/geojson?developmentId=${development.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch geometry: ${response.statusText}`);
      }
      
      const enrichedGeometry = await response.json();
      setMapDataUnavailable(false);

      // Remove previous geo layer
      if (geoLayerRef.current) {
        mapRef.current!.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }

      geoLayerRef.current = L.geoJSON(enrichedGeometry, {
        style: (feature) => getFeatureStyle(feature, false),
        onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const status = props.status as StandStatus;
            const isAvailable = status === 'AVAILABLE';
            const standNumber = props.stand_number || props.standNumber || props.number || 'N/A';
            
            // Add tooltip with stand info - always visible for available
            const displayStatus = status === 'SOLD' ? 'TAKEN' : status;
            const statusColor = isAvailable ? '#22C55E' : status === 'RESERVED' ? '#F59E0B' : '#EF4444';
            const tooltipContent = `
              <div style="font-family: system-ui; padding: 4px 8px; min-width: 80px;">
                <div style="font-weight: 700; font-size: 11px; color: #1f2937;">${standNumber}</div>
                <div style="font-size: 9px; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${displayStatus}
                </div>
                ${props.size_sqm ? `<div style="font-size: 9px; color: #6b7280; margin-top: 2px;">${parseFloat(props.size_sqm).toLocaleString()} m²</div>` : ''}
                ${isAvailable && props.price ? `<div style="font-size: 10px; color: #22C55E; font-weight: 700; margin-top: 2px;">$${parseFloat(props.price).toLocaleString()}</div>` : ''}
              </div>
            `;
            
            layer.bindTooltip(tooltipContent, {
              permanent: false,
              direction: 'top',
              offset: [0, -5],
              className: 'stand-tooltip'
            });
            
            // Add center label for stand number on all geometry types
            // Leaflet supports: Polygon, MultiPolygon, LineString, MultiLineString, Point, etc.
            let center: L.LatLng | null = null;
            
            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
              // For Polygon, MultiPolygon, LineString, MultiLineString
              center = layer.getBounds().getCenter();
            } else if (layer instanceof L.Marker) {
              // For Point geometries
              center = layer.getLatLng();
            }
            
            if (center && markersRef.current) {
              const statusBgColor = isAvailable ? 'rgba(34, 197, 94, 0.95)' : 
                                    status === 'RESERVED' ? 'rgba(245, 158, 11, 0.95)' : 
                                    'rgba(239, 68, 68, 0.95)';
              
              const statusTextColor = isAvailable ? 'text-white' : 'text-white';
              
              // Create custom icon with status badge
              const badgeHtml = `
                <div style="
                  background: ${statusBgColor};
                  color: white;
                  padding: 3px 8px;
                  border-radius: 12px;
                  font-size: 10px;
                  font-weight: 700;
                  white-space: nowrap;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">
                  ${standNumber}
                </div>
              `;
              
              const icon = L.divIcon({
                html: badgeHtml,
                className: 'custom-stand-marker',
                iconSize: [60, 24],
                iconAnchor: [30, 12]
              });
              
              L.marker(center, { icon }).addTo(markersRef.current);
            }
            
            layer.on('click', () => {
                setSelectedStand({
                    id: props.stand_db_id || props.standId || props.stand_id || props.id,
                    standNumber,
                    status,
                    price: props.price,
                    size_sqm: props.size_sqm,
                    ...props
                });
            });
        }
      });

      // Add geo layer to map
      geoLayerRef.current.addTo(mapRef.current!);
      
      // Create markers layer if it doesn't exist
      if (!markersRef.current) {
        markersRef.current = L.layerGroup().addTo(mapRef.current!);
      }

      // Remove existing markers
      markersRef.current.clearLayers();

      // Re-add markers for all features
      geoLayerRef.current.eachLayer((layer: any) => {
        const feature = layer.feature;
        if (!feature) return;
        
        const props = feature.properties || {};
        const status = props.status as StandStatus;
        const isAvailable = status === 'AVAILABLE';
        const standNumber = props.stand_number || props.standNumber || props.number || 'N/A';
        
        let center: L.LatLng | null = null;
        
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
          center = layer.getBounds().getCenter();
        } else if (layer instanceof L.Marker) {
          center = layer.getLatLng();
        }
        
        if (center) {
          const statusBgColor = isAvailable ? 'rgba(34, 197, 94, 0.95)' : 
                                status === 'RESERVED' ? 'rgba(245, 158, 11, 0.95)' : 
                                'rgba(239, 68, 68, 0.95)';
          
          const badgeHtml = `
            <div style="
              background: ${statusBgColor};
              color: white;
              padding: 3px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
              ${standNumber}
            </div>
          `;
          
          const icon = L.divIcon({
            html: badgeHtml,
            className: 'custom-stand-marker',
            iconSize: [60, 24],
            iconAnchor: [30, 12]
          });
          
          L.marker(center, { icon }).addTo(markersRef.current!).on('click', () => {
            setSelectedStand({
              id: props.stand_db_id || props.standId || props.stand_id || props.id,
              standNumber,
              status,
              price: props.price,
              size_sqm: props.size_sqm,
              ...props
            });
          });
        }
      });

      // Fit bounds to show all features
      if (geoLayerRef.current && mapRef.current) {
        const bounds = geoLayerRef.current.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 18
          });
        }
      }
    } catch (error) {
      // Fallback to static geometry if API fails
      try {
        if (!development?.geometry) {
          setMapDataUnavailable(true);
          return;
        }
        
        // Remove previous geo layer
        if (geoLayerRef.current) {
          mapRef.current?.removeLayer(geoLayerRef.current);
          geoLayerRef.current = null;
        }

        // Parse geometry if string
        const geometry = typeof development.geometry === 'string'
          ? JSON.parse(development.geometry)
          : development.geometry;

        // Render whatever GeoJSON object is provided without filtering/validation/coercion.
        geoLayerRef.current = L.geoJSON(geometry, {
          style: (feature) => getFeatureStyle(feature, false),
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const isAvailable = props.status === 'AVAILABLE';
            const standNumber = props.stand_number || props.standNumber || props.number || 'N/A';

            const statusBgColor = isAvailable ? 'rgba(34, 197, 94, 0.95)' :
              props.status === 'RESERVED' ? 'rgba(245, 158, 11, 0.95)' :
              'rgba(239, 68, 68, 0.95)';

            let center: L.LatLng | null = null;

            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
              center = layer.getBounds().getCenter();
            } else if (layer instanceof L.Marker) {
              center = layer.getLatLng();
            }

            if (center) {
              const badgeHtml = `
                <div style="
                  background: ${statusBgColor};
                  color: white;
                  padding: 3px 8px;
                  border-radius: 12px;
                  font-size: 10px;
                  font-weight: 700;
                  white-space: nowrap;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                ">
                  ${standNumber}
                </div>
              `;

              const icon = L.divIcon({
                html: badgeHtml,
                className: 'custom-stand-marker',
                iconSize: [60, 24],
                iconAnchor: [30, 12]
              });

              L.marker(center, { icon }).addTo(markersRef.current || L.layerGroup().addTo(mapRef.current!));
            }

            layer.on('click', () => {
              setSelectedStand({
                id: props.stand_db_id || props.standId || props.stand_id || props.id,
                standNumber,
                status: props.status,
                price: props.price,
                size_sqm: props.size_sqm,
                ...props
              });
            });
          }
        });

        geoLayerRef.current.addTo(mapRef.current!);

        // Fit bounds
        if (geoLayerRef.current && mapRef.current) {
          const bounds = geoLayerRef.current.getBounds();
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, {
              padding: [50, 50],
              maxZoom: 18
            });
          }
        }

        setMapDataUnavailable(false);
      } catch (fallbackError) {
        setMapDataUnavailable(true);
      }
    }
  }, [development.id, development.geometry, isMapReady, selectedStand?.id]);

  // Initial load and setup
  useEffect(() => {
    if (!mapContainerRef.current || !development) return;

    const initMap = async () => {
      try {
        // Clear previous map if exists
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        
        // Destroy geo layer ref
        geoLayerRef.current = null;
        markersRef.current = null;

        // Initialize map with better defaults
        const centerLat = development.latitude || -26.2041; // Default to Joburg
        const centerLng = development.longitude || 28.0473;
        
        const mapContainer = mapContainerRef.current;
        if (!mapContainer) {
          throw new Error('Map container not available');
        }
        
        const map = L.map(mapContainer, {
          center: [centerLat, centerLng],
          zoom: 16,
          zoomControl: false, // We'll add custom zoom control
          attributionControl: true,
          preferCanvas: false // Use SVG for better tooltips
        });
        
        // Add OpenStreetMap tiles with custom styling
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
          minZoom: 1
        }).addTo(map);
        
        mapRef.current = map;
        
        // Wait for map to be ready using whenReady
        await new Promise(resolve => {
          map.whenReady(() => {
            resolve(null);
          });
        });
        
        setIsMapReady(true);
      } catch (error) {
        setMapDataUnavailable(true);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      geoLayerRef.current = null;
      markersRef.current = null;
    };
  }, [development?.id]);

  useEffect(() => {
    if (!fetchAndRenderGeometry || !development.id) return;
    fetchAndRenderGeometry();
    const interval = setInterval(fetchAndRenderGeometry, 30000);
    return () => clearInterval(interval);
  }, [fetchAndRenderGeometry, development.id]);

  // Highlight the selected stand without filtering/hiding any features.
  useEffect(() => {
    if (!geoLayerRef.current || !isMapReady) return;

    geoLayerRef.current.eachLayer((layer: any) => {
      const feature = layer.feature;
      if (!feature) return;

      const props = feature.properties || {};
      const featureId = props.stand_db_id || props.standId || props.stand_id || props.id;
      const isHighlighted =
        selectedStand?.id !== null &&
        selectedStand?.id !== undefined &&
        featureId !== null &&
        featureId !== undefined &&
        String(featureId) === String(selectedStand.id);

      if (layer.setStyle) {
        layer.setStyle(getFeatureStyle(feature, isHighlighted));
      }
    });
  }, [isMapReady, selectedStand?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      geoLayerRef.current = null;
      markersRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-fcCream rounded-xl overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {selectedStand && isMapReady && (
        <div className="absolute top-4 left-4 z-[1000] w-72 max-w-[calc(100vw-2rem)]">
          <div className="bg-white/95 backdrop-blur-md rounded-xl border border-fcDivider shadow-xl p-4 animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-8rem)] overflow-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{selectedStand.standNumber}</h3>
                <p className="text-xs text-gray-500">Stand Details</p>
              </div>
              <button 
                onClick={() => setSelectedStand(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${
                  selectedStand.status === 'AVAILABLE' ? 'text-green-600' :
                  selectedStand.status === 'RESERVED' ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {selectedStand.status === 'SOLD' ? 'TAKEN' : selectedStand.status}
                </span>
              </div>
              
              {selectedStand.size_sqm && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span className="font-medium text-gray-900">{parseFloat(selectedStand.size_sqm).toLocaleString()} m²</span>
                </div>
              )}
              
              {selectedStand.price && selectedStand.status === 'AVAILABLE' && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Price</span>
                  <span className="font-bold text-green-600">${parseFloat(selectedStand.price).toLocaleString()}</span>
                </div>
              )}
            </div>

            {reserveError && (
              <p className="mt-3 text-xs text-red-600">
                {reserveError}
              </p>
            )}
            {reserveSuccess && !reserveError && (
              <p className="mt-3 text-xs text-green-700">
                Reservation started.
              </p>
            )}
            
            {selectedStand.status === 'AVAILABLE' && (
              <button
                onClick={handleReserveClick}
                disabled={isReserving}
                className="w-full mt-4 py-2.5 bg-gradient-to-r from-fcGold to-[#9A8B5F] text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isReserving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {isReserving ? 'Reserving...' : 'Reserve Now'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 z-[1000] flex flex-col space-y-2">
          <button 
            onClick={() => { if (mapRef.current && geoLayerRef.current) mapRef.current.fitBounds(geoLayerRef.current.getBounds(), { padding: [50, 50] }); }} 
            className="p-3 bg-white/90 backdrop-blur-md rounded-xl border border-fcDivider shadow-xl text-gray-600 hover:text-fcGold transition-all"
            title="Fit bounds to all stands"
          >
             <Maximize2 size={18} />
          </button>
          <button 
            onClick={fetchAndRenderGeometry} 
            disabled={!isMapReady}
            className="p-3 bg-white/90 backdrop-blur-md rounded-xl border border-fcDivider shadow-xl text-gray-600 hover:text-fcGold transition-all disabled:opacity-50"
            title="Reload stands from server"
          >
             <RefreshCw size={18} className={isMapReady ? '' : 'animate-spin'} />
          </button>
       </div>

      {!isMapReady && (
        <div className="absolute inset-0 z-[5000] bg-fcCream flex flex-col items-center justify-center space-y-4">
           <Loader2 className="animate-spin text-fcGold" size={32} />
           <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-fcGold animate-pulse font-montserrat">Initializing Spatial Engine...</p>
        </div>
      )}

      {mapDataUnavailable && isMapReady && (
        <div className="absolute inset-x-4 bottom-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl border border-fcDivider shadow-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-700">
              Map data is unavailable right now.
            </p>
            <button
              type="button"
              onClick={fetchAndRenderGeometry}
              className="px-3 py-2 rounded-lg bg-fcGold text-white text-xs font-semibold hover:opacity-90 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotSelectorMap;
