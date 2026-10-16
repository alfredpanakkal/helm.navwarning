import { NavWarning } from '../types';

export function getWarningBulletinText(w?: Partial<NavWarning> | null): string {
  if (!w) return 'No additional bulletin text available.';

  const text =
    w.raw_text ||
    w.bulletin ||
    w.text ||
    w.rawText ||
    w.body ||
    w.details ||
    w.issued_text ||
    w.message;

  if (typeof text === 'string' && text.trim().length > 0) {
    return text.trim();
  }

  return 'No additional bulletin text available.';
}

export function getWarningDate(w?: Partial<NavWarning> | null): string {
  if (!w) return 'N/A';

  const dateVal = w.issued_date || w.issued || w.date;
  if (typeof dateVal === 'string' && dateVal.trim() && dateVal !== 'undefined') {
    return dateVal.trim();
  }

  if (typeof w.issued_at === 'string' && w.issued_at.trim()) {
    return w.issued_at.slice(0, 10);
  }

  if (typeof w.timestamp === 'number') {
    return new Date(w.timestamp).toISOString().slice(0, 10);
  }

  return 'N/A';
}

export function getWarningPositionCount(w?: Partial<NavWarning> | null): number {
  if (!w) return 0;
  if (w.spatial?.circles && w.spatial.circles.length > 0) {
    return w.spatial.circles.length;
  }
  const poly = w.spatial?.geometries?.find((g) => g.type === 'Polygon');
  if (poly && Array.isArray(poly.coordinates[0])) {
    return (poly.coordinates[0] as any[]).length;
  }
  if (w.spatial?.raw_coordinate_text && w.spatial.raw_coordinate_text.length > 0) {
    return w.spatial.raw_coordinate_text.length;
  }
  return (w.latitude && w.longitude) ? 1 : 0;
}
