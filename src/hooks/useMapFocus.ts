import { useEffect, useState, useCallback } from 'react';

export interface UseMapFocusReturn {
  focusMap: boolean;
  setFocusMap: React.Dispatch<React.SetStateAction<boolean>>;
  enterFocusMap: () => void;
  exitFocusMap: () => void;
}

export function useMapFocus(
  isActive: boolean
): UseMapFocusReturn {
  const [focusMap, setFocusMap] = useState(false);

  // Focus mode only active on the active map tab
  useEffect(() => {
    if (!isActive && focusMap) setFocusMap(false);
  }, [isActive, focusMap]);

  // Focus-map chrome: `body[data-map-focus]` steps the app header/footer aside
  // (index.css) so the map owns the full viewport. Cleaned up on unmount.
  useEffect(() => {
    if (focusMap) document.body.setAttribute('data-map-focus', 'on');
    else document.body.removeAttribute('data-map-focus');
    return () => document.body.removeAttribute('data-map-focus');
  }, [focusMap]);

  // Inert sibling elements while map is focused so they can't receive
  // focus or handle events; clean up on exit.
  useEffect(() => {
    if (focusMap) {
      // Inert all direct children of body except the map canvas.
      const mapEl = document.getElementById('map');
      Array.from(document.body.children as HTMLCollection).forEach((el: HTMLElement) => {
        if (el !== mapEl) {
          el.setAttribute('inert', 'true');
        }
      });
    } else {
      Array.from(document.body.children as HTMLCollection).forEach((el: HTMLElement) => {
        el.removeAttribute('inert');
      });
    }
  }, [focusMap]);

  // Map size re-measure on focus enter/exit so tiles/controls realign.
  useEffect(() => {
    if (!focusMap) return;
    const mapEl = document.getElementById('map') as HTMLElement | null;
    const t1 = setTimeout(() => mapEl?.dispatchEvent(new Event('resize')), 80);
    const t2 = setTimeout(() => mapEl?.dispatchEvent(new Event('resize')), 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [focusMap]);

  const enterFocusMap = useCallback(() => setFocusMap(true), []);
  const exitFocusMap = useCallback(() => setFocusMap(false), []);

  return {
    focusMap,
    setFocusMap,
    enterFocusMap,
    exitFocusMap,
  };
}