// Shared utilities — add to this file as needed

// Cross-genre average track length used when Last.fm returns 0 or missing duration.
// 3.5 min is the industry average across pop, rock, electronic, hip-hop, etc.
export const DEFAULT_TRACK_DURATION_MS = 3.5 * 60 * 1000  // 210,000ms

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
