import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Shared modal behaviour for console overlays (UX audit: modal semantics).
 * One small hook - not a framework:
 *  - on open: focus the first focusable element inside the dialog
 *  - on close: restore focus to the element that had focus before it opened
 *  - while open: lock body scroll
 * Escape-to-close stays at each call site (WarningDetailModal pattern).
 */
export function useModalBehavior(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = node?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables && focusables.length > 0) focusables[0].focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
