import { NavareaPlugin } from './types';
import { jhodXiPlugin } from './jhodXiPlugin';
import { universalPlugin } from './universalPlugin';

const pluginRegistry: Map<string, NavareaPlugin> = new Map();

// Register certified plugins
pluginRegistry.set('XI', jhodXiPlugin);
pluginRegistry.set('UNIVERSAL', universalPlugin);

/**
 * Resolves the appropriate NavareaPlugin based on NAVAREA ID or raw text characteristics.
 */
export function getNavareaPlugin(navareaId?: string | null, rawText?: string): NavareaPlugin {
  if (navareaId && pluginRegistry.has(navareaId.toUpperCase())) {
    return pluginRegistry.get(navareaId.toUpperCase())!;
  }

  // Check if rawText matches JHOD NO.YY-NNNN telex header
  if (rawText && /(?:^|\s)NO\.\d{2}-\d{4}/i.test(rawText)) {
    return jhodXiPlugin;
  }

  // Check if rawText matches NAVAREA XI explicit header
  if (rawText && /\bNAVAREA\s+XI\b/i.test(rawText)) {
    return jhodXiPlugin;
  }

  return universalPlugin;
}

export function registerPlugin(plugin: NavareaPlugin): void {
  pluginRegistry.set(String(plugin.navareaId).toUpperCase(), plugin);
}

export function getAllPlugins(): NavareaPlugin[] {
  return Array.from(pluginRegistry.values());
}

export const getAllNavareaPlugins = getAllPlugins;
