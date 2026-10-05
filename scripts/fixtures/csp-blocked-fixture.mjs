// Fixture: serves a stub chart page whose basemap images are blocked by a
// strict CSP, so we can prove verify-deployment.mjs actually fails.
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4321);
const DOT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const tile = (i) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/2/${(i % 4) + 1}/2`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Helm.Warning</title></head>
<body>
<header><a class="gw-skip-link" href="#main-content">Skip to main content</a></header>
<main id="main-content" tabindex="-1">
  <h1>Fixture</h1>
  <div class="leaflet-container">
  <div class="leaflet-pane leaflet-base-pane" id="map">
    ${Array.from({ length: 28 }, (_, i) => `<img class="leaflet-tile" src="${tile(i)}" width="256" height="256" alt="">`).join('\n    ')}
  </div>
  <div class="leaflet-pane leaflet-marker-pane"><img class="leaflet-marker-icon" src="/dot.png" alt=""></div>
  </div>
</main>
</body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/dot.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(DOT);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Same defect PR #4 fixed: arcgisonline missing from img-src.
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'");
    res.end(html);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`csp-blocked fixture on http://127.0.0.1:${PORT}`);
  });