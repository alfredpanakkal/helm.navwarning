export interface GeometryEditSafetyOptions {
  allowMultiple?: boolean;
  allowBufferedPoints?: boolean;
  allowCircle?: boolean;
  metadataComplete?: boolean;
}

/**
 * Fail closed when the current editors cannot round-trip a stored geometry
 * without simplifying it or dropping metadata.
 */
export function geometryEditBlockReason(
  geometries: unknown,
  options: GeometryEditSafetyOptions = {}
): string | null {
  if (!Array.isArray(geometries) || geometries.length === 0) return null;
  if (options.metadataComplete === false) {
    return 'This warning came from a view that omits some geometry metadata. Geometry editing is blocked until the complete metadata contract is available.';
  }
  if (!options.allowMultiple && geometries.length > 1) {
    return 'This editor can safely replace only one geometry at a time. Use the map geometry editor for multi-zone warnings.';
  }

  for (const geometry of geometries) {
    if (!geometry || typeof geometry !== 'object') {
      return 'A stored geometry is malformed. Geometry editing is blocked to avoid removing it.';
    }
    const g = geometry as Record<string, any>;
    if (!['Point', 'LineString', 'Polygon', ...(options.allowCircle ? ['Circle'] : [])].includes(g.type)) {
      return `${String(g.type || 'Unknown')} geometry is not safely editable by this editor yet.`;
    }
    const validPosition = (position: unknown) =>
      Array.isArray(position) && position.length === 2 &&
      position.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate));
    if (g.type === 'Point' && !validPosition(g.coordinates)) {
      return 'A point has malformed coordinates. Geometry editing is blocked to avoid removing it.';
    }
    if (g.type === 'Circle') {
      const center = Array.isArray(g.coordinates?.[0]) ? g.coordinates[0] : g.coordinates;
      if (!validPosition(center) || !(Number(g.radius_nm || g.buffer_nm) > 0)) {
        return 'A circle has an invalid center or missing radius. Geometry editing is blocked rather than guessing.';
      }
    }
    if (g.type === 'LineString' && (!Array.isArray(g.coordinates) || g.coordinates.length < 2 || !g.coordinates.every(validPosition))) {
      return 'A line has malformed coordinates. Geometry editing is blocked to avoid removing it.';
    }
    if (g.type === 'Polygon') {
      if (!Array.isArray(g.coordinates) || g.coordinates.length === 0 || !Array.isArray(g.coordinates[0]) || g.coordinates[0].length < 4 || !g.coordinates[0].every(validPosition)) {
        return 'A polygon has malformed coordinates. Geometry editing is blocked to avoid removing it.';
      }
      if (g.coordinates.length > 1) {
        return 'Polygon holes are not supported by this editor yet; editing is blocked to preserve them.';
      }
    }
    if (g.type === 'Point' && Number(g.buffer_nm || g.radius_nm || 0) > 0 && !options.allowBufferedPoints) {
      return 'Buffered points are not safely editable by this editor yet.';
    }
    if (g.type !== 'Point' && g.type !== 'Circle' && Number(g.buffer_nm || 0) > 0) {
      return 'Buffered non-point geometry is not safely editable by this editor yet.';
    }
    const advancedFields = [
      'corridor_half_width_nm',
      'corridor_clearance_nm',
      'sweep_radius_nm',
      'sweep_start_azimuth',
      'sweep_end_azimuth',
      'altitude_ceiling_fl',
    ];
    if (advancedFields.some((field) => g[field] != null) ||
        (g.altitude_floor_m != null && Number(g.altitude_floor_m) !== 0)) {
      return 'This geometry contains corridor, sweep or altitude metadata that this editor cannot preserve yet.';
    }
    if (g.snapping_rule && String(g.snapping_rule).toUpperCase() !== 'NONE') {
      return 'This geometry contains a snapping rule that this editor cannot preserve yet.';
    }
  }
  return null;
}
