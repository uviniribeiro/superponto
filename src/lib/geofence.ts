/**
 * Utilitários de geolocalização para o registro de ponto.
 * Cálculo de distância (Haversine) e validação de cerca virtual (geofence).
 */

export interface AllowedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  source: 'work_station' | 'georeferenced';
}

export interface GeofenceResult {
  /** true quando não há cercas cadastradas ou o funcionário está dentro de alguma */
  allowed: boolean;
  /** local mais próximo encontrado */
  nearest: AllowedLocation | null;
  /** distância em metros até o local mais próximo */
  distanceMeters: number | null;
  /** true quando o funcionário não possui locais vinculados (sem restrição) */
  unrestricted: boolean;
}

const EARTH_RADIUS_M = 6371000;

const toRad = (value: number) => (value * Math.PI) / 180;

/** Distância em metros entre duas coordenadas (fórmula de Haversine) */
export function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}

/** Formata distância para exibição (m / km) */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

/**
 * Verifica se a posição está dentro de alguma cerca virtual permitida.
 * `accuracyMeters` é somado à tolerância para não penalizar GPS impreciso.
 */
export function checkGeofence(
  latitude: number,
  longitude: number,
  locations: AllowedLocation[],
  accuracyMeters = 0
): GeofenceResult {
  const valid = locations.filter(
    (l) =>
      typeof l.latitude === 'number' &&
      typeof l.longitude === 'number' &&
      !Number.isNaN(l.latitude) &&
      !Number.isNaN(l.longitude)
  );

  if (valid.length === 0) {
    return { allowed: true, nearest: null, distanceMeters: null, unrestricted: true };
  }

  let nearest: AllowedLocation | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let allowed = false;

  for (const loc of valid) {
    const distance = distanceInMeters(latitude, longitude, loc.latitude, loc.longitude);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = loc;
    }
    const tolerance = (loc.radius_meters || 100) + Math.min(accuracyMeters, 100);
    if (distance <= tolerance) allowed = true;
  }

  return {
    allowed,
    nearest,
    distanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
    unrestricted: false,
  };
}
