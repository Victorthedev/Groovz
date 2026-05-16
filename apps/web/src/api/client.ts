import { useAuthStore } from '../store/auth'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const { accessToken, refreshToken, setTokens, clear } = useAuthStore.getState()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Access token expired — try a silent refresh
  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (refreshRes.ok) {
      const tokens = await refreshRes.json() as { accessToken: string; refreshToken: string }
      setTokens(tokens.accessToken, tokens.refreshToken)

      // Retry original request with the fresh token
      const retry = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      if (retry.status === 204) return undefined as unknown as T
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? 'Request failed')
      }
      return retry.json() as Promise<T>
    }

    // Refresh token also invalid — session fully expired
    clear()
    window.location.replace('/auth')
    throw new Error('Session expired')
  }

  if (res.status === 204) return undefined as unknown as T

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(err.message ?? err.error ?? 'Request failed')
  }

  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                    => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)    => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown)    => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                    => request<T>('DELETE', path),
}
