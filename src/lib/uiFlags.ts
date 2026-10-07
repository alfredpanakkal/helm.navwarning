// Feature flag removed (Task 13). The new hierarchy is the only path.
export const HW_UI_STORAGE_KEY = 'hwUI';

export function isUILegacy(): boolean {
  return false;
}

export function useUILegacy(): boolean {
  return false;
}

export function setUILegacy(_legacy: boolean): void {
  // No-op: legacy path removed
}