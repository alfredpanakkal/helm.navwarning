/**
 * Vercel Serverless Function: OpenSeaMap Tile Proxy
 * Proxies seamark overlay tiles server-side to prevent CORS/CSP blocking.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    let { z, x, y } = req.query as Record<string, string>;

    if (!z || !x || !y) {
      const match = req.url?.match(/\/api\/tiles\/openseamap\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        z = match[1];
        x = match[2];
        y = match[3];
      }
    }

    if (!z || !x || !y || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
      return res.status(400).json({ error: 'Invalid tile coordinates' });
    }

    const zoom = parseInt(z, 10);
    const tileX = parseInt(x, 10);
    const tileY = parseInt(y, 10);

    const seamarkUrl = `https://tiles.openseamap.org/seamark/${zoom}/${tileX}/${tileY}.png`;

    const upstreamResponse = await fetch(seamarkUrl, {
      headers: {
        'User-Agent': 'NavWarn-Maritime-Proxy/1.0 (maritime safety information viewer)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!upstreamResponse.ok) {
      // If seamark tile is missing (404), return 204 or transparent tile rather than failing hard
      return res.status(204).end();
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('[OpenSeaMap Tile Proxy Error]:', err);
    return res.status(204).end();
  }
}
