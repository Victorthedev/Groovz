import { create } from 'zustand'
import { api } from '../api/client'

interface PreferencesState {
  seenFeatureIntros: string[]
  loaded: boolean
  load: (intros: string[]) => void
  markSeen: (featureId: string) => void
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  seenFeatureIntros: [],
  loaded: false,

  load: (intros) => set({ seenFeatureIntros: intros, loaded: true }),

  markSeen: (featureId) => {
    const current = get().seenFeatureIntros
    if (current.includes(featureId)) return

    const updated = [...current, featureId]
    set({ seenFeatureIntros: updated })

    // Optimistic — fire and forget
    api.patch('/api/v1/user/preferences', { seenFeatureIntros: updated }).catch(() => {})
  },
}))
