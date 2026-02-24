/**
 * Custom hook for LandingPage data fetching and state management
 * Source of truth: LandingPage.tsx
 */

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLogo } from "@/contexts/LogoContext";
import { cachedFetch } from "@/lib/api-cache";
import { DEFAULT_LOGO } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { Agent, Development, DevelopmentPhase } from "../../../types";

export function useLandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { logoUrl } = useLogo();
  const effectiveLogo = logoUrl || DEFAULT_LOGO;
  const isDefaultLogo =
    effectiveLogo === DEFAULT_LOGO || effectiveLogo.startsWith("/logos/");

  // State management
  const [developments, setDevelopments] = useState<Development[]>([]);
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

  // Error state for debugging
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch developments and agents
  useEffect(() => {
    // Fetch developments from API with caching
    cachedFetch<any>("/api/admin/developments")
      .then((response) => {
        // Handle API response format: { success: true, data: { data: [...], developments: [...] } }
        let devs: Development[] = [];

        // Check if response has success flag and nested data structure
        if (response?.success === true && response?.data) {
          const dataObj = response.data;

          // Case 1: data.data is an array (most common)
          if (Array.isArray(dataObj.data)) {
            devs = dataObj.data;
          }
          // Case 2: data.developments is an array
          else if (Array.isArray(dataObj.developments)) {
            devs = dataObj.developments;
          }
          // Case 3: data is directly an array (legacy format)
          else if (Array.isArray(dataObj)) {
            devs = dataObj;
          }
          // Case 4: Check for error
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

        // Show all developments regardless of status - filter will be applied in UI if needed
        const validDevs = Array.isArray(devs)
          ? devs.map((dev: any) => {
              // Normalize data structure - ensure all fields are properly typed

              // Parse standSizes from JSON (stored as JSONB in database)
              let parsedStandSizes = null;
              try {
                if (dev.standSizes) {
                  parsedStandSizes =
                    typeof dev.standSizes === "string"
                      ? JSON.parse(dev.standSizes)
                      : dev.standSizes;
                }
              } catch (e) {
                // Silently handle parse errors
              }

              // Parse standTypes (stored as TEXT[] in database)
              let parsedStandTypes: string[] = [];
              try {
                if (dev.standTypes) {
                  parsedStandTypes = Array.isArray(dev.standTypes)
                    ? dev.standTypes
                    : typeof dev.standTypes === "string"
                      ? JSON.parse(dev.standTypes)
                      : [];
                }
              } catch (e) {
                // Silently handle parse errors
              }

              return {
                ...dev,
                // Ensure locationName exists (fallback to location)
                locationName: dev.locationName || dev.location || "Location",
                // Ensure documentUrls is always an array
                documentUrls: Array.isArray(dev.documentUrls)
                  ? dev.documentUrls
                  : [],
                // Ensure imageUrls is always an array
                imageUrls: Array.isArray(dev.imageUrls) ? dev.imageUrls : [],
                // Ensure features is always an array
                features: Array.isArray(dev.features) ? dev.features : [],
                // Ensure standSizes is parsed correctly
                standSizes: parsedStandSizes,
                // Ensure standTypes is always an array
                standTypes: parsedStandTypes,
                // Ensure installmentPeriods is properly parsed
                installmentPeriods: (() => {
                  if (Array.isArray(dev.installmentPeriods)) {
                    return dev.installmentPeriods.filter(
                      (p: any) => typeof p === "number" && p > 0,
                    );
                  }
                  if (typeof dev.installmentPeriods === "string") {
                    try {
                      const parsed = JSON.parse(dev.installmentPeriods);
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
                  typeof dev.basePrice === "number"
                    ? dev.basePrice
                    : parseFloat(String(dev.basePrice || 0)) || 0,
                vatPercentage:
                  typeof dev.vatPercentage === "number"
                    ? dev.vatPercentage
                    : parseFloat(String(dev.vatPercentage || 15.5)) || 15.5,
                endowmentFee:
                  typeof dev.endowmentFee === "number"
                    ? dev.endowmentFee
                    : parseFloat(String(dev.endowmentFee || 0)) || 0,
                depositPercentage:
                  typeof dev.depositPercentage === "number"
                    ? dev.depositPercentage
                    : parseFloat(String(dev.depositPercentage || 10)) || 10,
                // Ensure boolean fields are booleans
                vatEnabled:
                  typeof dev.vatEnabled === "boolean"
                    ? dev.vatEnabled
                    : dev.vatEnabled !== undefined
                      ? Boolean(dev.vatEnabled)
                      : true,
                endowmentEnabled:
                  typeof dev.endowmentEnabled === "boolean"
                    ? dev.endowmentEnabled
                    : dev.endowmentEnabled !== undefined
                      ? Boolean(dev.endowment_enabled)
                      : true,
                aosEnabled:
                  typeof dev.aosEnabled === "boolean"
                    ? dev.aosEnabled
                    : dev.aosEnabled !== undefined
                      ? Boolean(dev.aosEnabled)
                      : false,
                cessionsEnabled:
                  typeof dev.cessionsEnabled === "boolean"
                    ? dev.cessionsEnabled
                    : dev.cessionsEnabled !== undefined
                      ? Boolean(dev.cessionsEnabled)
                      : false,
              };
            })
          : [];

        logger.debug("Displaying developments", {
          module: "LandingPage",
          total: validDevs.length,
        });
        setDevelopments(validDevs);
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

  // MODAL EVENT LISTENER - Listen for map stand selection events
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
        developmentId: selectedDev?.id,
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

  // ALTERNATIVE EVENT LISTENER - Also listen for open-access-modal event (backup)
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
        developmentId: selectedDev?.id,
      };
      setSelectedStandForReservation(standData);

      // FORENSIC LEAD CAPTURE: Log the intent immediately in Neon
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

  // Filter developments by phase
  const filteredDevelopments = useMemo(() => {
    if (!Array.isArray(developments)) return [];
    return developments.filter(
      (d) => d && (phaseFilter === "ALL" || d.phase === phaseFilter),
    );
  }, [developments, phaseFilter]);

  // Handlers
  const handleDevClick = (dev: Development) => {
    setSelectedDev(dev);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToDevelopments = () => {
    setSelectedDev(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const handleReserve = (standId: string) => {
    logger.info("Reserve intent", {
      module: "LandingPage",
      standId: standId,
      development: selectedDev?.name,
      timestamp: new Date().toISOString(),
    });

    // Prepare stand data for unified modal
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
      developmentId: selectedDev?.id,
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
      standId: standId,
      confirmedAt: new Date().toISOString(),
      reservationData: reservationData,
    });

    // TODO: Implement actual reservation logic with database
    // For now, just log and show success
    alert(
      `Reservation confirmed for Stand ${standId}! Digital Ref: ${reservationData.digitalRef}`,
    );
  };

  const closeReservationModal = () => {
    setIsReservationModalOpen(false);
    setSelectedStandForReservation(null);
    setSelectedStandIdFromMap(null);
  };

  // Calculate total price for a development
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
        : (dev as any)?.adminFeeEnabled !== undefined
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
        : (dev as any)?.adminFeeEnabled !== undefined
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

  return {
    // Session and logo
    session,
    status,
    effectiveLogo,
    isDefaultLogo,

    // Developments
    developments,
    filteredDevelopments,
    selectedDev,
    setSelectedDev,
    phaseFilter,
    setPhaseFilter,
    loadError,
    setLoadError,

    // Legal pages
    activeLegalPage,
    setActiveLegalPage,

    // Reservation modal
    isReservationModalOpen,
    setIsReservationModalOpen,
    selectedStandForReservation,
    setSelectedStandForReservation,
    selectedStandIdFromMap,
    agents,

    // Handlers
    handleDevClick,
    handleBackToDevelopments,
    handleLoginClick,
    handleReserve,
    handleConfirmReservation,
    closeReservationModal,

    // Calculations
    calculateTotal,
    calculateFeeBreakdown,
  };
}
