// src/lib/featureFlags.ts

export const DEFAULT_FLAGS = {
  // Phase 1: Always enabled
  inForceListParsingEnhanced: true,

  // Phase 2: AI Studio fallback (enabled in dev/test, disabled by default in prod)
  aiStudioFallback:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
      ? true
      : typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
      ? true
      : false,

  // Phase 3: In-Force Snapshots enabled
  inForceSnapshots: true,

  // Phase 4+: Future flags
  inForceUIDisplay: false,
  inForceFallbackToLifecycle: true,
};

export type FeatureFlagKey = keyof typeof DEFAULT_FLAGS;

// Mutable store for direct runtime property assignments (e.g. FEATURE_FLAGS.inForceSnapshots = false)
const runtimeOverrides: Partial<Record<FeatureFlagKey, boolean>> = {};

/**
 * Resets any runtime property overrides (useful in test teardown).
 */
export function resetFeatureFlags(): void {
  for (const key of Object.keys(runtimeOverrides)) {
    delete runtimeOverrides[key as FeatureFlagKey];
  }
}

/**
 * Checks whether a feature flag is enabled, checking process.env.FEATURE_FLAGS,
 * then runtime overrides, then DEFAULT_FLAGS.
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  if (typeof process !== 'undefined' && process.env?.FEATURE_FLAGS) {
    try {
      const parsed = JSON.parse(process.env.FEATURE_FLAGS);
      if (parsed && typeof parsed === 'object' && flag in parsed && typeof parsed[flag] === 'boolean') {
        return parsed[flag];
      }
    } catch {
      // Ignore JSON parse errors in process.env.FEATURE_FLAGS
    }
  }

  if (flag in runtimeOverrides && typeof runtimeOverrides[flag] === 'boolean') {
    return runtimeOverrides[flag]!;
  }

  return DEFAULT_FLAGS[flag] ?? false;
}

export const FEATURE_FLAGS: typeof DEFAULT_FLAGS = new Proxy(DEFAULT_FLAGS, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'string' && prop in DEFAULT_FLAGS) {
      return isFeatureEnabled(prop as FeatureFlagKey);
    }
    return Reflect.get(target, prop);
  },
  set(target, prop: string | symbol, value: any) {
    if (typeof prop === 'string' && prop in DEFAULT_FLAGS) {
      runtimeOverrides[prop as FeatureFlagKey] = Boolean(value);
      return true;
    }
    return Reflect.set(target, prop, value);
  },
  has(target, prop: string | symbol) {
    return Reflect.has(target, prop);
  },
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
});
