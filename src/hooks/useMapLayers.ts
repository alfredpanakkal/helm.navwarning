import { useState, useCallback, useMemo } from 'react';
import { BASE_LAYERS, OVERLAY_LAYERS, MapLayerConfig } from '../config/mapLayers';

export interface NavWarnVectorStyle {
  color: string;
  fillColor: string;
  weight: number;
  opacity: number;
  fillOpacity: number;
  dashArray?: string;
}

export type WarningSeverityLevel = 'critical' | 'high' | 'moderate' | 'low';

export interface UseMapLayersReturn {
  activeBaseLayerId: string;
  activeBaseLayerConfig: MapLayerConfig;
  enabledOverlays: Set<string>;
  setBaseLayer: (layerId: string) => void;
  toggleOverlay: (layerId: string, forceState?: boolean) => void;
  isOverlayEnabled: (layerId: string) => boolean;
  isDarkBasemap: boolean;
  getVectorStyle: (severity: WarningSeverityLevel, isSelected?: boolean) => NavWarnVectorStyle;
  getCircleStyle: (isSelected?: boolean) => NavWarnVectorStyle;
}

export function useMapLayers(
  initialBaseId: string = 'esri-ocean',
  initialOverlays: string[] = ['esri-labels', 'openseamap']
): UseMapLayersReturn {
  const [activeBaseLayerId, setActiveBaseLayerId] = useState<string>(initialBaseId);
  const [enabledOverlays, setEnabledOverlays] = useState<Set<string>>(new Set(initialOverlays));

  // Determine if active base layer has a dark palette
  const isDarkBasemap = activeBaseLayerId === 'carto-dark';

  // Base layer setter with auto-bind behavior for esri-ocean -> esri-labels
  const setBaseLayer = useCallback((layerId: string) => {
    setActiveBaseLayerId(layerId);

    // Auto-bind: when esri-ocean is selected, ensure esri-labels is toggled ON
    if (layerId === 'esri-ocean') {
      setEnabledOverlays((prev) => {
        const next = new Set(prev);
        next.add('esri-labels');
        return next;
      });
    }
  }, []);

  // Manual overlay toggling with override support
  const toggleOverlay = useCallback((layerId: string, forceState?: boolean) => {
    setEnabledOverlays((prev) => {
      const next = new Set(prev);
      const shouldEnable = forceState !== undefined ? forceState : !next.has(layerId);
      if (shouldEnable) {
        next.add(layerId);
      } else {
        next.delete(layerId);
      }
      return next;
    });
  }, []);

  const isOverlayEnabled = useCallback(
    (layerId: string) => enabledOverlays.has(layerId),
    [enabledOverlays]
  );

  const activeBaseLayerConfig = useMemo(() => {
    return BASE_LAYERS.find((b) => b.id === activeBaseLayerId) || BASE_LAYERS[0];
  }, [activeBaseLayerId]);

  // Dynamic style calculation: high-contrast colors tuned to dark vs light/ocean basemaps
  const getVectorStyle = useCallback(
    (severity: WarningSeverityLevel, isSelected: boolean = false): NavWarnVectorStyle => {
      if (isDarkBasemap) {
        // High-luminance neon palette for dark backgrounds
        switch (severity) {
          case 'critical':
            return {
              color: isSelected ? '#ffffff' : '#ff3366',
              fillColor: '#ff2a5f',
              weight: isSelected ? 3 : 2,
              opacity: 1.0,
              fillOpacity: isSelected ? 0.35 : 0.22,
              dashArray: '5, 5',
            };
          case 'high':
            return {
              color: isSelected ? '#ffffff' : '#ffb703',
              fillColor: '#fb8500',
              weight: isSelected ? 3 : 2,
              opacity: 0.95,
              fillOpacity: isSelected ? 0.32 : 0.2,
              dashArray: '5, 5',
            };
          default:
            return {
              color: isSelected ? '#ffffff' : '#00f0ff',
              fillColor: '#00b4d8',
              weight: isSelected ? 3 : 1.75,
              opacity: 0.9,
              fillOpacity: isSelected ? 0.28 : 0.18,
              dashArray: '4, 4',
            };
        }
      } else {
        // Deep high-contrast saturated palette for light / ocean backgrounds
        switch (severity) {
          case 'critical':
            return {
              color: isSelected ? '#7f1d1d' : '#e11d48',
              fillColor: '#e11d48',
              weight: isSelected ? 3 : 2,
              opacity: 1.0,
              fillOpacity: isSelected ? 0.3 : 0.18,
              dashArray: '4, 4',
            };
          case 'high':
            return {
              color: isSelected ? '#78350f' : '#d97706',
              fillColor: '#f59e0b',
              weight: isSelected ? 3 : 2,
              opacity: 0.95,
              fillOpacity: isSelected ? 0.28 : 0.16,
              dashArray: '4, 4',
            };
          default:
            return {
              color: isSelected ? '#082f49' : '#0284c7',
              fillColor: '#0284c7',
              weight: isSelected ? 3 : 1.75,
              opacity: 0.9,
              fillOpacity: isSelected ? 0.25 : 0.15,
              dashArray: '4, 4',
            };
        }
      }
    },
    [isDarkBasemap]
  );

  // Dynamic hazard circle styles
  const getCircleStyle = useCallback(
    (isSelected: boolean = false): NavWarnVectorStyle => {
      if (isDarkBasemap) {
        return {
          color: isSelected ? '#ffffff' : '#ffd166',
          fillColor: '#ffb703',
          weight: isSelected ? 2.5 : 1.75,
          opacity: 0.95,
          fillOpacity: 0.16,
        };
      }
      return {
        color: isSelected ? '#78350f' : '#d97706',
        fillColor: '#f59e0b',
        weight: isSelected ? 2.5 : 1.75,
        opacity: 0.95,
        fillOpacity: 0.14,
      };
    },
    [isDarkBasemap]
  );

  return {
    activeBaseLayerId,
    activeBaseLayerConfig,
    enabledOverlays,
    setBaseLayer,
    toggleOverlay,
    isOverlayEnabled,
    isDarkBasemap,
    getVectorStyle,
    getCircleStyle,
  };
}
