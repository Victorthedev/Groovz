export interface ContextCardProfile {
  energyRange: [number, number]
  tempoRange: [number, number]
  preferInstrumental: boolean
  energyArc: 'flat' | 'rising' | 'falling' | 'peak_middle'
  preferredTags: string[]
  avoidedTags: string[]
}

export interface ContextCard {
  id: string
  label: string
  description: string
  sonicProfile: ContextCardProfile
}

export const CONTEXT_CARDS: ContextCard[] = [
  {
    id: 'pre_match',
    label: 'Pre-match warmup',
    description: 'Build to peak intensity',
    sonicProfile: {
      energyRange: [0.6, 0.9],
      tempoRange: [0.6, 0.9],
      preferInstrumental: false,
      energyArc: 'rising',
      preferredTags: ['workout', 'energetic', 'pump up', 'hip hop', 'rock'],
      avoidedTags: ['sleep', 'ambient', 'chill', 'meditation', 'classical'],
    },
  },
  {
    id: 'cant_sleep',
    label: "Can't sleep",
    description: 'Wind down slowly',
    sonicProfile: {
      energyRange: [0.05, 0.35],
      tempoRange: [0.05, 0.35],
      preferInstrumental: true,
      energyArc: 'falling',
      preferredTags: ['ambient', 'sleep', 'meditation', 'drone', 'classical'],
      avoidedTags: ['party', 'workout', 'energetic', 'dance', 'aggressive'],
    },
  },
  {
    id: 'cooking',
    label: 'Cooking for someone',
    description: 'Warm and easy',
    sonicProfile: {
      energyRange: [0.4, 0.65],
      tempoRange: [0.35, 0.6],
      preferInstrumental: false,
      energyArc: 'flat',
      preferredTags: ['soul', 'neo soul', 'jazz', 'bossa nova', 'r&b', 'funk'],
      avoidedTags: ['metal', 'hardcore', 'aggressive', 'noise', 'techno'],
    },
  },
  {
    id: 'flight',
    label: 'Flight or travel',
    description: 'Atmospheric and steady',
    sonicProfile: {
      energyRange: [0.25, 0.55],
      tempoRange: [0.2, 0.5],
      preferInstrumental: true,
      energyArc: 'flat',
      preferredTags: ['ambient', 'post rock', 'electronica', 'chillout', 'atmospheric'],
      avoidedTags: ['party', 'dance', 'workout', 'club', 'rave'],
    },
  },
  {
    id: 'running',
    label: 'Running',
    description: 'Consistent and high energy',
    sonicProfile: {
      energyRange: [0.75, 0.95],
      tempoRange: [0.7, 0.95],
      preferInstrumental: false,
      energyArc: 'flat',
      preferredTags: ['running', 'workout', 'gym', 'energetic', 'electronic', 'hip hop'],
      avoidedTags: ['sleep', 'ambient', 'chill', 'meditation', 'acoustic'],
    },
  },
  {
    id: 'getting_ready',
    label: 'Getting ready',
    description: 'Build the energy up',
    sonicProfile: {
      energyRange: [0.5, 0.85],
      tempoRange: [0.5, 0.8],
      preferInstrumental: false,
      energyArc: 'rising',
      preferredTags: ['pop', 'dance pop', 'r&b', 'hip hop', 'upbeat', 'party'],
      avoidedTags: ['sleep', 'ambient', 'sad', 'melancholic', 'acoustic'],
    },
  },
  {
    id: 'deep_focus',
    label: 'Deep focus',
    description: 'Low and uninterrupted',
    sonicProfile: {
      energyRange: [0.15, 0.45],
      tempoRange: [0.2, 0.5],
      preferInstrumental: true,
      energyArc: 'flat',
      preferredTags: ['study', 'focus', 'ambient', 'lo-fi', 'classical', 'instrumental'],
      avoidedTags: ['party', 'dance', 'energetic', 'aggressive', 'upbeat'],
    },
  },
  {
    id: 'post_workout',
    label: 'Post-workout wind down',
    description: 'Come back to earth',
    sonicProfile: {
      energyRange: [0.3, 0.75],
      tempoRange: [0.25, 0.65],
      preferInstrumental: false,
      energyArc: 'falling',
      preferredTags: ['chill', 'neo soul', 'r&b', 'downtempo', 'chillhop'],
      avoidedTags: ['workout', 'gym', 'running', 'aggressive', 'metal'],
    },
  },
]

export const CONTEXT_CARD_MAP = new Map(CONTEXT_CARDS.map(c => [c.id, c]))

// Convert a context card's energy range midpoint to intent energy string
export function energyRangeToIntent(range: [number, number]): 'low' | 'medium' | 'high' {
  const mid = (range[0] + range[1]) / 2
  if (mid < 0.35) return 'low'
  if (mid < 0.65) return 'medium'
  return 'high'
}

// Convert a context card's tempo range midpoint to intent tempo string
export function tempoRangeToIntent(range: [number, number]): 'slow' | 'medium' | 'fast' {
  const mid = (range[0] + range[1]) / 2
  if (mid < 0.35) return 'slow'
  if (mid < 0.65) return 'medium'
  return 'fast'
}
