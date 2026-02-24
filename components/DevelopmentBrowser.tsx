'use client';

import React, { useState, useEffect } from 'react';
import { DevelopmentDetailView } from './DevelopmentDetailView';
import { Building2, MapPin, Home, Loader2, Search } from 'lucide-react';
import Image from 'next/image';

interface DevelopmentBrowserProps {
  userRole: string;
}

interface Development {
  id: string;
  name: string;
  location: string;
  type: string;
  phase: string;
  image_urls?: string[];
  total_stands?: number;
  available_stands?: number;
  price_per_sqm?: number;
}

export function DevelopmentBrowser({ userRole }: DevelopmentBrowserProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDevelopments();
  }, []);

  const loadDevelopments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/developments');
      if (response.ok) {
        const data = await response.json();
        // Ensure we always set an array
        const developmentsData = data.data || data || [];
        setDevelopments(Array.isArray(developmentsData) ? developmentsData : []);
      } else {
        setDevelopments([]);
      }
    } catch (error) {
      console.error('[DevelopmentBrowser] Error loading:', error);
      setDevelopments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Ensure developments is always an array before filtering
  const filteredDevelopments = Array.isArray(developments) 
    ? developments.filter(dev =>
        dev?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dev?.location?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Show detail view if a development is selected
  if (selectedDevelopment) {
    return (
      <DevelopmentDetailView
        developmentId={selectedDevelopment}
        userRole={userRole}
        onBack={() => setSelectedDevelopment(null)}
        onReserve={(devId, standId) => {
          console.log('[DevelopmentBrowser] Reserved:', { devId, standId });
          // Redirect handled by DevelopmentDetailView
        }}
      />
    );
  }

  // Show developments grid
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-900 mb-2">
            Browse Developments
          </h1>
          <p className="text-lg text-slate-600">
            Explore available properties and reserve your ideal stand
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-fcGold focus:ring-4 focus:ring-fcGold/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-fcGold mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Loading developments...</p>
          </div>
        )}

        {/* Developments Grid */}
        {!isLoading && filteredDevelopments.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No developments found</h3>
            <p className="text-slate-600">Try adjusting your search criteria</p>
          </div>
        )}

        {!isLoading && filteredDevelopments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDevelopments.map((dev) => (
              <button
                key={dev.id}
                onClick={() => setSelectedDevelopment(dev.id)}
                className="bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden text-left group"
              >
                {/* Image */}
                <div className="relative h-48 bg-gradient-to-br from-slate-800 to-slate-900">
                  {dev.image_urls && dev.image_urls.length > 0 && dev.image_urls[0] && (dev.image_urls[0].startsWith('http://') || dev.image_urls[0].startsWith('https://')) ? (
                    <Image
                      src={dev.image_urls[0]}
                      alt={dev.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                      unoptimized={!dev.image_urls[0]?.includes('ufs.sh') && !dev.image_urls[0]?.includes('supabase.co')}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg></div>';
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-white/20" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${
                    dev.phase === 'Servicing' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    {dev.phase}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-fcGold transition-colors">
                    {dev.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-slate-600 mb-4">
                    <MapPin size={16} />
                    <span className="text-sm">{dev.location}</span>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-2xl font-black text-fcGold mb-1">
                        {dev.available_stands || 0}
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        Available Stands
                      </div>
                    </div>
                    
                    {dev.price_per_sqm && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-2xl font-black text-slate-900 mb-1">
                          ${dev.price_per_sqm}
                        </div>
                        <div className="text-xs text-slate-600 font-medium">
                          Per m²
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-600">View Details</span>
                      <div className="w-8 h-8 bg-fcGold/10 rounded-full flex items-center justify-center group-hover:bg-fcGold group-hover:scale-110 transition-all">
                        <Home size={16} className="text-fcGold group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
