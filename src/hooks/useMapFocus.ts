import { useEffect, useState, useCallback } from 'react';

export interface UseMapFocusReturn {
  focusMap: boolean;
  setFocusMap: React.Dispatch<React.SetStateAction<boolean>>;
  enterFocusMap: () => void;
  exitFocusMap: () => void;
}

export function useMapFocus(
  legacyUI: boolean,
  isActive: boolean
): UseMapFocusReturn {
  const [focusMap, setFocusMap] = useState(false);

  // Legacy/UI check: classic path never renders the focus control.
  useEffect(() => {
    if ((legacyUI || !isActive) && focusMap) setFocusMap(false);
  }, [legacyUI, isActive, focusMap]);

  // Set/remove data-map-focus on body for CSS chrome stepping aside.
  useEffect(() => {
    if (legacyUI) return;
    if (focusMap) document.body.setAttribute('data-map-focus', 'on');
    else document.body.removeAttribute('data-map-focus');
    return () => document.body.removeAttribute('data-map-focus');
  }, [focusMap, legacyUI]);

  // Inert sibling elements while map is focused so they can't receive
  // focus or handle events; clean up on exit.
  useEffect(() => {
    if (legacyUI) return;
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
  }, [focusMap, legacyUI]);

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