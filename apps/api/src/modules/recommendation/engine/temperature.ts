import { clamp, lerp } from '../../../shared/utils/index.js'
import type { PlaylistSession } from '../../../shared/types/session.js'

export function calculateTemperature(session: PlaylistSession): number {
  const progress = session.targetDurationMs > 0
    ? session.currentDurationMs / session.targetDurationMs
    : 0

  let T: number
  if (progress < 0.2) {
    T = 0.25
  } else if (progress < 0.6) {
    T = lerp(0.25, 0.6, (progress - 0.2) / 0.4)
  } else {
    T = lerp(0.6, 0.85, (progress - 0.6) / 0.4)
  }

  if (session.generationType === 'seed') T -= 0.05
  if (session.generationType === 'prompt') T += 0.05

  // Long-form damping
  if (session.targetDurationMs > 90 * 60 * 1000) T *= 0.9

  return clamp(T, 0.2, 0.9)
}
