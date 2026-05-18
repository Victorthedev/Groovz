import { randomUUID } from 'crypto'
import { getDirections, offsetLatLng, buildMapsDeepLink, type LatLng } from './maps.client.js'

export type Activity = 'drive' | 'cycle' | 'walk' | 'jog'

export interface RouteResult {
  routeId: string
  estimatedDurationMinutes: number
  polyline: string
  waypoints: LatLng[]
  confidence: number
  mapsDeepLink: string
}

// ─── Activity → Maps config ───────────────────────────────────────────────────

const TRAVEL_MODE = {
  drive: 'driving',
  cycle: 'bicycling',
  walk:  'walking',
  jog:   'walking',
} as const

// Average speeds in km/h — used to estimate loop radius
const AVG_SPEED_KMH: Record<Activity, number> = {
  drive: 45,
  cycle: 15,
  jog:   10,
  walk:  5,
}

// ─── Loop route (start = end) ─────────────────────────────────────────────────

export async function generateLoopRoute(
  start: LatLng,
  activity: Activity,
  targetMinutes: number,
  toleranceMinutes = 10,
): Promise<RouteResult> {
  const mode   = TRAVEL_MODE[activity]
  const speed  = AVG_SPEED_KMH[activity]

  // Initial radius estimate: for a circular loop, distance ≈ 2πr
  // distance = speed * (targetMinutes / 60)  →  r = distance / (2π)
  let radiusKm = (speed * (targetMinutes / 60)) / (2 * Math.PI)

  let bestResult: RouteResult | null = null
  let bestDelta = Infinity

  for (let attempt = 0; attempt < 5; attempt++) {
    // Two waypoints forming a rough triangle with start
    const wp1 = offsetLatLng(start, radiusKm, 0)
    const wp2 = offsetLatLng(start, radiusKm, 130)

    const directions = await getDirections(start, start, [wp1, wp2], mode)
    if (!directions) break

    const actualMinutes = directions.durationSeconds / 60
    const delta         = Math.abs(actualMinutes - targetMinutes)

    const result: RouteResult = {
      routeId:                   randomUUID(),
      estimatedDurationMinutes:  Math.round(actualMinutes),
      polyline:                  directions.polyline,
      waypoints:                 [start, wp1, wp2, start],
      confidence:                Math.max(0, 1 - delta / targetMinutes),
      mapsDeepLink:              buildMapsDeepLink(start, start, [wp1, wp2], mode),
    }

    if (delta < bestDelta) { bestDelta = delta; bestResult = result }

    if (delta <= toleranceMinutes) break  // good enough

    // Scale radius proportionally to close the gap
    radiusKm = radiusKm * (targetMinutes / actualMinutes)
  }

  // Fallback if all requests failed — return an estimate with low confidence
  return bestResult ?? {
    routeId:                  randomUUID(),
    estimatedDurationMinutes: targetMinutes,
    polyline:                 '',
    waypoints:                [start],
    confidence:               0,
    mapsDeepLink:             buildMapsDeepLink(start, start, [], mode),
  }
}

// ─── Directed route (A → B) ───────────────────────────────────────────────────

export async function generateDirectedRoute(
  start: LatLng,
  destination: LatLng,
  activity: Activity,
): Promise<RouteResult> {
  const mode       = TRAVEL_MODE[activity]
  const directions = await getDirections(start, destination, [], mode)

  if (!directions) throw new Error('Could not calculate route. Check your locations and try again.')

  return {
    routeId:                  randomUUID(),
    estimatedDurationMinutes: Math.round(directions.durationSeconds / 60),
    polyline:                 directions.polyline,
    waypoints:                [start, destination],
    confidence:               1.0,
    mapsDeepLink:             buildMapsDeepLink(start, destination, [], mode),
  }
}
