/**
 * Privacy helpers for location data minimization (LGPD).
 *
 * Time records only need enough precision to prove the punch happened at the
 * expected work site. Exact GPS coordinates would allow reconstructing an
 * employee's movements, so coordinates are rounded before being persisted.
 * Geofence validation still runs with full precision on the device.
 */

/** ~11 m precision — enough for on-site verification, not for tracking. */
export const LOCATION_DECIMALS = 4;

export function coarseCoordinate(
  coord: number | null | undefined,
  decimals: number = LOCATION_DECIMALS,
): number | null {
  if (coord === null || coord === undefined || Number.isNaN(coord)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(coord * factor) / factor;
}
