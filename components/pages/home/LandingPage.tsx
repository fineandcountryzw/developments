"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useLogo } from "@/contexts/LogoContext";
import { DEFAULT_LOGO } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { cachedFetch } from "@/lib/api-cache";
import {
  TrendingUp,
  ArrowRight,
  Building2,
  MapPin,
  Layers,
  Droplets,
  Landmark,
  Clock,
  ShieldCheck,
  FileText,
  Phone,
  Mail,
  Globe,
  Lock,
  Cpu,
  Database,
  CheckCircle2,
  Layout,
  Zap,
  Fingerprint,
  Briefcase,
  User,
  Users,

  Route,
  Sun,
  Wifi,
  Hammer,
  Shield,
  ShieldAlert,
  Cpu as ChipIcon,
  FileCode,
  ChevronRight,
  Camera,
  Maximize2,
  Download,
  TrendingUp as AppreciationIcon,
  Check,
  Waves,
  ChevronLeft,
  ImageIcon,
  MapPinOff,
  X,
  Calendar,
} from "lucide-react";
import {
  Role,
  Development,
  Stand,
  DevelopmentPhase,
  DevelopmentDocument,
  Agent,
} from "../../../types";

import { LegalPages } from "../../LegalPages";
import { ReservationFlowModal } from "../../ReservationFlowModal";
import { DevelopmentCard } from "../../DevelopmentCard";
import { HeroAnimatedBackground } from "../../HeroAnimatedBackground";
import { Header } from "../../Header";
import { Footer } from "../../Footer";
import { ScrollProgress } from "../../ScrollProgress";

// Dynamic import with ssr: false to avoid Leaflet window reference errors during SSR
const PlotSelectorMap = dynamic(
  () => import("../../PlotSelectorMap").then((mod) => mod.PlotSelectorMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
        <span>Loading map...</span>
      </div>
    ),
  },
);

interface LandingPageProps {
  /** Logo comes from useLogo() everywhere - same source as dashboards, login, sidebar. */
  logoUrl?: string;
}

interface StandTableRow {
  id: string;
  standNumber: string;
  status: string;
  price?: number;
  size?: string;
}

const ProgressBar = ({
  label,
  percentage,
  icon: Icon,
}: {
  label: string;
  percentage: number;
  icon: any;
}) => (
  <div className="space-y-3 font-sans">
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-fcGold/10 rounded-lg text-fcGold">
          <Icon size={14} />
        </div>
        <span className="text-[10px] font-bold text-fcSlate uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className="text-[11px] font-black text-fcGold font-mono">
        {percentage}%
      </span>
    </div>
    <div className="h-1.5 w-full bg-fcDivider rounded-full overflow-hidden">
      <div
        className="h-full bg-fcGold transition-all duration-1000 ease-out rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

// ============================================
// IMAGE GALLERY COMPONENT
// ============================================
interface ImageGalleryProps {
  images: string[];
  developmentName: string;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  developmentName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter valid images - must be absolute HTTP/HTTPS URLs
  const validImages = images.filter((url) => {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    return (
      trimmed !== "" &&
      (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    );
  });

  if (validImages.length === 0) {
    return (
      <div className="w-full h-64 md:h-80 bg-gray-100 rounded-2xl border border-fcDivider flex flex-col items-center justify-center text-gray-400">
        <ImageIcon size={48} className="mb-3 opacity-50" />
        <p className="text-sm font-medium">No images available</p>
        <p className="text-xs text-gray-500 mt-1">Gallery coming soon</p>
      </div>
    );
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  // Touch/swipe support for mobile
  const handleTouchStart = useRef<number>(0);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = handleTouchStart.current - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div
        className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[400px] md:max-h-[500px] rounded-2xl overflow-hidden border border-fcDivider bg-gray-100 group"
        onTouchStart={(e) => {
          handleTouchStart.current = e.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={validImages[currentIndex]}
          alt={`${developmentName} - Image ${currentIndex + 1}`}
          fill
          className="object-cover transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
          priority={currentIndex === 0}
          unoptimized={
            !validImages[currentIndex]?.includes("ufs.sh") &&
            !validImages[currentIndex]?.includes("supabase.co")
          }
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGM0YzRjMiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZTwvdGV4dD48L3N2Zz4=";
          }}
        />

        {/* Navigation Arrows - Desktop */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Image Counter */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-xs font-bold rounded-full">
          {currentIndex + 1} / {validImages.length}
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="View fullscreen"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Thumbnail Grid - Desktop (min 3 visible) */}
      {validImages.length > 1 && (
        <div
          ref={scrollRef}
          className="hidden md:grid grid-cols-5 lg:grid-cols-6 gap-3"
        >
          {validImages.slice(0, 6).map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${idx === currentIndex
                ? "border-fcGold ring-2 ring-fcGold/30"
                : "border-transparent hover:border-fcGold/50"
                }`}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                unoptimized={
                  !img?.includes("ufs.sh") && !img?.includes("supabase.co")
                }
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </button>
          ))}
          {validImages.length > 6 && (
            <div className="aspect-[4/3] rounded-xl bg-fcSlate/10 flex items-center justify-center text-fcSlate font-bold text-sm">
              +{validImages.length - 6} more
            </div>
          )}
        </div>
      )}

      {/* Mobile Dots Indicator */}
      {validImages.length > 1 && (
        <div className="flex md:hidden justify-center gap-2">
          {validImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-fcGold w-6" : "bg-gray-300"
                }`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-3 text-white hover:text-fcGold transition-colors z-10"
            aria-label="Close fullscreen"
          >
            <X size={28} />
          </button>
          <div className="relative w-full h-full max-w-[90vw] max-h-[90vh]">
            <Image
              src={validImages[currentIndex]}
              alt={`${developmentName} - Fullscreen`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
              unoptimized={
                !validImages[currentIndex]?.includes("ufs.sh") &&
                !validImages[currentIndex]?.includes("supabase.co")
              }
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src =
                  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGM0YzRjMiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZTwvdGV4dD48L3N2Zz4=";
              }}
            />
          </div>
          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white hover:text-fcGold transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft size={40} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white hover:text-fcGold transition-colors"
                aria-label="Next image"
              >
                <ChevronRight size={40} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = () => {
  const router = useRouter();
  const { data: session, status } = useSession();

  const { logoUrl } = useLogo();
  const effectiveLogo = logoUrl || DEFAULT_LOGO;
  const isDefaultLogo =
    effectiveLogo === DEFAULT_LOGO || effectiveLogo.startsWith("/logos/");

  const [developments, setDevelopments] = useState<Development[]>([]);
  const [featuredDevelopments, setFeaturedDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<Development | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<"ALL" | DevelopmentPhase>(
    "ALL",
  );

  // Legal State
  const [activeLegalPage, setActiveLegalPage] = useState<
    "privacy" | "terms" | "cookies" | null
  >(null);

  // Unified Reservation Modal State
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedStandForReservation, setSelectedStandForReservation] =
    useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedStandIdFromMap, setSelectedStandIdFromMap] = useState<
    string | null
  >(null);
  const [standTableRows, setStandTableRows] = useState<StandTableRow[]>([]);
  const [standTableLoading, setStandTableLoading] = useState(false);

  // Error state for debugging
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch developments from API with caching
    cachedFetch<any>("/api/public/developments")
      .then((response) => {
        // Handle API response format: { success: true, data: { featured: [...], list: [...] } }
        let devs: Development[] = [];
        let featured: Development[] = [];

        // Check if response has success flag and nested data structure
        if (response?.success === true && response?.data) {
          const dataObj = response.data;

          // Parse Featured
          if (Array.isArray(dataObj.featured)) {
            featured = dataObj.featured;
          }

          // Parse List
          if (Array.isArray(dataObj.list)) {
            devs = dataObj.list;
          }
          // Fallbacks for legacy/other formats
          else if (Array.isArray(dataObj.data)) {
            devs = dataObj.data;
          }
          else if (Array.isArray(dataObj.developments)) {
            devs = dataObj.developments;
          }
          else if (Array.isArray(dataObj)) {
            devs = dataObj;
          }
          else if (dataObj.error) {
            throw new Error(dataObj.error);
          }
        }
        // Fallback: Check if response.data is directly an array (no success flag)
        else if (Array.isArray(response?.data)) {
          devs = response.data;
        }
        // Fallback: Check response.developments
        else if (Array.isArray(response?.developments)) {
          devs = response.developments;
        }
        // Error case
        else if (response?.error) {
          throw new Error(response.error);
        }

        logger.info("Fetched developments", {
          module: "LandingPage",
          total: devs.length,
          first: devs[0]?.name,
          responseStructure: {
            hasSuccess: response?.success,
            hasData: !!response?.data,
            dataType: typeof response?.data,
            dataKeys:
              response?.data && typeof response.data === "object"
                ? Object.keys(response.data)
                : [],
          },
        });
        // Helper to normalize dev
        const normalizeDev = (dev: any) => {
          // Normalize data structure - ensure all fields are properly typed

          // Parse standSizes from JSON (stored as JSONB in database)
          let parsedStandSizes = null;
          try {
            if (dev.standSizes || dev.stand_sizes) {
              const sizes = dev.standSizes || dev.stand_sizes;
              parsedStandSizes =
                typeof sizes === "string"
                  ? JSON.parse(sizes)
                  : sizes;
            }
          } catch (e) {
            // Silently handle parse errors
          }

          // Parse standTypes (stored as TEXT[] in database)
          let parsedStandTypes: string[] = [];
          try {
            if (dev.standTypes || dev.stand_types) {
              const types = dev.standTypes || dev.stand_types;
              parsedStandTypes = Array.isArray(types)
                ? types
                : typeof types === "string"
                  ? JSON.parse(types)
                  : [];
            }
          } catch (e) {
            // Silently handle parse errors
          }

          return {
            ...dev,
            // Ensure locationName exists (fallback to location)
            locationName: dev.locationName || dev.location_name || dev.location || "Location",
            // Ensure documentUrls is always an array
            documentUrls: Array.isArray(dev.documentUrls) ? dev.documentUrls : Array.isArray(dev.document_urls) ? dev.document_urls : [],
            // Ensure imageUrls is always an array
            imageUrls: Array.isArray(dev.imageUrls) ? dev.imageUrls : Array.isArray(dev.image_urls) ? dev.image_urls : [],
            // Ensure standSizes is parsed correctly
            standSizes: parsedStandSizes,
            // Ensure standTypes is always an array
            standTypes: parsedStandTypes,
            // Ensure installmentPeriods is properly parsed
            installmentPeriods: (() => {
              if (Array.isArray(dev.installmentPeriods || dev.installment_periods)) {
                return (dev.installmentPeriods || dev.installment_periods).filter(
                  (p: any) => typeof p === "number" && p > 0,
                );
              }
              if (typeof (dev.installmentPeriods || dev.installment_periods) === "string") {
                try {
                  const parsed = JSON.parse(dev.installmentPeriods || dev.installment_periods);
                  if (Array.isArray(parsed)) {
                    return parsed.filter(
                      (p: any) => typeof p === "number" && p > 0,
                    );
                  }
                } catch (e) {
                  // Invalid JSON
                }
              }
              return [12, 24, 48];
            })(),
            // Ensure numeric fields are numbers
            basePrice:
              typeof (dev.basePrice ?? dev.base_price) === "number"
                ? (dev.basePrice ?? dev.base_price)
                : parseFloat(String((dev.basePrice ?? dev.base_price) || 0)) || 0,
            vatPercentage:
              typeof (dev.vatPercentage ?? dev.vat_percentage) === "number"
                ? (dev.vatPercentage ?? dev.vat_percentage)
                : parseFloat(String((dev.vatPercentage ?? dev.vat_percentage) || 15.5)) || 15.5,
            endowmentFee:
              typeof (dev.endowmentFee ?? dev.endowment_fee) === "number"
                ? (dev.endowmentFee ?? dev.endowment_fee)
                : parseFloat(String((dev.endowmentFee ?? dev.endowment_fee) || 0)) || 0,
            depositPercentage:
              typeof (dev.depositPercentage ?? dev.deposit_percentage) === "number"
                ? (dev.depositPercentage ?? dev.deposit_percentage)
                : parseFloat(String((dev.depositPercentage ?? dev.deposit_percentage) || 10)) || 10,
            // Ensure boolean fields are booleans
            vatEnabled:
              typeof (dev.vatEnabled ?? dev.vat_enabled) === "boolean"
                ? (dev.vatEnabled ?? dev.vat_enabled)
                : (dev.vatEnabled ?? dev.vat_enabled) !== undefined
                  ? Boolean(dev.vatEnabled ?? dev.vat_enabled)
                  : true,
            endowmentEnabled:
              typeof (dev.endowmentEnabled ?? dev.endowment_enabled) === "boolean"
                ? (dev.endowmentEnabled ?? dev.endowment_enabled)
                : (dev.endowmentEnabled ?? dev.endowment_enabled) !== undefined
                  ? Boolean(dev.endowmentEnabled ?? dev.endowment_enabled)
                  : true,
            aosEnabled:
              typeof (dev.aosEnabled ?? dev.aos_enabled) === "boolean"
                ? (dev.aosEnabled ?? dev.aos_enabled)
                : (dev.aosEnabled ?? dev.aos_enabled) !== undefined
                  ? Boolean(dev.aosEnabled ?? dev.aos_enabled)
                  : false,
            cessionsEnabled:
              typeof (dev.cessionsEnabled ?? dev.cessions_enabled) === "boolean"
                ? (dev.cessionsEnabled ?? dev.cessions_enabled)
                : (dev.cessionsEnabled ?? dev.cessions_enabled) !== undefined
                  ? Boolean(dev.cessionsEnabled ?? dev.cessions_enabled)
                  : false,
            // Parse estate_progress (infrastructure status) from JSONB
            estateProgress: (() => {
              try {
                const raw = dev.estateProgress || dev.estate_progress;
                if (!raw) return null;
                if (typeof raw === 'string') {
                  return JSON.parse(raw);
                }
                return raw;
              } catch (e) {
                return null;
              }
            })(),
            // Ensure features is parsed if it's a string
            features: (() => {
              try {
                if (Array.isArray(dev.features)) return dev.features;
                if (typeof dev.features === 'string') {
                  const parsed = JSON.parse(dev.features);
                  return Array.isArray(parsed) ? parsed : [];
                }
                return [];
              } catch (e) {
                return [];
              }
            })(),
          };
        };

        const validDevs = Array.isArray(devs) ? devs.map(normalizeDev) : [];
        const validFeatured = Array.isArray(featured) ? featured.map(normalizeDev) : [];

        logger.info("Fetched developments", {
          module: "LandingPage",
          total: validDevs.length,
          featured: validFeatured.length,
        });

        setDevelopments(validDevs);
        setFeaturedDevelopments(validFeatured);
        setLoadError(null);
      })
      .catch((err) => {
        const errorMsg = err?.message || "Failed to fetch developments";
        logger.error("Error fetching developments", err, {
          module: "LandingPage",
        });
        setLoadError(errorMsg);
        setDevelopments([]);
      });

    // Fetch agents for reservation modal with caching
    cachedFetch<{ data: Agent[]; error?: string }>("/api/admin/agents")
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        const agentList = data.data || [];
        setAgents(Array.isArray(agentList) ? agentList : []);
        logger.debug("Fetched agents", {
          module: "LandingPage",
          count: agentList.length,
        });
      })
      .catch((err) => {
        logger.error("Error fetching agents", err, { module: "LandingPage" });
        setAgents([]);
      });
  }, []);

  // Fetch fallback table stands for developments without map geometry/manual numbering setups.
  useEffect(() => {
    if (!selectedDev?.id) {
      setStandTableRows([]);
      return;
    }

    const controller = new AbortController();

    const loadStandTable = async () => {
      setStandTableLoading(true);
      try {
        const response = await fetch(
          `/api/developments/${selectedDev.id}/stands/table`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Failed to load stands table (${response.status})`);
        }

        const data = await response.json();
        const rows = Array.isArray(data?.stands) ? data.stands : [];

        setStandTableRows(
          rows.map((row: any) => ({
            id: String(row.id || ""),
            standNumber: String(row.standNumber || ""),
            status: String(row.status || "").toLowerCase(),
            price:
              typeof row.price === "number"
                ? row.price
                : Number(row.price) || undefined,
            size: typeof row.size === "string" ? row.size : undefined,
          })),
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          logger.warn("Failed to load stand table fallback", {
            module: "LandingPage",
            developmentId: selectedDev.id,
            error: error?.message || "Unknown error",
          });
          setStandTableRows([]);
        }
      } finally {
        setStandTableLoading(false);
      }
    };

    loadStandTable();

    return () => controller.abort();
  }, [selectedDev?.id]);

  // Modal event listener - listen for map stand selection events.
  useEffect(() => {
    const handleReserveStandEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const standNumber = customEvent.detail;

      logger.debug("Received reserve-stand event", {
        module: "LandingPage",
        standNumber,
        timestamp: new Date().toISOString(),
      });

      // Store the stand ID for later use in reservation flow
      setSelectedStandIdFromMap(standNumber);

      // Prepare stand data for unified modal
      const standData = {
        id: standNumber,
        number: standNumber,
        priceUsd: selectedDev?.basePrice || 0,
        pricePerSqm:
          selectedDev?.pricePerSqm ||
          (selectedDev?.basePrice && selectedDev?.totalAreaSqm
            ? selectedDev.basePrice / selectedDev.totalAreaSqm
            : undefined),
        areaSqm: selectedDev?.totalAreaSqm,
        developmentName: selectedDev?.name,
        developmentId: selectedDev?.id, // ADD: Development ID for fetching terms
      };
      setSelectedStandForReservation(standData);

      // Open unified reservation modal for all devices
      setIsReservationModalOpen(true);
    };

    // Add event listener to window
    window.addEventListener("reserve-stand", handleReserveStandEvent);

    // Cleanup
    return () => {
      window.removeEventListener("reserve-stand", handleReserveStandEvent);
    };
  }, [selectedDev]);

  // Alternative event listener - also listen for open-access-modal (backup).
  useEffect(() => {
    const handleOpenModal = async (event: any) => {
      const standId = event.detail;
      logger.debug("Received open-access-modal event", {
        module: "LandingPage",
        standId,
        timestamp: new Date().toISOString(),
      });

      // Link the map stand to the modal
      setSelectedStandIdFromMap(standId);

      // Prepare stand data
      const standData = {
        id: standId,
        number: standId.split("-").pop() || standId,
        priceUsd: selectedDev?.basePrice || 0,
        pricePerSqm:
          selectedDev?.pricePerSqm ||
          (selectedDev?.basePrice && selectedDev?.totalAreaSqm
            ? selectedDev.basePrice / selectedDev.totalAreaSqm
            : undefined),
        areaSqm: selectedDev?.totalAreaSqm,
        developmentName: selectedDev?.name,
        developmentId: selectedDev?.id, // ADD: Development ID for fetching terms
      };
      setSelectedStandForReservation(standData);

      // Forensic lead capture: log the intent immediately in Neon.
      try {
        const logResponse = await fetch("/api/admin/log-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            standId: standId,
            actionType: "MODAL_OPENED_FROM_MAP",
            developmentId: selectedDev?.id,
            timestamp: new Date().toISOString(),
          }),
        });

        if (logResponse.ok) {
          const logData = await logResponse.json();
          logger.info("Forensic lead captured", {
            module: "LandingPage",
            leadLogId: logData.leadLogId,
            location: logData.location,
            standId: standId,
          });
        } else {
          logger.warn("Forensic log failed (non-blocking)", {
            module: "LandingPage",
            status: logResponse.status,
          });
        }
      } catch (err) {
        logger.error("Forensic lead capture error (non-blocking)", err instanceof Error ? err : undefined, {
          module: "LandingPage",
        });
      }

      // Open unified reservation modal for all devices
      setIsReservationModalOpen(true);
    };

    // Listen for the map click event
    window.addEventListener("open-access-modal", handleOpenModal);

    return () => {
      window.removeEventListener("open-access-modal", handleOpenModal);
    };
  }, [selectedDev]);

  const filteredDevelopments = useMemo(() => {
    if (!Array.isArray(developments)) return [];
    const filtered = developments.filter(
      (d) => d && (phaseFilter === "ALL" || d.phase === phaseFilter),
    );

    return filtered;
  }, [developments, phaseFilter]);

  const filteredFeaturedDevelopments = useMemo(() => {
    if (!Array.isArray(featuredDevelopments)) return [];
    return featuredDevelopments.filter(
      (d) => d && (phaseFilter === "ALL" || d.phase === phaseFilter),
    );
  }, [featuredDevelopments, phaseFilter]);

  const handleDevClick = (dev: Development) => {
    setSelectedDev(dev);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const calculateTotal = (dev: Development) => {
    // Safe number parsing with fallbacks
    const basePrice =
      typeof dev.basePrice === "number"
        ? dev.basePrice
        : typeof (dev as any)?.basePrice === "string"
          ? parseFloat((dev as any).basePrice) || 0
          : 0;
    const vatPercentage =
      typeof dev.vatPercentage === "number"
        ? dev.vatPercentage
        : typeof (dev as any)?.vatPercentage === "string"
          ? parseFloat((dev as any).vatPercentage) || 15.5
          : 15.5;
    const endowmentFee =
      typeof dev.endowmentFee === "number"
        ? dev.endowmentFee
        : typeof (dev as any)?.endowmentFee === "string"
          ? parseFloat((dev as any).endowmentFee) || 0
          : 0;

    // Use fee configuration toggles (default to old behavior for backward compatibility)
    const vatEnabled =
      dev.vatEnabled !== undefined
        ? dev.vatEnabled
        : (dev as any)?.vatEnabled !== undefined
          ? (dev as any).vatEnabled
          : true;
    const endowmentEnabled =
      dev.endowmentEnabled !== undefined
        ? dev.endowmentEnabled
        : (dev as any)?.endowmentEnabled !== undefined
          ? (dev as any).endowmentEnabled
          : true;
    const aosEnabled =
      dev.aosEnabled !== undefined
        ? dev.aosEnabled
        : (dev as any)?.aosEnabled !== undefined
          ? (dev as any).aosEnabled
          : false;
    const aosFee =
      typeof dev.aosFee === "number"
        ? dev.aosFee
        : typeof (dev as any)?.aosFee === "string"
          ? parseFloat((dev as any).aosFee) || 500
          : 500;
    const cessionsEnabled =
      dev.cessionsEnabled !== undefined
        ? dev.cessionsEnabled
        : (dev as any)?.cessionsEnabled !== undefined
          ? (dev as any).cessionsEnabled
          : false;
    const cessionFee =
      typeof dev.cessionFee === "number"
        ? dev.cessionFee
        : typeof (dev as any)?.cessionFee === "string"
          ? parseFloat((dev as any).cessionFee) || 250
          : 250;

    const adminFeeEnabled =
      (dev as any)?.adminFeeEnabled !== undefined
        ? (dev as any).adminFeeEnabled
        : false;
    const adminFee =
      typeof (dev as any)?.adminFee === "number"
        ? (dev as any).adminFee
        : typeof (dev as any)?.adminFee === "string"
          ? parseFloat((dev as any).adminFee) || 0
          : 0;

    const subtotalBeforeVat =
      basePrice +
      (endowmentEnabled ? endowmentFee : 0) +
      (aosEnabled ? aosFee : 0) +
      (cessionsEnabled ? cessionFee : 0) +
      (adminFeeEnabled ? adminFee : 0);

    const vatAmount = vatEnabled
      ? subtotalBeforeVat * (vatPercentage / 100)
      : 0;
    return subtotalBeforeVat + vatAmount;
  };

  // Calculate individual fee components for display
  const calculateFeeBreakdown = (dev: Development) => {
    // Safe number parsing with fallbacks
    const basePrice =
      typeof dev.basePrice === "number"
        ? dev.basePrice
        : typeof (dev as any)?.basePrice === "string"
          ? parseFloat((dev as any).basePrice) || 0
          : 0;
    const vatPercentage =
      typeof dev.vatPercentage === "number"
        ? dev.vatPercentage
        : typeof (dev as any)?.vatPercentage === "string"
          ? parseFloat((dev as any).vatPercentage) || 15.5
          : 15.5;
    const endowmentFee =
      typeof dev.endowmentFee === "number"
        ? dev.endowmentFee
        : typeof (dev as any)?.endowmentFee === "string"
          ? parseFloat((dev as any).endowmentFee) || 0
          : 0;

    const vatEnabled =
      dev.vatEnabled !== undefined
        ? dev.vatEnabled
        : (dev as any)?.vatEnabled !== undefined
          ? (dev as any).vatEnabled
          : true;
    const endowmentEnabled =
      dev.endowmentEnabled !== undefined
        ? dev.endowmentEnabled
        : (dev as any)?.endowmentEnabled !== undefined
          ? (dev as any).endowmentEnabled
          : true;
    const aosEnabled =
      dev.aosEnabled !== undefined
        ? dev.aosEnabled
        : (dev as any)?.aosEnabled !== undefined
          ? (dev as any).aosEnabled
          : false;
    const aosFee =
      typeof dev.aosFee === "number"
        ? dev.aosFee
        : typeof (dev as any)?.aosFee === "string"
          ? parseFloat((dev as any).aosFee) || 500
          : 500;
    const cessionsEnabled =
      dev.cessionsEnabled !== undefined
        ? dev.cessionsEnabled
        : (dev as any)?.cessionsEnabled !== undefined
          ? (dev as any).cessionsEnabled
          : false;
    const cessionFee =
      typeof dev.cessionFee === "number"
        ? dev.cessionFee
        : typeof (dev as any)?.cessionFee === "string"
          ? parseFloat((dev as any).cessionFee) || 250
          : 250;

    const adminFeeEnabled =
      (dev as any)?.adminFeeEnabled !== undefined
        ? (dev as any).adminFeeEnabled
        : false;
    const adminFee =
      typeof (dev as any)?.adminFee === "number"
        ? (dev as any).adminFee
        : typeof (dev as any)?.adminFee === "string"
          ? parseFloat((dev as any).adminFee) || 0
          : 0;

    const subtotalBeforeVat =
      basePrice +
      (endowmentEnabled ? endowmentFee : 0) +
      (aosEnabled ? aosFee : 0) +
      (cessionsEnabled ? cessionFee : 0) +
      (adminFeeEnabled ? adminFee : 0);

    return {
      basePrice,
      vatEnabled,
      vatAmount: vatEnabled ? subtotalBeforeVat * (vatPercentage / 100) : 0,
      vatPercentage,
      endowmentEnabled,
      endowmentFee: endowmentEnabled ? endowmentFee : 0,
      aosEnabled,
      aosFee: aosEnabled ? aosFee : 0,
      cessionsEnabled,
      cessionFee: cessionsEnabled ? cessionFee : 0,
      adminFeeEnabled,
      adminFee: adminFeeEnabled ? adminFee : 0,
      vatBase: subtotalBeforeVat,
    };
  };

  // Navigate to dedicated login page
  const handleLoginClick = () => {
    // Close all modals before navigation
    setIsReservationModalOpen(false);
    setActiveLegalPage(null);

    // Give React 1 tick to unmount modals before navigation
    setTimeout(() => {
      router.replace("/login");
    }, 0);
  };

  const handleReserve = (
    standId: string,
    standNumber?: string,
    standPrice?: number,
    standSize?: string | number,
  ) => {
    logger.info("Reserve intent", {
      module: "LandingPage",
      stand_id: standId,
      development: selectedDev?.name,
      timestamp: new Date().toISOString(),
    });

    const parsedArea =
      typeof standSize === "number"
        ? standSize
        : typeof standSize === "string"
          ? Number.parseFloat(standSize.replace(/[^\d.]/g, "")) || undefined
          : undefined;

    // Prepare stand data for unified modal
    const standData = {
      id: standId,
      number: standNumber || standId.split("-").pop() || standId,
      priceUsd: typeof standPrice === "number" ? standPrice : selectedDev?.basePrice || 0,
      pricePerSqm:
        selectedDev?.pricePerSqm ||
        (selectedDev?.basePrice && selectedDev?.totalAreaSqm
          ? selectedDev.basePrice / selectedDev.totalAreaSqm
          : undefined),
      areaSqm: parsedArea || selectedDev?.totalAreaSqm,
      developmentName: selectedDev?.name,
      developmentId: selectedDev?.id, // ADD: Development ID for fetching terms
    };
    setSelectedStandForReservation(standData);

    // Open unified reservation modal for all devices
    setIsReservationModalOpen(true);
  };

  const handleConfirmReservation = async (
    standId: string,
    reservationData: any,
  ) => {
    logger.info("Reservation confirmed", {
      module: "LandingPage",
      stand_id: standId,
      confirmed_at: new Date().toISOString(),
      reservation_data: reservationData,
    });

    // TODO: Implement actual reservation logic with database
    // For now, just log and show success
    alert(
      `Reservation confirmed for Stand ${standId}! Digital Ref: ${reservationData.digitalRef}`,
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-white overflow-x-hidden font-sans">
      {/* Scroll Progress Bar */}
      <ScrollProgress />
      
      {/* Premium White Header */}
      <Header
        primaryCTA="Reserve Your Stand"
        onPrimaryCTAClick={() => {
          const inventorySection = document.getElementById("inventory");
          inventorySection?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        navLinks={[
          { label: "Home", href: "/" },
          { label: "Developments", href: "#inventory" },
          { label: "How It Works", href: "#process-timeline" },
        ]}
      />

      {/* Error Banner */}
      {loadError && (
        <div className="fixed top-20 left-4 right-4 max-w-md z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
          <p className="text-sm font-semibold text-red-800">
            Error loading developments
          </p>
          <p className="text-xs text-red-700 mt-1">{loadError}</p>
          <button
            onClick={() => setLoadError(null)}
            className="text-xs text-red-600 hover:text-red-800 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sticky Mobile CTA */}
      {!selectedDev && !isReservationModalOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t border-gray-200 shadow-lg p-4">
          <button
            onClick={() => {
              const inventorySection = document.getElementById("inventory");
              inventorySection?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="w-full bg-fcGold text-white py-4 rounded-xl font-semibold text-base hover:bg-fcGold/90 focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 transition-all duration-150 ease-out flex items-center justify-center gap-2 shadow-sm hover:shadow-md min-h-[44px]"
          >
            <span>Reserve Your Stand</span>
            <ArrowRight size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area - THE PADDING HERE IS CRITICAL */}
      <main className="flex-1 pt-16 md:pt-20">
        {/* Hero Section - Premium Value Proposition with Image */}
        {!selectedDev && (
          <section className="relative isolate px-6 pt-14 lg:px-8 overflow-hidden bg-gradient-to-b from-fcGold/10 via-fcGold/5 to-transparent">
            {/* Background gradient uses existing `fcGold` theme color with reduced opacity */}
            {/* Subtle Background Blobs - Behind Image */}
            <div
              className="absolute inset-x-0 -top-40 -z-0 transform-gpu overflow-hidden blur-3xl sm:-top-80"
              aria-hidden="true"
            >
              <div
                className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-15 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
                style={{
                  clipPath:
                    'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                }}
              />
            </div>

            {/* Bottom Gradient Blob - Subtle */}
            <div
              className="absolute inset-x-0 top-[calc(100%-13rem)] -z-0 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
              aria-hidden="true"
            >
              <div
                className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-15 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
                style={{
                  clipPath:
                    'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                }}
              />
            </div>

            {/* Content Layer - Two Column on Desktop */}
            <div className="relative z-10 max-w-7xl mx-auto pt-20 md:pt-32 pb-16 md:pb-24">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left Column: Text & CTAs */}
                <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-left-4 duration-700">
                  {/* Hero Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-fcGold/10 border border-fcGold/20 rounded-full">
                    <ShieldCheck size={16} className="text-fcGold" />
                    <span className="text-xs font-bold text-fcGold uppercase tracking-widest">
                      Premium Property Platform
                    </span>
                  </div>

                  {/* Hero Headline */}
                  <div className="space-y-6">
                    <h1 className="text-4xl md:text-5xl lg:text-[52px] font-semibold text-fcSlate tracking-tight leading-[1.15] max-w-2xl">
                      Secure Your Future with
                      <span className="block text-fcGold mt-3">
                        Premium Land Investments
                      </span>
                    </h1>
                    <p className="text-base md:text-lg text-gray-600 leading-[1.7] font-normal max-w-xl">
                      Verified developments, transparent pricing, and secure
                      transactions. Reserve your stand with confidence.
                    </p>
                  </div>

                  {/* Primary CTA */}
                  <div className="flex flex-col sm:flex-row items-start gap-4 pt-6">
                    <button
                      onClick={() => {
                        const inventorySection =
                          document.getElementById("inventory");
                        inventorySection?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className="group relative px-8 py-4 bg-fcGold text-white font-semibold text-base rounded-xl hover:bg-fcGold/90 focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 transition-all duration-150 ease-out shadow-sm hover:shadow-md active:scale-[0.98] flex items-center gap-2 min-h-[44px]"
                    >
                      <span>View Available Stands</span>
                      <ArrowRight
                        size={20}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </button>
                    <button
                      onClick={() => {
                        const processSection =
                          document.getElementById("process-timeline");
                        processSection?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className="px-8 py-4 bg-white border border-gray-200 text-fcSlate font-semibold text-base rounded-xl hover:border-fcGold hover:text-fcGold focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2 transition-all duration-150 ease-out min-h-[44px]"
                    >
                      How It Works
                    </button>
                  </div>

                  {/* Trust Indicators */}
                  <div className="grid grid-cols-2 gap-6 pt-8 max-w-sm">
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-fcGold mb-2">
                        72h
                      </div>
                      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Exclusive Hold
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-fcGold mb-2">
                        100%
                      </div>
                      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Secure Payments
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-fcGold mb-2">
                        ✓
                      </div>
                      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Verified Developments
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl md:text-4xl font-black text-fcGold mb-2">
                        24/7
                      </div>
                      <div className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Support
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Hero Image */}
                <div className="relative animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
                  {/* Image Container with Aspect Ratio */}
                  <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] lg:aspect-[1/1] rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                    <Image
                      src="https://p95t08lhll.ufs.sh/f/I5VkKRpIwc8j6cHk9iebfHgyVdO1n3XA9vJzheM4ZYrUSEqw"
                      alt="Residential land development with planned stands and mature landscaping - Premium real estate investment opportunity"
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 50vw"
                      quality={85}
                    />
                    {/* Optional Subtle Overlay for Text Contrast (10% opacity) */}
                    <div
                      className="absolute inset-0 bg-black/5"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Decorative Ring Effect */}
                  <div
                    className="absolute -inset-4 rounded-2xl bg-gradient-to-tr from-fcGold/10 to-fcGold/5 -z-10 blur-xl"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Trust & Credibility Sections */}
        {!selectedDev && (
          <>
            {/* Why Trust Us Section */}
            <section className="relative z-10 px-4 md:px-6 lg:px-12 py-16 md:py-24 bg-white">
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 md:mb-16">
                  <h2 className="text-3xl md:text-[32px] font-semibold text-fcSlate mb-4 tracking-tight leading-[1.25]">
                    Why Trust Us
                  </h2>
                  <p className="text-base text-gray-600 max-w-2xl mx-auto leading-[1.6]">
                    Built for transparency, security, and your peace of mind
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out focus-within:ring-2 focus-within:ring-fcGold focus-within:ring-offset-2">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-6">
                      <Shield size={20} className="text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-fcSlate mb-3 leading-[1.3]">
                      Secure Transactions
                    </h3>
                    <p className="text-gray-600 leading-[1.6] text-base">
                      All payments are encrypted and processed through verified
                      banking channels. Your financial data is protected with
                      bank-level security.
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out focus-within:ring-2 focus-within:ring-fcGold focus-within:ring-offset-2">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mb-6">
                      <CheckCircle2 size={20} className="text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-fcSlate mb-3 leading-[1.3]">
                      Verified Developments
                    </h3>
                    <p className="text-gray-600 leading-[1.6] text-base">
                      Every development undergoes rigorous verification. We
                      verify legal status, title deeds, and development
                      approvals before listing.
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out focus-within:ring-2 focus-within:ring-fcGold focus-within:ring-offset-2">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-6">
                      <FileText size={20} className="text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-fcSlate mb-3 leading-[1.3]">
                      Transparent Pricing
                    </h3>
                    <p className="text-gray-600 leading-[1.6] text-base">
                      Complete fee breakdown with VAT, admin fees, and all
                      charges clearly displayed. No hidden costs, no surprises.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Process Timeline Section */}
            <section
              id="process-timeline"
              className="px-4 md:px-6 lg:px-12 py-16 md:py-24 bg-gray-50/50"
            >
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12 md:mb-16">
                  <h2 className="text-3xl md:text-[32px] font-semibold text-fcSlate mb-4 tracking-tight leading-[1.25]">
                    Simple Process
                  </h2>
                  <p className="text-base text-gray-600 max-w-2xl mx-auto leading-[1.6]">
                    From reservation to delivery in four clear steps
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
                  {[
                    {
                      step: "1",
                      title: "Reserve",
                      desc: "Select your stand and complete reservation",
                      icon: MapPin,
                    },
                    {
                      step: "2",
                      title: "Pay Deposit",
                      desc: "Secure your stand with deposit payment",
                      icon: ShieldCheck,
                    },
                    {
                      step: "3",
                      title: "Paperwork",
                      desc: "Complete legal documentation digitally",
                      icon: FileText,
                    },
                    {
                      step: "4",
                      title: "Delivery",
                      desc: "Receive title and take ownership",
                      icon: CheckCircle2,
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-150 ease-out text-center">
                        <div className="w-16 h-16 rounded-full bg-fcGold/10 flex items-center justify-center mx-auto mb-4">
                          <item.icon size={24} className="text-fcGold" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-fcGold text-white flex items-center justify-center mx-auto mb-4 font-semibold text-sm">
                          {item.step}
                        </div>
                        <h3 className="text-xl font-semibold text-fcSlate mb-2 leading-[1.3]">
                          {item.title}
                        </h3>
                        <p className="text-base text-gray-600 leading-[1.6]">
                          {item.desc}
                        </p>
                      </div>
                      {idx < 3 && (
                        <div
                          className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-fcGold/20 -translate-y-1/2 -z-10"
                          style={{ width: "calc(100% - 2rem)" }}
                        >
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-fcGold"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Secure Payments & Insurance Section */}
            <section className="px-4 md:px-6 lg:px-12 py-16 md:py-24 bg-white">
              <div className="max-w-7xl mx-auto">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 p-8 md:p-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                    <div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-6">
                        <Shield size={16} className="text-blue-600" />
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                          Bank-Level Security
                        </span>
                      </div>
                      <h2 className="text-3xl md:text-[32px] font-semibold text-fcSlate mb-4 tracking-tight leading-[1.25]">
                        Secure Payments & Protection
                      </h2>
                      <p className="text-base text-gray-700 mb-6 leading-[1.6]">
                        Your transactions are protected with industry-leading
                        security measures and compliance standards.
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            size={20}
                            className="text-blue-600 mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <p className="font-bold text-fcSlate text-sm">
                              Encrypted Payment Processing
                            </p>
                            <p className="text-xs text-gray-600">
                              All financial data encrypted in transit and at
                              rest
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            size={20}
                            className="text-blue-600 mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <p className="font-bold text-fcSlate text-sm">
                              Verified Banking Channels
                            </p>
                            <p className="text-xs text-gray-600">
                              Direct integration with verified financial
                              institutions
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            size={20}
                            className="text-blue-600 mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <p className="font-bold text-fcSlate text-sm">
                              72-Hour Hold Guarantee
                            </p>
                            <p className="text-xs text-gray-600">
                              Your stand is locked exclusively to you during
                              reservation
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
                      <h3 className="text-xl font-bold text-fcSlate mb-6">
                        Payment Options
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <span className="font-medium text-fcSlate">Cash</span>
                          <CheckCircle2 size={20} className="text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <span className="font-medium text-fcSlate">
                            Bank Transfer
                          </span>
                          <CheckCircle2 size={20} className="text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <span className="font-medium text-fcSlate">
                            Mobile Money
                          </span>
                          <CheckCircle2 size={20} className="text-green-600" />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <span className="font-medium text-fcSlate">
                            Installment Plans
                          </span>
                          <CheckCircle2 size={20} className="text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Inventory showcase */}
        <section
          id="inventory"
          className={`px-4 md:px-6 lg:px-12 py-16 md:py-32 bg-white border-y border-fcDivider ${selectedDev ? "pt-24 md:pt-40" : ""}`}
        >
          <div className="max-w-7xl mx-auto">
            {selectedDev ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12 md:space-y-16">
                <button
                  onClick={() => setSelectedDev(null)}
                  className="text-xs font-bold text-fcGold uppercase tracking-widest flex items-center space-x-2 hover:translate-x-[-4px] transition-transform font-sans"
                >
                  <span>&larr; Return to developments</span>
                </button>

                {/* HEADER: Development Name + Status */}
                <div className="border-b border-fcSlate/10 pb-8 md:pb-10">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-8">
                    <div className="space-y-3 min-w-0 flex-1">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${selectedDev?.phase === "READY_TO_BUILD"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${selectedDev?.phase === "READY_TO_BUILD" ? "bg-emerald-500" : "bg-amber-500"}`}
                        ></span>
                        {selectedDev?.phase === "READY_TO_BUILD"
                          ? "Ready to Build"
                          : "Servicing in Progress"}
                      </div>
                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-fcSlate tracking-tight">
                        {selectedDev?.name || "Development"}
                      </h2>
                      <div className="flex items-center gap-2 text-fcSlate/60">
                        <MapPin size={14} className="text-fcGold" />
                        <span className="text-sm font-medium">
                          {selectedDev?.locationName ||
                            (selectedDev as any)?.location ||
                            "Location"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 1: OVERVIEW - Full Width at Top */}
                <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-fcGold/10 rounded-lg">
                        <FileText size={18} className="text-fcGold" />
                      </div>
                      <h3 className="text-base font-semibold text-fcSlate">
                        Overview
                      </h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-[15px] md:text-base text-fcSlate/80 leading-relaxed">
                      {selectedDev?.overview ||
                        selectedDev?.description ||
                        "Overview coming soon. This development is currently being documented. Contact our team for more information."}
                    </p>
                  </div>
                  {/* Debug: Log missing fields (development only) */}
                  {process.env.NODE_ENV === "development" &&
                    (() => {
                      logger.debug("Development data", {
                        module: "LandingPage",
                        id: selectedDev?.id,
                        name: selectedDev?.name,
                        hasOverview: !!selectedDev?.overview,
                        hasDescription: !!selectedDev?.description,
                        hasFeatures:
                          Array.isArray((selectedDev as any)?.features) &&
                          (selectedDev as any).features.length > 0,
                        featuresCount:
                          (selectedDev as any)?.features?.length || 0,
                        pricePerSqm: (selectedDev as any)?.pricePerSqm,
                        imageUrls: selectedDev?.imageUrls,
                        phase: selectedDev?.phase,
                        hasGeoJSON:
                          !!(selectedDev as any)?.geoJsonData ||
                          !!(selectedDev as any)?.geometry,
                      });
                      return null;
                    })()}
                </div>

                {/* SECTION 2: IMAGE GALLERY - Full Width Below Overview */}
                <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-fcGold/10 rounded-lg">
                        <Camera size={18} className="text-fcGold" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-fcSlate">
                          Gallery
                        </h3>
                        <p className="text-xs text-fcSlate/50">
                          Development visuals & site photography
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <ImageGallery
                      images={selectedDev?.imageUrls || []}
                      developmentName={selectedDev?.name || "Development"}
                    />
                  </div>
                </div>

                {/* SECTION 3: MAP - Full Width, Enlarged (1920x1080 aspect on desktop) */}
                <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-fcGold/10 rounded-lg">
                        <MapPin size={18} className="text-fcGold" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-fcSlate">
                          Interactive Map
                        </h3>
                        <p className="text-xs text-fcSlate/50">
                          Select your preferred stand
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    {/* Map Container - Enlarged: Desktop 1920x1080 aspect, Mobile full-width */}
                    {(() => {
                      // Check for coordinates from multiple sources
                      const hasDirectCoords =
                        selectedDev?.latitude && selectedDev?.longitude;
                      const geoData = (selectedDev as any)?.geoJsonData;
                      const mapDisabled = Boolean(
                        (selectedDev as any)?.disableMapView ??
                        (selectedDev as any)?.disable_map_view ??
                        false,
                      );
                      const hasCenterCoords =
                        geoData?.center?.lat && geoData?.center?.lng;
                      const hasGeoFeatures = geoData?.features?.length > 0;
                      const hasValidCoords =
                        hasDirectCoords || hasCenterCoords || hasGeoFeatures;

                      // Debug log (development only)
                      if (process.env.NODE_ENV === "development") {
                        logger.debug("Map coords check", {
                          module: "LandingPage",
                          developmentId: selectedDev?.id,
                          developmentName: selectedDev?.name,
                          hasDirectCoords,
                          mapDisabled,
                          hasCenterCoords,
                          hasGeoFeatures,
                          hasValidCoords,
                          geoDataCenter: geoData?.center,
                          featureCount: geoData?.features?.length,
                        });
                      }

                      if (mapDisabled || !hasValidCoords) {
                        return (
                          <div className="w-full rounded-2xl border border-fcDivider bg-white overflow-hidden">
                            <div className="px-5 py-4 border-b border-fcDivider bg-gray-50">
                              <div className="flex items-center gap-3">
                                <MapPinOff size={18} className="text-gray-500" />
                                <div>
                                  <p className="text-sm font-semibold text-fcSlate">
                                    {mapDisabled
                                      ? "Map view disabled for this development"
                                      : "Map not available for this development"}
                                  </p>
                                  <p className="text-xs text-fcSlate/60">
                                    Showing stand table for manual stand numbering.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="p-4">
                              {standTableLoading ? (
                                <div className="py-8 text-center text-fcSlate/60 text-sm">
                                  Loading stands...
                                </div>
                              ) : standTableRows.length === 0 ? (
                                <div className="py-8 text-center text-fcSlate/60 text-sm">
                                  No stands found for this development.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left border-b border-fcDivider">
                                        <th className="py-2 px-2 font-semibold text-fcSlate">Stand</th>
                                        <th className="py-2 px-2 font-semibold text-fcSlate">Size</th>
                                        <th className="py-2 px-2 font-semibold text-fcSlate">Price</th>
                                        <th className="py-2 px-2 font-semibold text-fcSlate">Status</th>
                                        <th className="py-2 px-2 font-semibold text-fcSlate text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {standTableRows.slice(0, 100).map((stand) => {
                                        const isAvailable = stand.status === "available";
                                        return (
                                          <tr key={stand.id} className="border-b border-fcDivider/70">
                                            <td className="py-2 px-2 text-fcSlate font-medium">
                                              {stand.standNumber}
                                            </td>
                                            <td className="py-2 px-2 text-fcSlate/80">
                                              {stand.size || "-"}
                                            </td>
                                            <td className="py-2 px-2 text-fcSlate/80">
                                              {typeof stand.price === "number"
                                                ? `$${stand.price.toLocaleString()}`
                                                : "-"}
                                            </td>
                                            <td className="py-2 px-2">
                                              <span
                                                className={`inline-flex px-2 py-1 rounded text-xs font-semibold uppercase ${isAvailable
                                                  ? "bg-emerald-50 text-emerald-700"
                                                  : stand.status === "reserved"
                                                    ? "bg-amber-50 text-amber-700"
                                                    : "bg-gray-100 text-gray-600"
                                                  }`}
                                              >
                                                {stand.status || "unknown"}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                              <button
                                                onClick={() =>
                                                  handleReserve(
                                                    stand.id,
                                                    stand.standNumber,
                                                    stand.price,
                                                    stand.size,
                                                  )
                                                }
                                                disabled={!isAvailable}
                                                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${isAvailable
                                                  ? "bg-fcGold text-white hover:bg-fcGold/90"
                                                  : "bg-gray-100 text-gray-500 cursor-not-allowed"
                                                  }`}
                                              >
                                                Reserve
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Pass development with geoJsonData so PlotSelectorMap can extract center
                      const devWithGeoData = {
                        ...selectedDev,
                        // Ensure geoJsonData is available in camelCase
                        geoJsonData: geoData,
                        // Extract latitude/longitude from center if not present directly
                        latitude: selectedDev?.latitude || geoData?.center?.lat,
                        longitude:
                          selectedDev?.longitude || geoData?.center?.lng,
                      };

                      return (
                        <div
                          className="overflow-hidden rounded-xl w-full"
                          style={{
                            aspectRatio: "16 / 9",
                            maxHeight: "70vh",
                            minHeight: "350px",
                          }}
                        >
                          <PlotSelectorMap
                            development={devWithGeoData as any}
                            onReserve={handleReserve}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* SECTION 4: SPLIT VIEW - Features + Pricing */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-16">
                  {/* Left Column: Features & Investment Highlights */}
                  <div className="col-span-1 lg:col-span-7 space-y-8 md:space-y-12">
                    {/* Investment Highlights Section - Hidden if empty */}
                    {selectedDev?.investmentHighlights &&
                      (selectedDev.installmentPeriods?.length ?? 0) > 0 && (
                        <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                          <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-fcGold/10 rounded-lg">
                                <Check size={18} className="text-fcGold" />
                              </div>
                              <h3 className="text-base font-semibold text-fcSlate">
                                Key Highlights
                              </h3>
                            </div>
                          </div>
                          <div className="p-6">
                            <div className="flex flex-wrap gap-2">
                              {selectedDev?.investmentHighlights?.map(
                                (highlight, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-fcSlate/[0.03] rounded-lg text-sm font-medium text-fcSlate border border-fcSlate/10 hover:border-fcGold/30 hover:bg-fcGold/5 transition-colors"
                                  >
                                    <CheckCircle2
                                      size={14}
                                      className="text-fcGold"
                                    />
                                    {highlight}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Infrastructure Status Module */}
                    <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                      <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-fcGold/10 rounded-lg">
                            <Zap size={18} className="text-fcGold" />
                          </div>
                          <h3 className="text-base font-semibold text-fcSlate">
                            Infrastructure Status
                          </h3>
                        </div>
                      </div>
                      <div className="p-6">
                        {/* Infrastructure Status Grid */}
                        {(() => {
                          const estateProgress = (selectedDev as any)
                            ?.estateProgress;
                          const infraItems = [
                            { key: "roads", label: "Roads", icon: Route },
                            { key: "water", label: "Water", icon: Droplets },
                            { key: "sewer", label: "Sewer", icon: Waves },
                            {
                              key: "electricity",
                              label: "Electricity",
                              icon: Zap,
                            },
                          ];

                          const statusConfig: Record<
                            string,
                            { color: string; bg: string; label: string }
                          > = {
                            not_started: {
                              color: "text-gray-500",
                              bg: "bg-gray-100",
                              label: "Pending",
                            },
                            planned: {
                              color: "text-blue-600",
                              bg: "bg-blue-50",
                              label: "Planned",
                            },
                            in_progress: {
                              color: "text-amber-600",
                              bg: "bg-amber-50",
                              label: "In Progress",
                            },
                            completed: {
                              color: "text-emerald-600",
                              bg: "bg-emerald-50",
                              label: "Complete",
                            },
                            pending: {
                              color: "text-gray-500",
                              bg: "bg-gray-100",
                              label: "Pending",
                            },
                            submitted: {
                              color: "text-blue-600",
                              bg: "bg-blue-50",
                              label: "Submitted",
                            },
                            approved: {
                              color: "text-emerald-600",
                              bg: "bg-emerald-50",
                              label: "Approved",
                            },
                            rejected: {
                              color: "text-red-600",
                              bg: "bg-red-50",
                              label: "Rejected",
                            },
                          };

                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                {infraItems.map((item) => {
                                  const status =
                                    estateProgress?.[item.key] || "not_started";
                                  const config =
                                    statusConfig[status] ||
                                    statusConfig["not_started"];
                                  const Icon = item.icon;
                                  return (
                                    <div
                                      key={item.key}
                                      className="flex items-center justify-between p-3 bg-fcSlate/[0.02] rounded-xl border border-fcSlate/5"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Icon
                                          size={16}
                                          className="text-fcSlate/40"
                                        />
                                        <span className="text-sm font-medium text-fcSlate">
                                          {item.label}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.color}`}
                                      >
                                        {config.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Compliance Status */}
                              {estateProgress?.compliance && (
                                <div className="flex items-center justify-between p-3 bg-fcSlate/[0.02] rounded-xl border border-fcSlate/5">
                                  <div className="flex items-center gap-3">
                                    <ShieldCheck
                                      size={16}
                                      className="text-fcSlate/40"
                                    />
                                    <span className="text-sm font-medium text-fcSlate">
                                      Compliance
                                    </span>
                                  </div>
                                  <span
                                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${(statusConfig[estateProgress.compliance] || statusConfig["pending"]).bg} ${(statusConfig[estateProgress.compliance] || statusConfig["pending"]).color}`}
                                  >
                                    {
                                      (
                                        statusConfig[
                                        estateProgress.compliance
                                        ] || statusConfig["pending"]
                                      ).label
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Features Module */}
                    <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                      <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-fcGold/10 rounded-lg">
                            <Shield size={18} className="text-fcGold" />
                          </div>
                          <h3 className="text-base font-semibold text-fcSlate">
                            Features & Amenities
                          </h3>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-2 gap-3">
                          {(() => {
                            const features = Array.isArray(
                              (selectedDev as any)?.features,
                            )
                              ? (selectedDev as any).features
                              : [];
                            if (features.length > 0) {
                              return features
                                .slice(0, 8)
                                .map((feat: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-3 bg-fcSlate/[0.02] rounded-xl border border-fcSlate/5"
                                  >
                                    <CheckCircle2
                                      size={16}
                                      className="text-fcGold shrink-0"
                                    />
                                    <span className="text-sm font-medium text-fcSlate">
                                      {feat}
                                    </span>
                                  </div>
                                ));
                            }
                            return [
                              { icon: Shield, label: "Security" },
                              { icon: Wifi, label: "Connectivity" },
                              { icon: Landmark, label: "Legal Pool" },
                              { icon: Sun, label: "Amenities" },
                            ].map((feat, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 p-3 bg-fcSlate/[0.02] rounded-xl border border-fcSlate/5"
                              >
                                <feat.icon
                                  size={16}
                                  className="text-fcGold shrink-0"
                                />
                                <span className="text-sm font-medium text-fcSlate">
                                  {feat.label}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Development Documents */}
                    <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden">
                      <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate/[0.02]">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-fcGold/10 rounded-lg">
                            <FileText size={18} className="text-fcGold" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-fcSlate">
                              Development Documents
                            </h3>
                            <p className="text-xs text-fcSlate/50">
                              Statutory documents & approvals
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 space-y-3">
                        {(() => {
                          const docs = selectedDev.documentUrls || [];
                          // Handle both string arrays and object arrays
                          const documentList =
                            Array.isArray(docs) && docs.length > 0
                              ? docs.map((doc: any, idx: number) => {
                                // If it's a string, create a simple object
                                if (typeof doc === "string") {
                                  return {
                                    id: `doc-${idx}`,
                                    name:
                                      doc.split("/").pop() ||
                                      `Document ${idx + 1}`,
                                    url: doc,
                                    uploadedAt: new Date().toISOString(),
                                  };
                                }
                                // If it's already an object, use it as-is
                                return {
                                  id: doc.id || `doc-${idx}`,
                                  name:
                                    doc.name ||
                                    doc.url?.split("/").pop() ||
                                    `Document ${idx + 1}`,
                                  url: doc.url || doc,
                                  uploadedAt:
                                    doc.uploadedAt ||
                                    doc.createdAt ||
                                    new Date().toISOString(),
                                };
                              })
                              : [];

                          return documentList.length > 0 ? (
                            documentList.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-4 bg-fcSlate/[0.02] rounded-xl border border-fcSlate/5 hover:border-fcGold/20 transition-colors group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="p-2.5 bg-white rounded-lg border border-fcSlate/10 group-hover:border-fcGold/20 transition-colors">
                                    <FileText
                                      size={18}
                                      className="text-fcGold"
                                    />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-fcSlate">
                                      {doc.name}
                                    </h4>
                                    <p className="text-xs text-fcSlate/50">
                                      {new Date(
                                        doc.uploadedAt,
                                      ).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-fcSlate/40 hover:text-fcGold hover:bg-fcGold/10 rounded-lg transition-colors"
                                >
                                  <Download size={18} />
                                </a>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-fcSlate/40">
                              <FileText
                                size={32}
                                className="mx-auto mb-2 opacity-50"
                              />
                              <p className="text-sm">
                                No documents available yet
                              </p>
                            </div>
                          );
                        })()}

                        {/* Optional Insurance Card */}
                        <div className="flex items-center justify-between p-4 bg-fcGold/5 rounded-xl border border-fcGold/20 hover:border-fcGold/30 transition-colors group">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-2.5 bg-white rounded-lg border border-fcGold/20 group-hover:border-fcGold/30 transition-colors">
                              <ShieldCheck size={18} className="text-fcGold" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-fcSlate">
                                  Optional Insurance (Old Mutual)
                                </h4>
                                <span className="px-2 py-0.5 text-[10px] font-semibold text-fcGold bg-fcGold/10 rounded-full uppercase tracking-wider">
                                  Optional
                                </span>
                              </div>
                              <p className="text-xs text-fcSlate/50">
                                Enquire for more information
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              const standNumber =
                                (selectedDev as any)?.selectedStand
                                  ?.standNumber || null;
                              const developmentName =
                                selectedDev?.name || "Development";
                              const message = `Hi, I would like more information about the optional Old Mutual insurance for ${developmentName}${standNumber ? ` / Stand ${standNumber}` : ""}.`;

                              try {
                                const response = await fetch("/api/enquiries", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    category: "Insurance - Old Mutual",
                                    message,
                                    developmentId: selectedDev?.id,
                                    standId:
                                      (selectedDev as any)?.selectedStand?.id ||
                                      null,
                                    standNumber,
                                    developmentName,
                                  }),
                                });

                                if (response.ok) {
                                  alert(
                                    "Thank you! We will contact you with more information about Old Mutual insurance.",
                                  );
                                } else {
                                  // Fallback: Open WhatsApp or email
                                  const whatsappPhone = "2638644253731";
                                  const whatsappMessage =
                                    encodeURIComponent(message);
                                  window.open(
                                    `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`,
                                    "_blank",
                                  );
                                }
                              } catch (error) {
                                // Fallback: Open WhatsApp
                                const whatsappPhone = "2638644253731";
                                const whatsappMessage =
                                  encodeURIComponent(message);
                                window.open(
                                  `https://wa.me/${whatsappPhone}?text=${whatsappMessage}`,
                                  "_blank",
                                );
                              }
                            }}
                            className="px-4 py-2 bg-fcGold text-white rounded-lg text-sm font-semibold hover:bg-fcGold/90 transition-colors whitespace-nowrap"
                          >
                            Enquire
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Pricing CTA - Sticky on Desktop */}
                  <div className="col-span-1 lg:col-span-5">
                    {/* Pricing Card */}
                    <div className="bg-white rounded-2xl border border-fcSlate/10 overflow-hidden lg:sticky lg:top-24">
                      <div className="px-6 py-4 border-b border-fcSlate/10 bg-fcSlate text-white">
                        <h3 className="text-base font-semibold">
                          Investment Summary
                        </h3>
                      </div>
                      <div className="p-6 space-y-6">
                        {/* Price Per SQM */}
                        {(() => {
                          const pricePerSqm = (selectedDev as any)
                            ?.pricePerSqm;
                          const totalArea = (selectedDev as any)
                            ?.totalAreaSqm;
                          // Safe parsing for basePrice
                          const basePrice =
                            typeof selectedDev?.basePrice === "number"
                              ? selectedDev.basePrice
                              : typeof (selectedDev as any)?.basePrice ===
                                "string"
                                ? parseFloat((selectedDev as any).basePrice) ||
                                0
                                : 0;

                          let displayPricePerSqm: number | null = null;
                          // Safe parsing for pricePerSqm
                          if (
                            pricePerSqm &&
                            typeof pricePerSqm === "number" &&
                            pricePerSqm > 0
                          ) {
                            displayPricePerSqm = pricePerSqm;
                          } else if (typeof pricePerSqm === "string") {
                            const parsed = parseFloat(pricePerSqm);
                            if (!isNaN(parsed) && parsed > 0)
                              displayPricePerSqm = parsed;
                          } else if (basePrice > 0 && totalArea) {
                            // Safe parsing for totalArea
                            const areaNum =
                              typeof totalArea === "number"
                                ? totalArea
                                : typeof totalArea === "string"
                                  ? parseFloat(totalArea) || 0
                                  : 0;
                            if (areaNum > 0) {
                              displayPricePerSqm = basePrice / areaNum;
                            }
                          }

                          return (
                            <div className="p-4 bg-fcGold/5 rounded-xl border border-fcGold/10">
                              <div className="text-xs font-medium text-fcSlate/60 mb-1">
                                Price per Square Metre
                              </div>
                              <div className="text-2xl font-bold text-fcSlate">
                                {displayPricePerSqm ? (
                                  <>
                                    USD $
                                    {displayPricePerSqm.toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}
                                    /mÂ²
                                  </>
                                ) : (
                                  <span className="text-lg text-fcSlate/50">
                                    Price on application
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const areaNum =
                                  typeof totalArea === "number"
                                    ? totalArea
                                    : typeof totalArea === "string"
                                      ? parseFloat(totalArea) || 0
                                      : 0;
                                return areaNum > 0 ? (
                                  <div className="text-xs text-fcSlate/50 mt-1">
                                    Total area: {areaNum.toLocaleString()} mÂ²
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          );
                        })()}

                        {/* Total Price */}
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-fcSlate/60">
                            Starting From
                          </div>
                          <div className="text-3xl font-bold text-fcSlate">
                            USD ${calculateTotal(selectedDev).toLocaleString()}
                          </div>
                        </div>

                        {/* Fee Breakdown */}
                        {(() => {
                          const fees = calculateFeeBreakdown(selectedDev);
                          const hasAnyFees =
                            fees.vatEnabled ||
                            fees.endowmentEnabled ||
                            fees.aosEnabled ||
                            fees.cessionsEnabled ||
                            fees.adminFeeEnabled;

                          if (!hasAnyFees) {
                            return (
                              <div className="text-xs text-fcSlate/50">
                                Base price only
                              </div>
                            );
                          }

                          return (
                            <div className="bg-fcSlate/5 rounded-xl p-4 space-y-2">
                              <div className="text-xs font-semibold text-fcSlate/70 mb-2">
                                Price Breakdown
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-fcSlate/60">
                                  Base Price
                                </span>
                                <span className="font-medium text-fcSlate">
                                  ${fees.basePrice.toLocaleString()}
                                </span>
                              </div>
                              {fees.vatEnabled && fees.vatAmount > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-fcSlate/60">
                                    VAT ({fees.vatPercentage}%) on subtotal
                                  </span>
                                  <span className="text-emerald-600">
                                    +$
                                    {fees.vatAmount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              )}
                              {fees.endowmentEnabled &&
                                fees.endowmentFee > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-fcSlate/60">
                                      Endowment Fee
                                    </span>
                                    <span className="text-blue-600">
                                      +${fees.endowmentFee.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              {fees.aosEnabled && fees.aosFee > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-fcSlate/60">
                                    Agreement of Sale Fee
                                  </span>
                                  <span className="text-purple-600">
                                    +${fees.aosFee.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {fees.cessionsEnabled && fees.cessionFee > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-fcSlate/60">
                                    Cession Fee
                                  </span>
                                  <span className="text-orange-600">
                                    +${fees.cessionFee.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {fees.adminFeeEnabled && fees.adminFee > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-fcSlate/60">
                                    Admin Fee
                                  </span>
                                  <span className="text-fcGold">
                                    +${fees.adminFee.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              <div className="border-t border-fcSlate/10 pt-2 mt-2">
                                <div className="flex justify-between font-semibold text-sm">
                                  <span className="text-fcSlate">Total</span>
                                  <span className="text-fcGold">
                                    $
                                    {calculateTotal(
                                      selectedDev,
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Payment Plan Calculator */}
                        {(() => {
                          const totalPrice = calculateTotal(selectedDev);
                          // Handle installment_periods - could be array, JSONB string, or undefined
                          let installmentPeriods: number[] = [12, 24, 48];
                          if (selectedDev.installmentPeriods) {
                            if (
                              Array.isArray(selectedDev.installmentPeriods)
                            ) {
                              installmentPeriods =
                                selectedDev.installmentPeriods.filter(
                                  (p: any) => typeof p === "number" && p > 0,
                                );
                            } else if (
                              typeof selectedDev.installmentPeriods ===
                              "string"
                            ) {
                              try {
                                const parsed = JSON.parse(
                                  selectedDev.installmentPeriods,
                                );
                                if (Array.isArray(parsed)) {
                                  installmentPeriods = parsed.filter(
                                    (p: any) => typeof p === "number" && p > 0,
                                  );
                                }
                              } catch (e) {
                                // Invalid JSON, use default
                              }
                            }
                          }
                          if (installmentPeriods.length === 0) {
                            installmentPeriods = [12, 24, 48];
                          }
                          const depositPercentage =
                            typeof selectedDev.depositPercentage === "number"
                              ? selectedDev.depositPercentage
                              : typeof (selectedDev as any)
                                ?.depositPercentage === "string"
                                ? parseFloat(
                                  (selectedDev as any).depositPercentage,
                                ) || 10
                                : 10;
                          const depositAmount =
                            totalPrice * (depositPercentage / 100);
                          const balance = totalPrice - depositAmount;

                          return (
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 space-y-3 border border-indigo-100">
                              <div className="flex items-center gap-2">
                                <Calendar
                                  size={16}
                                  className="text-indigo-600"
                                />
                                <span className="text-xs font-semibold text-indigo-800">
                                  Flexible Payment Plans
                                </span>
                              </div>

                              <div className="bg-white/70 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-fcSlate/60">
                                    Deposit ({depositPercentage}%)
                                  </span>
                                  <span className="font-semibold text-indigo-600">
                                    $
                                    {depositAmount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-fcSlate/60">
                                    Balance after deposit
                                  </span>
                                  <span className="font-medium text-fcSlate">
                                    $
                                    {balance.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs font-medium text-fcSlate/70 mb-1">
                                Monthly payment options:
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {installmentPeriods
                                  .slice(0, 3)
                                  .map((months: number) => {
                                    const monthly = balance / months;
                                    return (
                                      <div
                                        key={months}
                                        className="bg-white rounded-lg p-2 text-center border border-indigo-100 hover:border-indigo-300 transition-colors"
                                      >
                                        <div className="text-xs text-fcSlate/60">
                                          {months} mo
                                        </div>
                                        <div className="text-sm font-bold text-indigo-600">
                                          $
                                          {monthly.toLocaleString(undefined, {
                                            maximumFractionDigits: 0,
                                          })}
                                        </div>
                                        <div className="text-[10px] text-fcSlate/50">
                                          /month
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>

                              {installmentPeriods.length > 3 && (
                                <div className="text-[10px] text-center text-fcSlate/50">
                                  Also available:{" "}
                                  {installmentPeriods
                                    .slice(3)
                                    .map((m: number) => `${m} mo`)
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Reserve Button */}
                        <button
                          onClick={() => handleReserve("reserve-cta")}
                          className="w-full bg-fcGold text-white py-4 rounded-xl font-semibold text-sm hover:bg-fcGold/90 transition-colors flex items-center justify-center gap-3"
                        >
                          <span>Reserve a Stand</span>
                          <ArrowRight size={18} />
                        </button>

                        <div className="flex items-center justify-center gap-2 text-xs text-fcSlate/50">
                          <ShieldCheck size={14} className="text-fcGold" />
                          <span>72-hour hold guarantee</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Manifest header */}
                <div className="flex flex-col space-y-6 mb-12">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-8 gap-6">
                    {/* Featured Developments Section */}
                    {filteredFeaturedDevelopments.length > 0 && phaseFilter === "ALL" && !selectedDev && (
                      <div className="mb-20">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="p-2 bg-fcGold/10 rounded-full">
                            <TrendingUp className="text-fcGold" size={18} />
                          </div>
                          <div>
                            <h2 className="text-xs font-bold text-fcGold uppercase tracking-widest leading-none mb-1">
                              Don't Miss Out
                            </h2>
                            <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                              Featured Opportunities
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {filteredFeaturedDevelopments.map((dev, i) => (
                            <DevelopmentCard
                              key={`featured-${dev.id}`}
                              development={dev}
                              onCardClick={handleDevClick}
                              onFavorite={() => { }}
                              isFavorited={false}
                              index={i}
                              lazy={false}
                            />
                          ))}
                        </div>

                        {/* Divider */}
                        <div className="mt-16 border-t border-gray-100"></div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-fcGold">
                        Our Portfolio
                      </p>
                      <h2 className="text-3xl font-bold text-gray-900">
                        Developments
                      </h2>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto">
                      {(["ALL", "SERVICING", "READY_TO_BUILD"] as const).map(
                        (p) => (
                          <button
                            key={p}
                            onClick={() => setPhaseFilter(p)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${phaseFilter === p
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                              }`}
                          >
                            {p === "ALL"
                              ? "All"
                              : p === "SERVICING"
                                ? "Servicing"
                                : "Ready"}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDevelopments.length > 0 ? (
                    filteredDevelopments.map((dev, i) => (
                      <DevelopmentCard
                        key={dev.id}
                        development={dev}
                        onCardClick={handleDevClick}
                        onFavorite={() =>
                          logger.debug("Favorited development", {
                            module: "LandingPage",
                            devId: dev.id,
                          })
                        }
                        isFavorited={false}
                        index={i}
                        lazy={i > 2}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center">
                      <Building2
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p className="text-gray-500">
                        No developments available for the selected filter.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Premium Minimal Footer */}
      <Footer onLegalPageClick={(type) => setActiveLegalPage(type)} />

      {/* Legal pages */}
      {activeLegalPage && (
        <LegalPages
          type={activeLegalPage}
          onClose={() => setActiveLegalPage(null)}
        />
      )}

      {/* Unified Reservation Flow Modal */}
      {isReservationModalOpen && selectedStandForReservation && (
        <ReservationFlowModal
          selectedStand={selectedStandForReservation}
          agents={agents}
          onConfirm={handleConfirmReservation}
          onClose={() => {
            setIsReservationModalOpen(false);
            setSelectedStandForReservation(null);
            setSelectedStandIdFromMap(null);
          }}
        />
      )}
    </div>
  );
};
