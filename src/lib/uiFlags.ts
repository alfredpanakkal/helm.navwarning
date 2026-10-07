import { useSyncExternalStore } from 'react';

export const HW_UI_STORAGE_KEY = 'hwUI';

const CHANGE_EVENT = 'hw-ui-change';

export function isUILegacy(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(HW_UI_STORAGE_KEY) === 'classic') return true;
  } catch {
    /* private-mode localStorage can throw; fall through to env default */
  }
  return import.meta.env.VITE_HW_CLASSIC_UI === '1';
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function getSnapshot(): boolean {
  return isUILegacy();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useUILegacy(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setUILegacy(legacy: boolean): void {
  if (typeof window === 'undefined') return;
  if (legacy) {
    window.localStorage.setItem(HW_UI_STORAGE_KEY, 'classic');
  } else {
    window.localStorage.removeItem(HW_UI_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
