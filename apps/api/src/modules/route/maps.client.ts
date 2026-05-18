export interface LatLng { lat: number; lng: number }

export interface DirectionsResult {
  durationSeconds: number
  polyline: string
}

type TravelMode = 'driving' | 'walking' | 'bicycling'

interface GoogleDirectionsResponse {
  status: string
  routes: Array<{
    overview_polyline: { points: string }
    legs: Array<{
      duration: { value: number }
    }>
  }>
}

const KEY = process.env.GOOGLE_MAPS_API_KEY

export async function getDirections(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  mode: TravelMode,
): Promise<DirectionsResult | null> {
  if (!KEY) throw new Error('GOOGLE_MAPS_API_KEY not set')

  const params = new URLSearchParams({
    origin:      `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode,
    key: KEY,
  })

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(w => `${w.lat},${w.lng}`).join('|'))
  }

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
  )
  if (!res.ok) return null

  const data = await res.json() as GoogleDirectionsResponse
  if (data.status !== 'OK' || !data.routes[0]) return null

  const route = data.routes[0]
  const totalSeconds = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0)

  return {
    durationSeconds: totalSeconds,
    polyline: route.overview_polyline.points,
  }
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

export function offsetLatLng(point: LatLng, distanceKm: number, bearingDeg: number): LatLng {
  const R = 6371
  const bearing = (bearingDeg * Math.PI) / 180
  const lat1    = (point.lat  * Math.PI) / 180
  const lng1    = (point.lng  * Math.PI) / 180
  const d       = distanceKm / R

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  )

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  }
}

export function buildMapsDeepLink(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  mode: TravelMode,
): string {
  const params = new URLSearchParams({
    api:        '1',
    origin:     `${origin.lat},${origin.lng}`,
    destination:`${destination.lat},${destination.lng}`,
    travelmode: mode,
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(w => `${w.lat},${w.lng}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
