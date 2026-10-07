import { useState, useCallback } from 'react';

export interface UseMapFocusReturn {
  isFocused: boolean;
  setFocused: (focused: boolean) => void;
  toggleFocus: () => void;
}

export function useMapFocus(): UseMapFocusReturn {
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const setFocused = useCallback((focused: boolean) => {
    setIsFocused(focused);
    if (focused) {
      document.body?.setAttribute('data-map-focus', 'on');
      // Add inert to chrome containers, not the map itself
      const chromeSelectors = [
        '#map-controls',
        '.sidebar-layer-toggles',
      ];
      for (const selector of chromeSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => el.setAttribute('inert', 'true'));
      }
    } else {
      document.body?.removeAttribute('data-map-focus');
      const chromeSelectors = [
        '#map-controls',
        '.sidebar-layer-toggles',
      ];
      for (const selector of chromeSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => el.removeAttribute('inert'));
      }
    }
  }, []);

  const toggleFocus = useCallback(() => {
    setIsFocused((prev) => !prev);
  }, []);

  return {
    isFocused,
    setFocused,
    toggleFocus,
  };
}