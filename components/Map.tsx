
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target, Maximize2, Users, MapPin } from 'lucide-react';

export const StandMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any | null>(null);
  const [selectedStand, setSelectedStand] = useState<string | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [-17.8252, 31.0335],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
      }).addTo(mapRef.current);

      const stands = [
        { id: 'Stand 1024-H', coords: [[-17.82, 31.03], [-17.821, 31.03], [-17.821, 31.031], [-17.82, 31.031]] as L.LatLngExpression[] },
        { id: 'Stand 884-G', coords: [[-17.83, 31.04], [-17.831, 31.04], [-17.831, 31.041], [-17.83, 31.041]] as L.LatLngExpression[] }
      ];

      stands.forEach(stand => {
        const poly = L.polygon(stand.coords, {
          color: '#85754E',
          weight: 2,
          fillOpacity: 0.15,
          className: 'cursor-pointer hover:fill-opacity-40 transition-all'
        }).addTo(mapRef.current!);
        
        poly.on('click', () => setSelectedStand(stand.id));
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-280px)] gap-10">
      <div className="flex-1 relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
        <div ref={mapContainerRef} className="absolute inset-0" />
        <div className="absolute top-6 left-6 z-[1000] bg-white p-6 rounded-xl shadow-xl border border-zinc-100 flex items-center space-x-4">
          <div className="p-3 bg-fcCream rounded-lg">
             <MapPin className="text-fcGold" size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-fcCharcoal">Harare North Development</div>
            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Section 4 &bull; Phase 2 Land Parcels</div>
          </div>
        </div>
      </div>

      <div className="w-[400px] flex flex-col space-y-6">
        <div className="bg-white p-8 rounded-xl border border-zinc-100 shadow-sm flex-1">
          <div className="flex items-center space-x-2 mb-8">
            <Target className="text-fcGold" size={18} />
            <h3 className="text-lg font-semibold text-fcCharcoal">Stand Intelligence</h3>
          </div>

          {selectedStand ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block mb-1">Asset Reference</label>
                  <div className="text-xl font-bold text-fcCharcoal">{selectedStand}</div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block mb-1">Lot Size</label>
                  <div className="text-xl font-bold text-fcCharcoal">2,400 m²</div>
                </div>
              </div>
              
              <div className="p-5 bg-fcCream rounded-lg space-y-4">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-zinc-500 font-medium">Infrastructure</span>
                   <span className="text-fcCharcoal font-semibold">Ready</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-zinc-500 font-medium">Compliance</span>
                   <span className="text-fcCharcoal font-semibold">Certificate Issued</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-zinc-500 font-medium">Ownership</span>
                   <span className="text-green-600 font-bold">Clear Title</span>
                </div>
              </div>

              <div className="space-y-3">
                 <button className="w-full bg-fcCharcoal text-white py-4 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center space-x-2">
                   <Users size={16} />
                   <span>Assign Sales Lead</span>
                 </button>
                 <button className="w-full border border-zinc-200 text-fcCharcoal py-4 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center justify-center space-x-2">
                   <Maximize2 size={16} />
                   <span>View Survey Diagram</span>
                 </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
               <div className="p-6 bg-fcCream rounded-full">
                 <Maximize2 size={32} className="text-zinc-400" />
               </div>
               <p className="text-sm font-medium text-zinc-500 px-10">Select a specific land parcel on the map to view technical specifications and availability.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
