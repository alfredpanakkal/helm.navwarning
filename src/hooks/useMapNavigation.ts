import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import {
  formatNauticalCoordinates,
  formatDecimalCoordinates,
  parseCoordinatesFlexible,
  copyToClipboard,
  CoordinateParseResult,
} from '../utils/coordinateConversion';
import { NavWarning } from '../types';

export interface CursorCoordinateState {
  /** Nautical DMM notation: "DD-MM.MM'N DDD-MM.MM'E" */
  nauticalString: string;
  /** Raw decimal coordinates: [lat, lng] */
  rawDecimal: [number, number] | null;
  /** True if pointer is actively moving inside the map bounds */
  isActive: boolean;
  /** True momentarily after cursor position has been copied to clipboard */
  hasCopied: boolean;
}

export interface MapContextMenuState {
  isOpen: boolean;
  pixelPosition: { x: number; y: number };
  latLng: [number, number];
  nauticalCoordinates: string;
  targetWarning: NavWarning | null;
}

export interface UseMapNavigationOptions {
  /** Minimum zoom level to jump to when centering from far out (default: 8) */
  defaultFocusZoom?: number;
  /** Clipboard copied notification duration in ms (default: 2000) */
  copyResetDuration?: number;
}

export function useMapNavigation(
  map: L.Map | null,
  options: UseMapNavigationOptions = {}
) {
  const { defaultFocusZoom = 8, copyResetDuration = 2000 } = options;

  // 1. Real-Time Cursor Tracking State
  const [cursorState, setCursorState] = useState<CursorCoordinateState>({
    nauticalString: '',
    rawDecimal: null,
    isActive: false,
    hasCopied: false,
  });

  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Bind mousemove and mouseout on the Leaflet map container
  useEffect(() => {
    if (!map) return;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Normalize longitude within -180..180 for display
      const normalizedLng = L.Util.wrapNum(lng, [-180, 180]);
      const nautical = formatNauticalCoordinates(lat, normalizedLng);

      setCursorState((prev) => ({
        ...prev,
        nauticalString: nautical,
        rawDecimal: [Number(lat.toFixed(6)), Number(normalizedLng.toFixed(6))],
        isActive: true,
      }));
    };

    const handleMouseOut = () => {
      setCursorState((prev) => ({
        ...prev,
        isActive: false,
      }));
    };

    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);

    const container = map.getContainer();
    const handleDomMouseLeave = () => {
      setCursorState((prev) => ({
        ...prev,
        isActive: false,
      }));
    };
    container.addEventListener('mouseleave', handleDomMouseLeave);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      container.removeEventListener('mouseleave', handleDomMouseLeave);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, [map]);

  /**
   * Clipboard Action: copies the active cursor position string to clipboard
   */
  const copyCursorPosition = useCallback(async (): Promise<boolean> => {
    if (!cursorState.nauticalString) return false;

    const success = await copyToClipboard(cursorState.nauticalString);
    if (success) {
      setCursorState((prev) => ({ ...prev, hasCopied: true }));
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCursorState((prev) => ({ ...prev, hasCopied: false }));
      }, copyResetDuration);
    }
    return success;
  }, [cursorState.nauticalString, copyResetDuration]);

  // 2. Flexible Coordinate Parsing & Jump-to Navigation
  /**
   * Smoothly navigates the map to the target coordinates [lat, lng],
   * preserving current zoom if already zoomed in, or zooming in to focus if zoomed out.
   */
  const jumpToCoordinates = useCallback(
    (lat: number, lng: number, targetZoom?: number) => {
      if (!map) return;

      const currentZoom = map.getZoom();
      const finalZoom = targetZoom !== undefined
        ? targetZoom
        : Math.max(currentZoom, defaultFocusZoom);

      map.flyTo([lat, lng], finalZoom, {
        duration: 1.4,
        easeLinearity: 0.25,
      });
    },
    [map, defaultFocusZoom]
  );

  /**
   * Parses raw string input (DMM or DD) and programmatically navigates to it if valid.
   */
  const parseAndJump = useCallback(
    (input: string, targetZoom?: number): CoordinateParseResult => {
      const result = parseCoordinatesFlexible(input);
      if (result.success && map) {
        jumpToCoordinates(result.lat, result.lng, targetZoom);
      }
      return result;
    },
    [map, jumpToCoordinates]
  );

  // 3. Map Layer Context Menu Actions & Visibility State
  const [contextMenu, setContextMenu] = useState<MapContextMenuState | null>(null);
  const [hiddenWarningIds, setHiddenWarningIds] = useState<Set<string>>(new Set());
  const [contextMenuCopySuccess, setContextMenuCopySuccess] = useState(false);
  const contextMenuTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Attach to Leaflet layer 'contextmenu' event.
   * Prevents default browser context menu and opens custom nautical action palette.
   */
  const handleLayerContextMenu = useCallback(
    (e: L.LeafletMouseEvent, warning: NavWarning, customAnchor?: [number, number]) => {
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
      }

      const mapContainer = map?.getContainer();
      const rect = mapContainer?.getBoundingClientRect();

      const pixelX = rect ? e.originalEvent.clientX - rect.left : e.containerPoint.x;
      const pixelY = rect ? e.originalEvent.clientY - rect.top : e.containerPoint.y;

      const lat = customAnchor ? customAnchor[0] : (e.latlng ? e.latlng.lat : (warning.latitude || 0));
      const lng = customAnchor ? customAnchor[1] : (e.latlng ? e.latlng.lng : (warning.longitude || 0));
      const nautical = formatNauticalCoordinates(lat, lng);

      setContextMenu({
        isOpen: true,
        pixelPosition: { x: pixelX, y: pixelY },
        latLng: [lat, lng],
        nauticalCoordinates: nautical,
        targetWarning: warning,
      });
    },
    [map]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * Copies the clicked layer's anchor location to the clipboard in nautical format
   */
  const copyLayerLocation = useCallback(async (nauticalCoords?: string): Promise<boolean> => {
    const coordsToCopy = nauticalCoords || contextMenu?.nauticalCoordinates;
    if (!coordsToCopy) return false;

    const success = await copyToClipboard(coordsToCopy);
    if (success) {
      setContextMenuCopySuccess(true);
      if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current);
      contextMenuTimerRef.current = setTimeout(() => {
        setContextMenuCopySuccess(false);
      }, copyResetDuration);
    }
    return success;
  }, [contextMenu?.nauticalCoordinates, copyResetDuration]);

  /**
   * Toggle visibility: hide or filter out the item/geometry from the active render list
   */
  const toggleWarningVisibility = useCallback((warningId: string) => {
    setHiddenWarningIds((prev) => {
      const next = new Set(prev);
      if (next.has(warningId)) {
        next.delete(warningId);
      } else {
        next.add(warningId);
      }
      return next;
    });
    setContextMenu(null);
  }, []);

  /**
   * Unhide all previously hidden items
   */
  const unhideAllWarnings = useCallback(() => {
    setHiddenWarningIds(new Set());
  }, []);

  return {
    // 1. Cursor Tracking
    cursorState,
    copyCursorPosition,

    // 2. Parsing & Jump-To Navigation
    jumpToCoordinates,
    parseAndJump,
    parseCoordinates: parseCoordinatesFlexible,

    // 3. Layer Context Menu & Visibility Actions
    contextMenu,
    handleLayerContextMenu,
    closeContextMenu,
    copyLayerLocation,
    contextMenuCopySuccess,
    hiddenWarningIds,
    toggleWarningVisibility,
    unhideAllWarnings,
  };
}
