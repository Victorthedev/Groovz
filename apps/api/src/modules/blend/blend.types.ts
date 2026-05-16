export interface BlendParticipant {
  id: string
  userId?: string
  displayName: string  // single letter from email, or 'G' for guests
  isAnonymous: boolean
  hasProfile: boolean
  joinedAt: number
}

export interface BlendSession {
  id: string
  hostUserId: string
  expiresAt: number
  participants: BlendParticipant[]
  status: 'waiting' | 'generating' | 'complete' | 'failed'
  blueprintId?: string
  failReason?: string
}

export interface SessionTasteProfile {
  sessionId: string
  participantId: string
  isAnonymous: boolean
  energyCentroid: number
  tempoCentroid: number
  genreAffinities: Record<string, number>  // genre → weight 0.0-1.0
  tags: string[]
}
