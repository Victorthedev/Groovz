import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isLoading: boolean
  setToken: (access: string) => void
  setUser: (user: AuthUser) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isLoading: true,

      setToken:   (accessToken) => set({ accessToken }),
      setUser:    (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      clear:      () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'groovz-auth',
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
      onRehydrateStorage: () => (state) => { state?.setLoading(false) },
    },
  ),
)
