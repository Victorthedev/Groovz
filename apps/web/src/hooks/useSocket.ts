import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

interface ServerToClientEvents {
  'playlist:ready':           (payload: { blueprintId: string }) => void
  'playlist:error':           (payload: { error: string }) => void
  'blend:participant_joined': (payload: { sessionId: string; participantId: string; displayName: string }) => void
  'blend:participant_left':   (payload: { sessionId: string; participantId: string }) => void
  'blend:participant_ready':  (payload: { sessionId: string; participantId: string }) => void
  'blend:generating':         (payload: { sessionId: string }) => void
  'blend:ready':              (payload: { sessionId: string; blueprintId: string }) => void
  'blend:failed':             (payload: { sessionId: string; reason: string }) => void
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export type AppSocket = Socket<ServerToClientEvents>

export function useSocket(accessToken: string | null): React.RefObject<AppSocket | null> {
  const socketRef = useRef<AppSocket | null>(null)

  useEffect(() => {
    if (!accessToken) return

    const socket: AppSocket = io(API_URL, {
      auth: { token: accessToken },
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [accessToken])

  return socketRef
}
