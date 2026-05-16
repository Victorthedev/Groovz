import { create } from 'zustand'

export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error'

interface GenerationState {
  jobId: string | null
  blueprintId: string | null
  platform: string | null
  status: GenerationStatus
  errorMessage: string | null

  start: (jobId: string, blueprintId: string, platform: string) => void
  complete: () => void
  fail: (message: string) => void
  reset: () => void
}

export const useGenerationStore = create<GenerationState>()((set) => ({
  jobId: null,
  blueprintId: null,
  platform: null,
  status: 'idle',
  errorMessage: null,

  start:    (jobId, blueprintId, platform) => set({ jobId, blueprintId, platform, status: 'generating', errorMessage: null }),
  complete: ()                             => set({ status: 'complete' }),
  fail:     (message)                      => set({ status: 'error', errorMessage: message }),
  reset:    ()                             => set({ jobId: null, blueprintId: null, platform: null, status: 'idle', errorMessage: null }),
}))
