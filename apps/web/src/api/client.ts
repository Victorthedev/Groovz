import { useAuthStore } from '../store/auth'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const { accessToken, setToken, clear } = useAuthStore.getState()

  const headers: Record<string, string> = {}
  if (accessToken)        headers['Authorization']  = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type']   = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',  // sends the HTTP-only refresh cookie automatically
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Access token expired — silent refresh using the HTTP-only cookie
  if (res.status === 401) {
    const refreshRes = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',  // cookie is sent automatically, no body needed
    })

    if (refreshRes.ok) {
      const { accessToken: newToken } = await refreshRes.json() as { accessToken: string }
      setToken(newToken)

      // Retry original request with fresh token
      const retryHeaders: Record<string, string> = { Authorization: `Bearer ${newToken}` }
      if (body !== undefined) retryHeaders['Content-Type'] = 'application/json'

      const retry = await fetch(`${BASE}${path}`, {
        method,
        headers: retryHeaders,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      if (retry.status === 204) return undefined as unknown as T
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? 'Request failed')
      }
      return retry.json() as Promise<T>
    }

    // Cookie invalid or expired — full logout
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
  get:    <T>(path: string)                 => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                 => request<T>('DELETE', path),
}
