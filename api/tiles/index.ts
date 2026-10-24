/**
 * Vercel Serverless Function: Unified Basemap/Overlay Tile Proxy
 *
 * Serves CARTO, OpenStreetMap and OpenSeaMap tiles from a single function so
 * the project stays within the Vercel Hobby plan limit of 12 Serverless
 * Functions per deployment (adding api/pipeline/runs.ts alongside the three
 * per-provider proxies made this the 13th function and failed the build).
 * All public routes are preserved by vercel.json rewrites:
 *
 *   /api/tiles/carto/:style/:z/:x/:y -> /api/tiles?provider=carto&style=...&z=...&x=...&y=...
 *   /api/tiles/osm/:z/:x/:y          -> /api/tiles?provider=osm&z=...&x=...&y=...
 *   /api/tiles/openseamap/:z/:x/:y   -> /api/tiles?provider=openseamap&z=...&x=...&y=...
 *
 * Behavior is identical to the previous per-provider functions (carto.ts,
 * osm.ts, openseamap.ts), which this file replaces.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_TILE_STYLES = ['voyager', 'dark_all', 'light_all'] as const;
type TileStyle = typeof ALLOWED_TILE_STYLES[number];

const TILE_PROVIDERS = ['carto', 'osm', 'openseamap'] as const;
type TileProvider = typeof TILE_PROVIDERS[number];

const UPSTREAM_UA_HEADERS = {
  'User-Agent': 'NavWarn-Maritime-Proxy/1.0 (maritime safety information viewer)',
  'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { provider, style, z, x, y } = req.query as Record<string, string>;

    // Fallback parsing from the original URL if query params are missing
    if (!provider) {
      const match = req.url?.match(/\/api\/tiles\/(carto|osm|openseamap)\//);
      if (match) provider = match[1];
    }
    if (!style && provider === 'carto') {
      const styleMatch = req.url?.match(/\/api\/tiles\/carto\/([^/?]+)\//);
      if (styleMatch) style = styleMatch[1];
    }

    if (!provider || !TILE_PROVIDERS.includes(provider as TileProvider)) {
      return res.status(400).json({
        error: `Unknown tile provider '${provider}'. Allowed providers: ${TILE_PROVIDERS.join(', ')}`,
        code: 'UNKNOWN_TILE_PROVIDER',
      });
    }

    if (!z || !x || !y || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
      return res.status(400).json({
        error: 'Tile coordinates z, x, and y must be non-negative integers.',
        code: 'INVALID_TILE_COORDINATES',
      });
    }

    const zoom = parseInt(z, 10);
    const tileX = parseInt(x, 10);
    const tileY = parseInt(y, 10);

    let upstreamResponse: Response;
    let missingTileIsNoContent = false;

    if (provider === 'carto') {
      if (!style || !ALLOWED_TILE_STYLES.includes(style as TileStyle)) {
        return res.status(400).json({
          error: `Invalid tile style '${style}'. Allowed styles: ${ALLOWED_TILE_STYLES.join(', ')}`,
          code: 'INVALID_TILE_STYLE',
        });
      }

      if (zoom < 0 || zoom > 19) {
        return res.status(400).json({
          error: `Tile zoom level z must be between 0 and 19 (received ${zoom}).`,
          code: 'TILE_ZOOM_OUT_OF_RANGE',
        });
      }

      const maxTileCoord = Math.pow(2, zoom);
      if (tileX < 0 || tileX >= maxTileCoord || tileY < 0 || tileY >= maxTileCoord) {
        return res.status(400).json({
          error: `Tile coordinate out of bounds for zoom level ${zoom}. Expected 0 <= x,y < ${maxTileCoord}.`,
          code: 'TILE_COORDINATE_OUT_OF_BOUNDS',
        });
      }

      const rawApiKey = process.env.CARTO_API_KEY;
      const apiKey = (rawApiKey && rawApiKey.trim().length > 0) ? rawApiKey.trim() : null;
      if (!apiKey) {
        // Fail closed: never fall back to a hardcoded key committed in source.
        console.error('[CARTO Tile Proxy Error]: CARTO_API_KEY is not configured.');
        return res.status(503).json({ error: 'CARTO tile proxy is not configured.', code: 'CARTO_KEY_MISSING' });
      }

      const subdomains = ['a', 'b', 'c', 'd'];
      const sub = subdomains[Math.floor(Math.random() * subdomains.length)];
      const cartoUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/${style}/${zoom}/${tileX}/${tileY}.png?key=${apiKey}`;
      upstreamResponse = await fetch(cartoUrl);
    } else if (provider === 'osm') {
      const subdomains = ['a', 'b', 'c'];
      const sub = subdomains[Math.floor(Math.random() * subdomains.length)];
      const osmUrl = `https://${sub}.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
      upstreamResponse = await fetch(osmUrl, { headers: UPSTREAM_UA_HEADERS });
    } else {
      missingTileIsNoContent = true;
      const seamarkUrl = `https://tiles.openseamap.org/seamark/${zoom}/${tileX}/${tileY}.png`;
      upstreamResponse = await fetch(seamarkUrl, { headers: UPSTREAM_UA_HEADERS });
    }

    if (!upstreamResponse.ok) {
      // OpenSeaMap seamark tiles are overlays: a missing upstream tile (404)
      // must be a transparent no-content response, not an error — same as the
      // previous dedicated proxy.
      if (missingTileIsNoContent) {
        return res.status(204).end();
      }
      return res.status(upstreamResponse.status).send(upstreamResponse.statusText);
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[Tile Proxy Error]:', err);
    // OpenSeaMap proxy failures degrade to empty overlays; others fail loudly.
    if ((req.query as Record<string, string>).provider === 'openseamap') {
      return res.status(204).end();
    }
    return res.status(500).send('Tile proxy error');
  }
}
