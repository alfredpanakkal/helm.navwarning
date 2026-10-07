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

  // Inert the app shell outside the focus-mode map container so panels
  // can't receive focus or handle events; the container subtree (map
  // canvas + floating controls) stays interactive. Cleaned up on exit.
  useEffect(() => {
    if (!focusMap) return;
    const container = document.querySelector<HTMLElement>('[data-map-focus="on"]');
    if (!container) return;
    let el: HTMLElement | null = container;
    while (el && el.parentElement && el.parentElement !== document.body) {
      Array.from(el.parentElement.children).forEach((sibling) => {
        if (sibling !== el) {
          sibling.setAttribute('inert', 'true');
        }
      });
      el = el.parentElement;
    }
    return () => {
      document
        .querySelectorAll<HTMLElement>('[inert]')
        .forEach((node) => node.removeAttribute('inert'));
    };
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