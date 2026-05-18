import type { FastifyInstance } from 'fastify'

// Augment @fastify/jwt so request.user is typed everywhere
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      type: 'access' | 'refresh' | 'oauth_state'
      email?: string
      platform?: string
    }
    user: {
      userId: string
      type: 'access' | 'refresh' | 'oauth_state'
      email?: string
      platform?: string
    }
  }
}

export function signAccessToken(userId: string, email: string, fastify: FastifyInstance): string {
  return fastify.jwt.sign({ userId, email, type: 'access' }, { expiresIn: '15m' })
}

export function signRefreshToken(userId: string, email: string, fastify: FastifyInstance): string {
  return fastify.jwt.sign({ userId, email, type: 'refresh' }, { expiresIn: '7d' })
}

export const REFRESH_COOKIE = 'groovz_refresh'
export const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,  // 7 days in seconds
}

// ─── OAuth state (CSRF protection for platform connect flow) ──────────────────

export interface OAuthStatePayload {
  userId: string
  platform: string
}

export function signOAuthState(
  userId: string,
  platform: string,
  fastify: FastifyInstance,
): string {
  return fastify.jwt.sign({ userId, platform, type: 'oauth_state' }, { expiresIn: '5m' })
}

export function verifyOAuthState(
  state: string,
  fastify: FastifyInstance,
): OAuthStatePayload {
  let payload: { userId: string; platform: string; type: string }
  try {
    payload = fastify.jwt.verify(state)
  } catch {
    throw Object.assign(new Error('Invalid or expired OAuth state'), { statusCode: 400 })
  }
  if (payload.type !== 'oauth_state') {
    throw Object.assign(new Error('Invalid OAuth state type'), { statusCode: 400 })
  }
  return { userId: payload.userId, platform: payload.platform }
}
