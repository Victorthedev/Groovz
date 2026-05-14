import { normaliseArtist } from './normaliser.js'
import type { CanonicalTrack } from '../../../shared/types/index.js'

// ─── Post-selection ordering pass (§5.8) ─────────────────────────────────────
// Rules:
//  1. Sort loosely by energy: ascending for first 30%, plateau, slight lift at end
//  2. Small swaps to avoid back-to-back similar artists
//  3. Avoid sudden energy spikes/drops between adjacent tracks
//  4. No removals

export function sequenceTracks(tracks: CanonicalTrack[]): CanonicalTrack[] {
  if (tracks.length <= 1) return tracks

  const result = [...tracks]
  const len = result.length
  const first30 = Math.floor(len * 0.3)
  const last20 = Math.floor(len * 0.8)

  // Step 1 — loose energy ordering in segments
  const opening = result.slice(0, first30).sort(byEnergyAsc)
  const middle = result.slice(first30, last20)   // plateau — no reorder
  const closing = result.slice(last20).sort(byEnergyAsc).reverse()  // slight lift

  const ordered = [...opening, ...middle, ...closing]

  // Step 2 — swap to break back-to-back same artists (max 5 passes)
  for (let pass = 0; pass < 5; pass++) {
    let swapped = false
    for (let i = 0; i < ordered.length - 1; i++) {
      if (normaliseArtist(ordered[i].artist) === normaliseArtist(ordered[i + 1].artist)) {
        // Find the nearest different artist to swap with
        const swapIdx = findSwapCandidate(ordered, i + 1)
        if (swapIdx !== -1) {
          ;[ordered[i + 1], ordered[swapIdx]] = [ordered[swapIdx], ordered[i + 1]]
          swapped = true
        }
      }
    }
    if (!swapped) break
  }

  // Step 3 — dampen extreme adjacent energy deltas (swap if delta > 0.5)
  for (let i = 0; i < ordered.length - 1; i++) {
    const curr = ordered[i].energy
    const next = ordered[i + 1].energy
    if (curr != null && next != null && Math.abs(curr - next) > 0.5) {
      const swapIdx = findSmoothSwap(ordered, i + 1)
      if (swapIdx !== -1) {
        ;[ordered[i + 1], ordered[swapIdx]] = [ordered[swapIdx], ordered[i + 1]]
      }
    }
  }

  return ordered
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function byEnergyAsc(a: CanonicalTrack, b: CanonicalTrack): number {
  return (a.energy ?? 0.5) - (b.energy ?? 0.5)
}

function findSwapCandidate(tracks: CanonicalTrack[], from: number): number {
  const artist = normaliseArtist(tracks[from].artist)
  for (let i = from + 1; i < Math.min(from + 6, tracks.length); i++) {
    if (normaliseArtist(tracks[i].artist) !== artist) return i
  }
  return -1
}

function findSmoothSwap(tracks: CanonicalTrack[], from: number): number {
  const prevEnergy = tracks[from - 1]?.energy ?? 0.5
  const curr = tracks[from].energy ?? 0.5
  // Look for a track within the next 4 positions with closer energy to previous
  for (let i = from + 1; i < Math.min(from + 4, tracks.length); i++) {
    const candidate = tracks[i].energy ?? 0.5
    if (Math.abs(candidate - prevEnergy) < Math.abs(curr - prevEnergy)) return i
  }
  return -1
}
