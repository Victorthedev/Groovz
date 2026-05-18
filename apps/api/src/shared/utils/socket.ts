import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'

// ─── Event payload types (server → client) ────────────────────────────────────

export interface ServerToClientEvents {
  'playlist:ready': (payload: { blueprintId: string }) => void
  'playlist:error': (payload: { error: string }) => void
  'blend:participant_joined': (payload: { sessionId: string; participantId: string; displayName: string }) => void
  'blend:participant_left':   (payload: { sessionId: string; participantId: string }) => void
  'blend:participant_ready':  (payload: { sessionId: string; participantId: string }) => void
  'blend:generating':         (payload: { sessionId: string }) => void
  'blend:ready':              (payload: { sessionId: string; blueprintId: string }) => void
  'blend:failed':             (payload: { sessionId: string; reason: string }) => void
}

export interface ClientToServerEvents {
  // clients are listeners only for now
}

export interface SocketData {
  userId: string
}

// ─── Singleton ────────────────────────────────────────────────────────────────

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

let io: IoServer | null = null

type VerifyFn = (token: string) => { userId: string; type: string }

export function createSocketServer(httpServer: HttpServer, verify: VerifyFn): IoServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    {
      cors: {
        origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
        credentials: true,
      },
    },
  )

  // JWT auth — reject connections without a valid access token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('Unauthorized'))
    try {
      const payload = verify(token)
      if (payload.type !== 'access') return next(new Error('Unauthorized'))
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  // Each connected user joins their own room — only they receive their events
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`)
  })

  return io
}

export function getIO(): IoServer {
  if (!io) throw new Error('Socket.io server not initialised — call createSocketServer first')
  return io
}
