'use client';

import React, { useState, useEffect } from 'react';
import {
  Search, MapPin, Building2, TrendingUp, Filter,
  ChevronRight, Eye, EyeOff, Calendar, Layers, Grid3x3, List,
  Home, Users, CheckCircle2, Clock, ArrowUpRight, Save, X, ArrowUp, ArrowDown, GripVertical
} from 'lucide-react';
import { Development, DevelopmentPhase, Branch } from '../types';
import { SkeletonCard } from './Skeleton';
import Image from 'next/image';
import { authenticatedFetch } from '../lib/api-client';

interface DevelopmentsOverviewProps {
  activeBranch: Branch;
  userRole?: 'Admin' | 'Agent' | 'Manager' | 'Client';
  onDevelopmentClick: (dev: Development) => void;
  onReserveClick: (dev: Development) => void;
  refreshTrigger?: number;
}

/**
 * Premium Developments Overview - Card Grid Layout
 * 
 * Modern, responsive, premium design with:
 * - Full-width hero header with metrics
 * - Responsive card grid (3-4 cols desktop, 2 tablet, 1 mobile)
 * - Lazy-loaded images
 * - Status badges and metrics
 * - Smooth hover animations
 * - Filter sidebar/top bar
 */
export function DevelopmentsOverview({
  activeBranch,
  userRole = 'Admin',
  onDevelopmentClick,
  onReserveClick,
  refreshTrigger
}: DevelopmentsOverviewProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<DevelopmentPhase | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'hidden'>('all');

  // Fetch developments from API
  useEffect(() => {
    setIsLoading(true);
    // Use authenticatedFetch if available, fallback to fetch if not imported correctly or if causing issues
    // Using fetch for now as it was originally used, but adding logic for refresh key
    fetch('/api/admin/developments')
      .then(res => res.json())
      .then(data => {
        const allDevs = data.data || [];
        console.log('[DevelopmentsOverview] Loaded developments:', allDevs.length);
        setDevelopments(allDevs);
      })
      .catch(err => {
        console.error('[DevelopmentsOverview] Error loading developments:', err);
        setDevelopments([]);
      })
      .finally(() => setIsLoading(false));
  }, [activeBranch, refreshTrigger]);

  const handleReorderSave = async (featured: any[], list: any[]) => {
    try {
      const response = await authenticatedFetch('/api/admin/developments/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ featured, list }),
      });

      const result = await response.json();

      if (result.success) {
        // Trigger generic refresh by forcing re-fetch
        fetch('/api/admin/developments')
          .then(res => res.json())
          .then(data => setDevelopments(data.data || []));
      } else {
        console.error('Failed to save order:', result.error);
      }
    } catch (e) {
      console.error(e);
    }
  }


  const toggleVisibility = async (dev: Development) => {
    const newStatus = !dev.isPublic;
    // Optimistic update
    setDevelopments(prev => prev.map(d => d.id === dev.id ? { ...d, isPublic: newStatus } : d));

    try {
      const response = await authenticatedFetch(`/api/admin/developments/${dev.id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update visibility');

    } catch (e) {
      console.error('Failed to toggle visibility', e);
      // Revert on error
      setDevelopments(prev => prev.map(d => d.id === dev.id ? { ...d, isPublic: !newStatus } : d));
    }
  };

  // Filter developments
  const filteredDevelopments = developments.filter(dev => {
    const matchesSearch = dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.locationName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPhase = phaseFilter === 'ALL' || dev.phase === phaseFilter;
    return matchesSearch && matchesPhase;
  });

  // Calculate metrics
  const metrics = {
    total: developments.length,
    available: developments.reduce((sum, dev) => sum + (dev.availableStands || 0), 0),
    reserved: developments.reduce((sum, dev) => sum + ((dev.totalStands || 0) - (dev.availableStands || 0)), 0),
    activeProjects: developments.filter(dev => dev.phase === 'SERVICING').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Title & Description */}
            <div>
              <h1 className="text-4xl lg:text-5xl font-black mb-3 tracking-tight">
                Developments Overview
              </h1>
              <p className="text-slate-300 text-lg font-medium max-w-2xl">
                Browse available estates and properties across {activeBranch}
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-3">
              {userRole === 'Admin' && (
                <button
                  onClick={() => setIsReorderModalOpen(true)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all duration-200 flex items-center gap-2 font-medium text-sm"
                >
                  <ArrowUpRight className="rotate-45" size={18} />
                  <span className="hidden sm:inline">Reorder</span>
                </button>
              )}
              <div className="h-8 w-px bg-slate-700 mx-1 hidden sm:block" />
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl transition-all duration-200 ${viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
              >
                <Grid3x3 size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-xl transition-all duration-200 ${viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <MetricCard
              icon={Building2}
              label="Total Developments"
              value={metrics.total}
              trend="+12%"
              iconColor="from-blue-500 to-blue-600"
            />
            <MetricCard
              icon={Home}
              label="Available Units"
              value={metrics.available}
              trend="+8%"
              iconColor="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Reserved Units"
              value={metrics.reserved}
              trend="+24%"
              iconColor="from-amber-500 to-amber-600"
            />
            <MetricCard
              icon={Clock}
              label="Active Projects"
              value={metrics.activeProjects}
              trend="On track"
              iconColor="from-purple-500 to-purple-600"
            />
          </div>
        </div>
      </div>

      {isReorderModalOpen && (
        <ReorderModal
          isOpen={isReorderModalOpen}
          onClose={() => setIsReorderModalOpen(false)}
          developments={developments}
          onSave={handleReorderSave}
        />
      )}

      {/* Filters & Search */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search developments by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-medium placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all"
              />
            </div>

            {/* Phase Filter */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border-2 border-slate-200">
              {(['ALL', 'SERVICING', 'READY_TO_BUILD'] as const).map(phase => (
                <button
                  key={phase}
                  onClick={() => setPhaseFilter(phase)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${phaseFilter === phase
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {phase === 'ALL' ? 'All' : phase === 'SERVICING' ? 'Servicing' : 'Ready'}
                </button>
              ))}
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden px-5 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2"
            >
              <Filter size={18} />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredDevelopments.length === 0 ? (
          <div className="col-span-full py-24 text-center">
            <Building2 size={64} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No developments found</h3>
            <p className="text-slate-600">
              {searchQuery || phaseFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'No developments available at the moment'}
            </p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {filteredDevelopments.map((dev, index) => (
              <DevelopmentCard
                key={dev.id}
                development={dev}
                onView={() => onDevelopmentClick(dev)}
                onReserve={() => onReserveClick(dev)}
                viewMode={viewMode}
                index={index}
                userRole={userRole}
                onToggleVisibility={() => toggleVisibility(dev)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  iconColor
}: {
  icon: any;
  label: string;
  value: number | string;
  trend: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20 hover:bg-white/15 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 bg-gradient-to-br ${iconColor} rounded-xl shadow-lg`}>
          <Icon size={20} className="text-white" />
        </div>
        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
          <TrendingUp size={12} />
          {trend}
        </span>
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className="text-slate-300 text-sm font-medium">{label}</div>
    </div>
  );
}

// Development Card Component
function DevelopmentCard({
  development,
  onView,
  onReserve,
  viewMode,
  index,
  userRole,
  onToggleVisibility
}: {
  development: Development;
  onView: () => void;
  onReserve: () => void;
  viewMode: 'grid' | 'list';
  index: number;
  userRole?: string;
  onToggleVisibility: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Status badge config
  const statusConfig = {
    SERVICING: {
      label: 'Servicing',
      color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
      icon: Clock
    },
    READY_TO_BUILD: {
      label: 'Ready to Build',
      color: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
      icon: CheckCircle2
    },
  };

  const status = statusConfig[development.phase as keyof typeof statusConfig] || statusConfig.SERVICING;
  const StatusIcon = status.icon;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 group">
        <div className="flex items-center gap-6">
          {/* Image */}
          <div className="relative w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
            {development.imageUrls?.[0] ? (
              <Image
                src={development.imageUrls[0]}
                alt={development.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                onLoad={() => setImageLoaded(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <Building2 size={32} className="text-slate-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-slate-700 transition-colors">
                  {development.name}
                </h3>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <MapPin size={16} className="text-slate-400" />
                  <span className="font-medium">{development.locationName || 'Location TBA'}</span>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${status.color}`}>
                <StatusIcon size={14} />
                {status.label}
              </span>
            </div>

            <div className="flex items-center gap-8 mb-4">
              <div>
                <div className="text-2xl font-black text-slate-900">{development.availableStands || 0}</div>
                <div className="text-xs text-slate-600 font-medium">Available</div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-600">{development.totalStands || 0}</div>
                <div className="text-xs text-slate-600 font-medium">Total Units</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onView}
                className="flex-1 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                View Details
              </button>
              <button
                onClick={onReserve}
                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Reserve Unit
                <ArrowUpRight size={16} />
              </button>
              {userRole === 'Admin' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
                  className={`p-2.5 rounded-xl transition-colors ${development.isPublic !== false
                    ? 'bg-slate-100 text-slate-400 hover:text-slate-600'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  title={development.isPublic !== false ? "Visible to public" : "Hidden from public"}
                >
                  {development.isPublic !== false ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image Banner */}
      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
        {development.imageUrls?.[0] ? (
          <>
            <Image
              src={development.imageUrls[0]}
              alt={development.name}
              fill
              className={`object-cover group-hover:scale-110 transition-transform duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              loading={index > 6 ? 'lazy' : 'eager'}
              onLoad={() => setImageLoaded(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <Building2 size={48} className="text-slate-400" />
          </div>
        )}

        {/* Status Badge Overlay */}
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm ${status.color} shadow-lg`}>
            <StatusIcon size={14} />
            {status.label}
          </span>
        </div>

        {/* Hidden Badge */}
        {development.isPublic === false && (
          <div className="absolute top-4 right-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm bg-red-500/90 text-white shadow-lg">
              <EyeOff size={14} />
              Hidden
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Title & Location */}
        <h3 className="text-xl font-black text-slate-900 mb-2 line-clamp-1 group-hover:text-slate-700 transition-colors">
          {development.name}
        </h3>
        <div className="flex items-center gap-2 text-slate-600 text-sm mb-4">
          <MapPin size={16} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium truncate">{development.locationName || 'Location TBA'}</span>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
          <div className="flex-1">
            <div className="text-2xl font-black text-slate-900">{development.availableStands || 0}</div>
            <div className="text-xs text-slate-600 font-medium">Available</div>
          </div>
          <div className="h-12 w-px bg-slate-200" />
          <div className="flex-1">
            <div className="text-2xl font-black text-slate-600">{development.totalStands || 0}</div>
            <div className="text-xs text-slate-600 font-medium">Total Units</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onView}
            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            View
          </button>
          <button
            onClick={onReserve}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            Reserve
            <ArrowUpRight size={16} />
          </button>
        </div>

        {/* Admin Visibility Toggle (Overlay on Grid) */}
        {userRole === 'Admin' && (
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
              className={`p-2 rounded-full shadow-lg border transition-all ${development.isPublic !== false
                ? 'bg-white text-slate-400 hover:text-slate-900 border-slate-200'
                : 'bg-red-50 text-red-600 border-red-100'
                }`}
              title={development.isPublic !== false ? "Visible to public" : "Hidden from public"}
            >
              {development.isPublic !== false ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Reorder Modal Component
function ReorderModal({
  isOpen,
  onClose,
  developments,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  developments: Development[];
  onSave: (featured: any[], list: any[]) => Promise<void>;
}) {
  const [featuredList, setFeaturedList] = useState<Development[]>([]);
  const [mainList, setMainList] = useState<Development[]>([]);
  const [draggedItem, setDraggedItem] = useState<Development | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Sort by current rank
      const sortedDevs = [...developments];
      const featured = sortedDevs
        .filter(d => d.featuredRank !== null && d.featuredRank !== undefined)
        .sort((a, b) => (a.featuredRank || 0) - (b.featuredRank || 0));

      const others = sortedDevs
        .filter(d => d.featuredRank === null || d.featuredRank === undefined)
        .sort((a, b) => {
          const rankA = a.displayRank !== null && a.displayRank !== undefined ? a.displayRank : 9999;
          const rankB = b.displayRank !== null && b.displayRank !== undefined ? b.displayRank : 9999;
          return rankA - rankB;
        });

      setFeaturedList(featured);
      setMainList(others);
    }
  }, [isOpen, developments]);

  const handleMove = (item: Development, direction: 'up' | 'down', listType: 'featured' | 'main') => {
    const list = listType === 'featured' ? [...featuredList] : [...mainList];
    const index = list.findIndex(d => d.id === item.id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
    } else if (direction === 'down' && index < list.length - 1) {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
    }

    if (listType === 'featured') setFeaturedList(list);
    else setMainList(list);
  };

  const moveToFeatured = (item: Development) => {
    setMainList(prev => prev.filter(d => d.id !== item.id));
    setFeaturedList(prev => [...prev, item]); // append to end
  };

  const moveToMain = (item: Development) => {
    setFeaturedList(prev => prev.filter(d => d.id !== item.id));
    setMainList(prev => [item, ...prev]); // prepend to top
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(
        featuredList.map(d => ({ id: d.id })), // backend will assign rank based on index
        mainList.map((d, index) => ({ id: d.id, rank: index + 1 }))
      );
      onClose();
    } catch (error) {
      console.error('Failed to save order:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Reorder Developments</h3>
            <p className="text-sm text-gray-500">Arrange featured items and main list order.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30">

          {/* Featured Section */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Featured (Top Row)
            </h4>
            <div className="bg-white rounded-xl border-2 border-amber-100 shadow-sm overflow-hidden">
              {featuredList.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm border-dashed border-2 border-gray-100 m-4 rounded-xl">
                  No featured developments. Move items here from below.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {featuredList.map((dev, idx) => (
                    <div key={dev.id} className="p-3 flex items-center gap-4 hover:bg-amber-50/30 transition-colors group">
                      <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                        {idx + 1}
                      </span>
                      <div className="w-10 h-10 rounded-lg bg-gray-100 relative overflow-hidden flex-shrink-0">
                        {dev.imageUrls?.[0] && <Image src={dev.imageUrls[0]} fill alt="" className="object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{dev.name}</div>
                        <div className="text-xs text-gray-500 truncate">{dev.locationName}</div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleMove(dev, 'up', 'featured')} disabled={idx === 0} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:text-gray-900 disabled:opacity-30">
                          <ArrowUp size={16} />
                        </button>
                        <button onClick={() => handleMove(dev, 'down', 'featured')} disabled={idx === featuredList.length - 1} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:text-gray-900 disabled:opacity-30">
                          <ArrowDown size={16} />
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        <button onClick={() => moveToMain(dev)} className="px-2 py-1 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-medium rounded-md transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Main List Section */}
          <section>
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              All Developments (Grid Order)
            </h4>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {mainList.map((dev, idx) => (
                  <div key={dev.id} className="p-3 flex items-center gap-4 hover:bg-gray-50 transition-colors group">
                    <span className="w-8 text-right text-xs font-medium text-gray-400">
                      {(dev.displayRank || 999) === 999 ? '-' : dev.displayRank}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-gray-100 relative overflow-hidden flex-shrink-0">
                      {dev.imageUrls?.[0] && <Image src={dev.imageUrls[0]} fill alt="" className="object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{dev.name}</div>
                      <div className="text-xs text-gray-500 truncate">{dev.locationName}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveToFeatured(dev)} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-md transition-colors mr-2">
                        Make Featured
                      </button>
                      <button onClick={() => handleMove(dev, 'up', 'main')} disabled={idx === 0} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:text-gray-900 disabled:opacity-30">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => handleMove(dev, 'down', 'main')} disabled={idx === mainList.length - 1} className="p-1.5 hover:bg-white rounded-md text-gray-500 hover:text-gray-900 disabled:opacity-30">
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <span className="animate-spin">âŸ³</span> : <Save size={16} />}
            {isSaving ? 'Saving Order...' : 'Save Layout'}
          </button>
        </div>
      </div>
    </div>
  );
}
