const DEFAULT_MIN_DIMENSION_PX = 14;
const DEFAULT_MIN_AREA_PX = 196;

function signedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function scanlineIntervals(ring, y) {
  const intersections = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      intersections.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
  }
  intersections.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i + 1 < intersections.length; i += 2) {
    if (intersections[i + 1] - intersections[i] > 0.001) {
      intervals.push([intersections[i], intersections[i + 1]]);
    }
  }
  return intervals;
}

function subtractIntervals(source, cuts) {
  let remaining = source.map(([start, end]) => [start, end]);
  for (const [cutStart, cutEnd] of cuts) {
    const next = [];
    for (const [start, end] of remaining) {
      if (cutEnd <= start || cutStart >= end) {
        next.push([start, end]);
        continue;
      }
      if (cutStart > start) next.push([start, Math.min(cutStart, end)]);
      if (cutEnd < end) next.push([Math.max(cutEnd, start), end]);
    }
    remaining = next;
  }
  return remaining.filter(([start, end]) => end - start > 0.001);
}

function projectRings(rings, project) {
  if (!Array.isArray(rings) || typeof project !== 'function') return [];
  return rings.map(ring => Array.isArray(ring)
    ? ring.map(coordinate => project(coordinate)).filter(point =>
      point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : []);
}

export function getProjectedPolygonMetrics(rings, project, options = {}) {
  const projected = projectRings(rings, project).filter(ring => ring.length >= 3);
  if (!projected.length) return null;

  const exterior = projected[0];
  const allPoints = projected.flat();
  const xs = exterior.map(point => point.x);
  const ys = exterior.map(point => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const area = Math.max(0, Math.abs(signedArea(exterior)) -
    projected.slice(1).reduce((sum, ring) => sum + Math.abs(signedArea(ring)), 0));
  const boundsArea = width * height;
  const minDimension = options.minDimension ?? DEFAULT_MIN_DIMENSION_PX;
  const minArea = options.minArea ?? DEFAULT_MIN_AREA_PX;

  return {
    width,
    height,
    area,
    boundsArea,
    fillRatio: boundsArea > 0 ? area / boundsArea : 0,
    isTooSmall: width < minDimension || height < minDimension || area < minArea,
    pointCount: allPoints.length,
  };
}

// Finds a scanline point inside the exterior ring and outside every hole.
// Candidate points are taken from open intervals between polygon edges, not
// from a centroid or bounding-box centre, so concave shapes remain supported.
export function findInteriorPoint(rings, project, avoidPoints = []) {
  const projected = projectRings(rings, project).filter(ring => ring.length >= 3);
  if (!projected.length) return null;

  const ys = [...new Set(projected.flatMap(ring => ring.map(point => point.y)))].sort((a, b) => a - b);
  const scanYs = [];
  for (let i = 0; i + 1 < ys.length; i += 1) {
    if (ys[i + 1] - ys[i] > 0.001) scanYs.push((ys[i] + ys[i + 1]) / 2);
  }
  if (!scanYs.length) return null;

  let best = null;
  for (const y of scanYs) {
    let intervals = scanlineIntervals(projected[0], y);
    for (const hole of projected.slice(1)) {
      intervals = subtractIntervals(intervals, scanlineIntervals(hole, y));
    }

    for (const [start, end] of intervals) {
      const width = end - start;
      for (const fraction of [0.5, 0.25, 0.75]) {
        const candidate = { x: start + width * fraction, y };
        const clearance = avoidPoints.length
          ? Math.min(...avoidPoints.map(point => Math.hypot(candidate.x - point.x, candidate.y - point.y)))
          : width;
        const score = avoidPoints.length ? clearance : width;
        if (!best || score > best.score) best = { ...candidate, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}
