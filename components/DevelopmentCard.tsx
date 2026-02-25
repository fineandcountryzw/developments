'use client';

import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Droplets, Route, Zap, Wifi, MapPin, Home, TrendingUp, Heart,
  Share2, Info, Clock, CheckCircle2, AlertCircle, Building2, Truck, Waves, ShieldCheck
} from 'lucide-react';

// ============================================
// TYPE GUARDS & SAFE PARSERS
// ============================================

/**
 * Safely parse a number from any input
 */
function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? fallback : num;
}

/**
 * Safely parse an array - handles string "[]", null, undefined
 */
function safeArray<T = string>(value: any): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // Handle string that looks like array (e.g. "[]" or "[a,b]")
  if (typeof value === 'string') {
    if (value === '[]' || value.trim() === '') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Safely get string value
 */
function safeString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Get infrastructure progress summary from estate_progress JSON
 * Returns: 'Complete', 'In Progress', 'Planned', or null if not set
 */
function getEstateProgressSummary(estateProgress: any): { status: string; color: string; icon: React.ReactNode } | null {
  if (!estateProgress || typeof estateProgress !== 'object') return null;

  const infraItems = ['roads', 'water', 'sewer', 'electricity'];
  const statuses = infraItems.map(key => estateProgress[key]).filter(Boolean);

  if (statuses.length === 0) return null;

  const completed = statuses.filter(s => s === 'completed').length;
  const inProgress = statuses.filter(s => s === 'in_progress').length;
  const planned = statuses.filter(s => s === 'planned').length;

  if (completed === statuses.length) {
    return {
      status: 'Complete',
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: <CheckCircle2 size={12} className="text-green-600" />
    };
  }
  if (completed > 0 || inProgress > 0) {
    return {
      status: 'In Progress',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      icon: <Clock size={12} className="text-amber-600" />
    };
  }
  if (planned > 0) {
    return {
      status: 'Planned',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      icon: <Truck size={12} className="text-blue-600" />
    };
  }
  return {
    status: 'Not Started',
    color: 'text-gray-500 bg-gray-50 border-gray-200',
    icon: <AlertCircle size={12} className="text-gray-500" />
  };
}

interface DevelopmentCardProps {
  development: any; // Accept any structure from API
  onCardClick: (dev: any) => void;
  onFavorite?: (devId: string) => void;
  isFavorited?: boolean;
  index?: number;
  lazy?: boolean;
}

const DevLogo = ({ url, name }: { url?: string; name: string }) => {
  const [isError, setIsError] = useState(false);

  if (!url || isError) {
    return (
      <div className="h-8 w-8 rounded bg-fcGold flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
        {name.substring(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={`${name} logo`}
      width={32}
      height={32}
      className="object-contain bg-white/90 p-1 rounded shadow-sm border border-white/20"
      onError={() => setIsError(true)}
    />
  );
};

const InfrastructureIcon = ({
  type,
  present,
  label
}: {
  type: string;
  present: boolean;
  label: string
}) => {
  if (!present) return null;

  const iconClass = "text-fcGold transition-all duration-500 group-hover:scale-125 group-hover:drop-shadow-[0_0_8px_rgba(197,160,89,0.3)]";

  const icons = {
    water: <Droplets size={14} className={iconClass} />,
    roads: <Route size={14} className={iconClass} />,
    power: <Zap size={14} className={iconClass} />,
    connectivity: <Wifi size={14} className={iconClass} />
  };

  return (
    <span title={label}>
      {icons[type as keyof typeof icons]}
    </span>
  );
};

const StatusBadge = ({ phase, servicing_progress }: { phase: string; servicing_progress: number | string }) => {
  const progress = safeNumber(servicing_progress, 0);

  const isReady = phase === 'READY_TO_BUILD';
  const servicingComplete = progress >= 90;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${isReady
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : servicingComplete
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-gray-100 text-gray-700 border border-gray-200'
      }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-500' : servicingComplete ? 'bg-amber-500' : 'bg-gray-500'
        }`}></span>
      {isReady ? 'Ready to Build' : servicingComplete ? 'Nearly Ready' : 'Servicing'}
    </div>
  );
};

const PriceDisplay = ({ basePrice, pricePerSqm }: { basePrice: number | string; pricePerSqm?: number | string }) => {
  const price = safeNumber(basePrice, 0);
  const pricePerUnit = safeNumber(pricePerSqm, 0);

  return (
    <div className="space-y-3">
      {/* Price per SQM - Primary display when available */}
      {pricePerUnit > 0 && (
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-medium text-gray-500">Price per m²</span>
          <span className="text-xl font-bold text-gray-900">${pricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}
      {/* Base Price - Secondary display */}
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-medium text-gray-500">
          {pricePerUnit > 0 ? 'Starting From' : 'Asking Price'}
        </span>
        <span className={`font-bold ${pricePerUnit > 0 ? 'text-base text-gray-700' : 'text-xl text-gray-900'}`}>
          ${price > 0 ? price.toLocaleString() : 'TBD'}
        </span>
      </div>
    </div>
  );
};

const AvailabilityStats = ({ available, total, location }: { available: number; total: number; location: string }) => {
  const percentage = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div className="space-y-3 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <MapPin size={14} className="text-fcGold flex-shrink-0" />
        <span className="truncate">{location}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Available Stands</span>
        <span className="font-semibold text-gray-900">{available}/{total}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-fcGold transition-all duration-700 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const DevelopmentCardComponent: React.FC<DevelopmentCardProps> = ({
  development: dev,
  onCardClick,
  onFavorite,
  isFavorited = false,
  index = 0,
  lazy = false
}) => {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 3D Tilt effect refs
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState({ transform: '' });

  // Handle 3D tilt on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 25;
    const rotateY = (centerX - x) / 25;
    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTiltStyle({ transform: '' });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // Safe field extraction with type guards
  const imageUrls = useMemo(() => safeArray<string>(dev.image_urls), [dev.image_urls]);
  const imageUrl = useMemo(() => imageUrls[0] || '', [imageUrls]);
  const infrastructure = useMemo(() => dev.infrastructure_json || { water: [], roads: [], power: [], connectivity: [] }, [dev.infrastructure_json]);
  const price = useMemo(() => safeNumber(dev.base_price, 0), [dev.base_price]);
  const pricePerSqm = useMemo(() => safeNumber(dev.price_per_sqm, 0), [dev.price_per_sqm]);
  const servicingProgress = useMemo(() => safeNumber(dev.servicing_progress, 0), [dev.servicing_progress]);
  const standTypes = useMemo(() => safeArray<string>(dev.stand_types), [dev.stand_types]);
  const features = useMemo(() => safeArray<string>(dev.features), [dev.features]); // features/amenities

  // Parse stand_sizes from JSON (stored as JSONB in database)
  const standSizes = useMemo(() => {
    try {
      if (!dev.stand_sizes) return null;
      const sizes = typeof dev.stand_sizes === 'string'
        ? JSON.parse(dev.stand_sizes)
        : dev.stand_sizes;
      if (typeof sizes === 'object' && sizes !== null) {
        return {
          small: safeNumber(sizes.small, 0),
          medium: safeNumber(sizes.medium, 0),
          large: safeNumber(sizes.large, 0)
        };
      }
    } catch (e) {
      // Silently handle parse errors
    }
    return null;
  }, [dev.stand_sizes]);
  const overview = useMemo(() => safeString(dev.overview || dev.description, ''), [dev.overview, dev.description]);
  const location = useMemo(() => safeString(dev.location || dev.location_name, 'Zimbabwe'), [dev.location, dev.location_name]);
  const availableStands = useMemo(() => safeNumber(dev.available_stands, 0), [dev.available_stands]);
  const totalStands = useMemo(() => safeNumber(dev.total_stands, 0), [dev.total_stands]);
  // Estate Progress summary from new infrastructure milestones
  const estateProgressSummary = useMemo(() => getEstateProgressSummary(dev.estate_progress), [dev.estate_progress]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite?.(dev.id);
  }, [dev.id, onFavorite]);

  const handleShareClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: dev.name,
        text: `Check out ${dev.name} - ${location}`,
        url: typeof window !== 'undefined' ? window.location.href : ''
      }).catch(() => {
        // Silently handle rejection
      });
    } else {
      // Fallback: copy to clipboard
      const text = `${dev.name} - ${location}\n$${price.toLocaleString()}`;
      navigator.clipboard.writeText(text);
    }
  }, [dev, price, location]);

  const handleCardClick = useCallback(() => {
    onCardClick(dev);
  }, [dev, onCardClick]);

  return (
    <motion.div
      ref={cardRef}
      className="group h-full flex flex-col bg-white rounded-2xl border border-gray-100 shadow-forensic overflow-hidden hover:shadow-forensic-lg cursor-pointer transition-shadow duration-500"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={tiltStyle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
    >
      {/* Image Section with Lazy Loading */}
      <div className="aspect-[16/10] overflow-hidden relative bg-gray-100">
        {imageUrl && imageUrl.startsWith('http') ? (
          <>
            {isImageLoading && (
              <div className="absolute inset-0 overflow-hidden">
                {/* Premium Shimmer Loading Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: 'linear',
                    repeatDelay: 0.5
                  }}
                  style={{ width: '50%' }}
                />
              </div>
            )}
            <img
              src={imageUrl}
              alt={dev.name}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isImageLoading ? 'opacity-0' : 'opacity-100'
                }`}
              onLoad={() => setIsImageLoading(false)}
              onError={() => {
                setImageError(true);
                setIsImageLoading(false);
              }}
              loading={lazy ? 'lazy' : 'eager'}
              decoding="async"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-white">
            <Home className="text-fcGold/40 mb-2" size={32} />
            <span className="text-sm font-semibold text-gray-600">Fine & Country</span>
            <span className="text-xs text-gray-400 mt-1 text-center px-4">{dev.name}</span>
          </div>
        )}

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Premium Ribbon Badges */}
        {(dev as any).featuredTag === 'hot' && (
          <div className="absolute -top-px -left-px z-20">
            <div className="relative">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-8 shadow-lg"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)',
                  transform: 'rotate(-45deg) translate(-22px, -8px)',
                  transformOrigin: 'top left',
                  width: '120px',
                  textAlign: 'center'
                }}>
                🔥 Hot
              </div>
            </div>
          </div>
        )}
        {(dev as any).featuredTag === 'promo' && (
          <div className="absolute -top-px -left-px z-20">
            <div className="relative">
              <div className="bg-gradient-to-br from-fcGold to-amber-500 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-8 shadow-lg"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)',
                  transform: 'rotate(-45deg) translate(-22px, -8px)',
                  transformOrigin: 'top left',
                  width: '120px',
                  textAlign: 'center'
                }}>
                ⚡ Promo
              </div>
            </div>
          </div>
        )}
        {(dev as any).featuredTag === 'new' && (
          <div className="absolute -top-px -left-px z-20">
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-8 shadow-lg"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)',
                  transform: 'rotate(-45deg) translate(-22px, -8px)',
                  transformOrigin: 'top left',
                  width: '120px',
                  textAlign: 'center'
                }}>
                ✨ New
              </div>
            </div>
          </div>
        )}

        {/* Top-right: Action buttons */}
        <div className="absolute top-4 right-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handleFavoriteClick}
            className={`p-2 rounded-lg backdrop-blur-md transition-all duration-300 ${isFavorited
              ? 'bg-red-500 text-white'
              : 'bg-white/90 text-gray-600 hover:text-red-500'
              }`}
            title="Add to favorites"
          >
            <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={handleShareClick}
            className="p-2 rounded-lg backdrop-blur-md bg-white/90 text-gray-600 hover:text-fcGold transition-all duration-300"
            title="Share this development"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Bottom overlay with title */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
          <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight drop-shadow-md line-clamp-2">{dev.name}</h3>
        </div>
      </div>

      {/* Features & Price Section */}
      <div className="flex-1 p-6 space-y-6 flex flex-col bg-white/50 backdrop-blur-sm">
        {/* Features Row */}
        {/* Status and Logo Row */}
        <div className="flex items-center justify-between">
          <StatusBadge phase={dev.phase} servicing_progress={servicingProgress} />
          <DevLogo url={dev.logo_url} name={dev.name} />
        </div>

        {/* Overview/Description */}
        {overview && (
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
            {overview}
          </p>
        )}

        {/* Stand Sizes */}
        {standSizes && (standSizes.small > 0 || standSizes.medium > 0 || standSizes.large > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Building2 size={12} className="text-fcGold" />
              <span>Stand Sizes Available</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {standSizes.small > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  Small: {standSizes.small}m²
                </span>
              )}
              {standSizes.medium > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg border border-green-200">
                  Medium: {standSizes.medium}m²
                </span>
              )}
              {standSizes.large > 0 && (
                <span className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
                  Large: {standSizes.large}m²
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stand Types */}
        {standTypes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Home size={12} className="text-fcGold" />
              <span>Stand Types</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {standTypes.map((type, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg border border-amber-200"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Features / Amenities */}
        {features.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Zap size={12} className="text-fcGold" />
              <span>Features & Amenities</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-auto pr-1">
              {features.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg border border-gray-100"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Infrastructure Status */}
        {estateProgressSummary && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg self-start ${estateProgressSummary.color}`}>
            {estateProgressSummary.icon}
            <span>Infrastructure: {estateProgressSummary.status}</span>
          </div>
        )}

        {/* Availability and Location Stats */}
        <AvailabilityStats
          available={availableStands}
          total={totalStands}
          location={location}
        />

        {/* Price Display - grows to bottom */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <PriceDisplay
            basePrice={price}
            pricePerSqm={pricePerSqm}
          />
        </div>

        {/* View Details Button */}
        <button
          onClick={handleCardClick}
          className="w-full mt-6 px-6 py-4 bg-fcGold text-white text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-fcGold/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-fcGold/10 hover:shadow-fcGold/20 active:scale-[0.98]"
        >
          <span>Explore Development</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const DevelopmentCard = memo(DevelopmentCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.development.id === nextProps.development.id &&
    prevProps.development.name === nextProps.development.name &&
    prevProps.development.base_price === nextProps.development.base_price &&
    prevProps.development.available_stands === nextProps.development.available_stands &&
    prevProps.isFavorited === nextProps.isFavorited &&
    prevProps.index === nextProps.index &&
    prevProps.lazy === nextProps.lazy &&
    prevProps.onCardClick === nextProps.onCardClick &&
    prevProps.onFavorite === nextProps.onFavorite
  );
});
