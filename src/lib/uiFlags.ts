/**
 * Legacy "classic" UI path — RETIRED.
 *
 * The `hwUI` localStorage flag and the `VITE_HW_CLASSIC_UI` build flag were
 * removed: the console always renders the v2 interface. These exports remain
 * so existing call sites (LeafletMap, DataBankWarningList) keep compiling;
 * they are inert and actively purge any stale stored flag.
 */
export const HW_UI_STORAGE_KEY = 'hwUI';

function purgeStaleFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(HW_UI_STORAGE_KEY);
  } catch {
    /* private-mode localStorage can throw */
  }
}

export function isUILegacy(): boolean {
  purgeStaleFlag();
  return false;
}

export function useUILegacy(): boolean {
  return false;
}

export function setUILegacy(_legacy: boolean): void {
  purgeStaleFlag();
}
