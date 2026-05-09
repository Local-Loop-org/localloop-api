/**
 * Maps a discovery radius (in km) to the geohash precision whose 9-cell
 * footprint comfortably encloses the radius circle.
 *
 * Approx cell widths: precision 6 → ~1.2km, 5 → ~5km, 4 → ~39km.
 */
export function precisionForRadiusKm(radiusKm: number): number {
  if (radiusKm <= 2) return 6;
  if (radiusKm <= 10) return 5;
  return 4;
}

export const DEFAULT_DISCOVERY_RADIUS_KM = 25;
