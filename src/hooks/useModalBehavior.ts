import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behaviour for console overlays (UX audit: modal semantics).
 * One small hook - not a framework:
 *  - on open: focus the first focusable element inside the dialog
 *  - on close: restore focus to the element that had focus before it opened
 *  - while open: lock body scroll and keep Tab inside the dialog (focus trap,
 *    WCAG 2.4.3 for aria-modal overlays — Tab/Shift+Tab wrap first<->last)
 * Escape-to-close stays at each call site (WarningDetailModal pattern).
 */
export function useModalBehavior(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const initialFocusables = node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (initialFocusables && initialFocusables.length > 0) initialFocusables[0].focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus trap: re-query on every Tab so dynamically rendered controls
    // (tabs, banners, editor rows) are always covered.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return;
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const el = document.activeElement as HTMLElement | null;
      const inside = !!el && node.contains(el);
      if (e.shiftKey && (!inside || el === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || el === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener('keydown', onKeyDown);

    return () => {
      node?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}
