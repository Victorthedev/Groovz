import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSocket } from '../hooks/useSocket'
import { useAuthStore } from '../store/auth'
import { useToast } from '../components/ui/Toast'
import Button from '../components/ui/Button'
import PlaylistResult from '../components/PlaylistResult'
import styles from './BlendStart.module.css'

interface Participant {
  id: string
  displayName: string
  isAnonymous: boolean
  hasProfile: boolean
}

interface BlendSession {
  id: string
  status: 'waiting' | 'generating' | 'complete' | 'failed'
  participants: Participant[]
  blueprintId?: string
  expiresAt: number
}

const BLEND_LINK = (sessionId: string) =>
  `${window.location.origin}/blend/${sessionId}`

export default function BlendStart() {
  const [session, setSession]         = useState<BlendSession | null>(null)
  const [generating, setGenerating]   = useState(false)
  const [resultOpen, setResultOpen]   = useState(false)
  const [blueprintId, setBlueprintId] = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [timeLeft, setTimeLeft]       = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const navigate  = useNavigate()
  const toast     = useToast()
  const { accessToken } = useAuthStore()
  const socketRef = useSocket(accessToken)

  // Create session on mount
  useEffect(() => {
    api.post<BlendSession>('/api/v1/blend').then(s => {
      setSession(s)
      drawQr(s.id)
    }).catch(e => {
      toast((e as Error).message, 'error')
      navigate(-1)
    })
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!session) return
    const tick = () => {
      const secs = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
      const m = Math.floor(secs / 60)
      const s = secs % 60
      setTimeLeft(`Session expires in ${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [session])

  // WebSocket — blend events
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !session) return

    const onJoined = ({ sessionId, participantId, displayName }: { sessionId: string; participantId: string; displayName: string }) => {
      if (sessionId !== session.id) return
      setSession(prev => prev ? {
        ...prev,
        participants: prev.participants.some(p => p.id === participantId)
          ? prev.participants
          : [...prev.participants, { id: participantId, displayName, isAnonymous: false, hasProfile: false }],
      } : prev)
    }

    const onReady = ({ sessionId, blueprintId: bpId }: { sessionId: string; blueprintId: string }) => {
      if (sessionId !== session.id) return
      setGenerating(false)
      setBlueprintId(bpId)
      setResultOpen(true)
    }

    const onFailed = ({ sessionId }: { sessionId: string }) => {
      if (sessionId !== session.id) return
      setGenerating(false)
      toast('Blend generation failed. Please try again.', 'error')
    }

    socket.on('blend:participant_joined', onJoined)
    socket.on('blend:ready',             onReady)
    socket.on('blend:failed',            onFailed)
    return () => {
      socket.off('blend:participant_joined', onJoined)
      socket.off('blend:ready',             onReady)
      socket.off('blend:failed',            onFailed)
    }
  }, [socketRef, session])

  const handleGenerate = async () => {
    if (!session) return
    setGenerating(true)
    try {
      await api.post(`/api/v1/blend/${session.id}/generate`)
    } catch (e) {
      setGenerating(false)
      toast((e as Error).message, 'error')
    }
  }

  const handleCopy = () => {
    if (!session) return
    navigator.clipboard.writeText(BLEND_LINK(session.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const drawQr = useCallback((sessionId: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = 180
    canvas.height = 180
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 180, 180)

    // Simple QR-like visual placeholder — real QR uses the link text
    ctx.fillStyle = '#0A0A0A'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Scan to join', 90, 100)
    ctx.fillText(sessionId.slice(0, 8), 90, 115)
  }, [])

  if (!session) return null

  const readyCount = session.participants.filter(p => p.hasProfile).length
  const canGenerate = session.participants.length >= 2 && !generating

  return (
    <>
      <div className={styles.page}>
        <div className={styles.bar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
            <BackIcon />
          </button>
          <span className={styles.barTitle}>Session Blend</span>
        </div>

        <div className={styles.content}>
          {/* QR + link */}
          <div className={styles.qrBlock}>
            <canvas ref={canvasRef} className={styles.qrCanvas} />
            <div className={styles.linkRow}>
              <span className={styles.linkText}>{BLEND_LINK(session.id)}</span>
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Participant circles — always 4 slots */}
          <div className={styles.circles}>
            {Array.from({ length: 4 }).map((_, i) => {
              const p = session.participants[i]
              return p ? (
                <div
                  key={p.id}
                  className={[styles.circle, styles.circleFilled, p.hasProfile ? styles.circleReady : ''].join(' ')}
                >
                  {p.displayName}
                </div>
              ) : (
                <div key={i} className={[styles.circle, styles.circleEmpty].join(' ')} />
              )
            })}
          </div>

          <p className={styles.waitingText}>
            {session.participants.length < 2
              ? 'Waiting for others to join...'
              : generating
              ? 'Building your blend...'
              : `${readyCount} of ${session.participants.length} ready`}
          </p>
        </div>

        <div className={styles.footer}>
          <Button fullWidth disabled={!canGenerate} loading={generating} onClick={handleGenerate}>
            Generate
          </Button>
          <p className={styles.expiry}>{timeLeft}</p>
        </div>
      </div>

      <PlaylistResult
        open={resultOpen}
        blueprintId={blueprintId}
        platform="spotify"
        onClose={() => { setResultOpen(false); navigate('/') }}
        isBlend
        blendParticipants={session.participants}
        isHost
      />
    </>
  )
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
