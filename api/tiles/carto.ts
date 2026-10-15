/**
 * Vercel Serverless Function: CARTO Basemap Tile Proxy
 *
 * Proxies raster tiles from CartoCDN server-side so that CARTO_API_KEY
 * remains a secure secret and browser requests on Vercel succeed without 404s.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_TILE_STYLES = ['voyager', 'dark_all', 'light_all'] as const;
type TileStyle = typeof ALLOWED_TILE_STYLES[number];

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
    let { style, z, x, y } = req.query as Record<string, string>;

    // Fallback parsing from URL if query params are missing
    if (!style || !z || !x || !y) {
      const match = req.url?.match(/\/api\/tiles\/carto\/([^/?]+)\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        style = match[1];
        z = match[2];
        x = match[3];
        y = match[4];
      }
    }

    if (!style || !ALLOWED_TILE_STYLES.includes(style as TileStyle)) {
      return res.status(400).json({
        error: `Invalid tile style '${style}'. Allowed styles: ${ALLOWED_TILE_STYLES.join(', ')}`,
        code: 'INVALID_TILE_STYLE',
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
    const apiKey = rawApiKey && rawApiKey.trim().length > 0
      ? rawApiKey.trim()
      : 'cb1_3orr_1_f228f632545fb6733113f41c';

    const subdomains = ['a', 'b', 'c', 'd'];
    const sub = subdomains[Math.floor(Math.random() * subdomains.length)];

    const cartoUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/${style}/${zoom}/${tileX}/${tileY}.png?key=${apiKey}`;

    const upstreamResponse = await fetch(cartoUrl);
    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).send(upstreamResponse.statusText);
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[CARTO Tile Proxy Error]:', err);
    return res.status(500).send('Tile proxy error');
  }
}
