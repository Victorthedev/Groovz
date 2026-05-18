import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { useSocket } from '../hooks/useSocket'
import { useToast } from '../components/ui/Toast'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import Button from '../components/ui/Button'
import PlaylistResult from '../components/PlaylistResult'
import styles from './BlendJoin.module.css'

type View = 'loading' | 'auth-choice' | 'method' | 'pick-energy' | 'pick-genres' | 'pick-context' | 'describe' | 'waiting' | 'result' | 'error'

const GENRES = [
  'Electronic', 'Hip Hop', 'Indie', 'Jazz', 'Rock', 'Pop',
  'R&B', 'Soul', 'Afrobeats', 'Classical', 'Techno', 'Folk',
]

const CONTEXTS = ['Chilling', 'Driving', 'Working', 'Party']

export default function BlendJoin() {
  const { sessionId }  = useParams<{ sessionId: string }>()
  const [view, setView]                   = useState<View>('loading')
  const [hostName, setHostName]           = useState('Someone')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [isAnon, setIsAnon]               = useState(false)
  const [energy, setEnergy]               = useState(0.5)
  const [genres, setGenres]               = useState<string[]>([])
  const [context, setContext]             = useState('')
  const [describe, setDescribe]           = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [blueprintId, setBlueprintId]     = useState<string | null>(null)
  const [resultPlatform, setResultPlatform] = useState('spotify')
  const { user, accessToken }             = useAuthStore()
  const socketRef = useSocket(accessToken)
  const navigate  = useNavigate()
  const toast     = useToast()

  useEffect(() => {
    if (!sessionId) return

    const fetchSession = async () => {
      try {
        const session = await api.get<{ participants: Array<{ displayName: string }> }>(`/api/v1/blend/${sessionId}`)
        const host = session.participants[0]
        if (host) setHostName(host.displayName)

        if (accessToken) {
          // Authenticated — join directly
          const result = await api.post<{ participant: { id: string }; needsProfile: boolean }>(`/api/v1/blend/${sessionId}/join`)
          setParticipantId(result.participant.id)
          setIsAnon(false)
          setView(result.needsProfile ? 'method' : 'waiting')
        } else {
          // Not logged in — let them choose before joining
          setView('auth-choice')
        }
      } catch (e) {
        toast((e as Error).message, 'error')
        setView('error')
      }
    }

    fetchSession()
  }, [sessionId, accessToken])

  const handleGuestJoin = async () => {
    if (!sessionId) return
    try {
      const result = await api.post<{ participant: { id: string } }>(`/api/v1/blend/${sessionId}/join-anon`)
      setParticipantId(result.participant.id)
      setIsAnon(true)
      setView('method')
    } catch (e) {
      toast((e as Error).message, 'error')
      setView('error')
    }
  }

  // Listen for blend:ready (authenticated users via WebSocket)
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onReady = ({ sessionId: sid, blueprintId: bpId }: { sessionId: string; blueprintId: string }) => {
      if (sid !== sessionId) return
      setBlueprintId(bpId)
      setView('result')
    }
    const onFailed = ({ sessionId: sid }: { sessionId: string }) => {
      if (sid !== sessionId) return
      toast('Blend generation failed. Please try again.', 'error')
      setView('error')
    }

    socket.on('blend:ready', onReady)
    socket.on('blend:failed', onFailed)
    return () => { socket.off('blend:ready', onReady); socket.off('blend:failed', onFailed) }
  }, [socketRef, sessionId])

  // Anonymous users poll for result
  useEffect(() => {
    if (view !== 'waiting' || !isAnon || !sessionId) return
    const interval = setInterval(async () => {
      try {
        const session = await api.get<{ status: string; blueprintId?: string }>(`/api/v1/blend/${sessionId}`)
        if (session.status === 'complete' && session.blueprintId) {
          clearInterval(interval)
          setBlueprintId(session.blueprintId)
          setView('result')
        } else if (session.status === 'failed') {
          clearInterval(interval)
          setView('error')
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [view, isAnon, sessionId])

  const submitQuickProfile = async (fromStep: 'genres' | 'describe') => {
    if (!sessionId || !participantId) return
    setSubmitting(true)

    try {
      let genreAffinities: Record<string, number> = {}
      let tags: string[] = []

      if (fromStep === 'genres') {
        genreAffinities = Object.fromEntries(genres.map(g => [g.toLowerCase(), 0.8]))
        tags = [...genres.map(g => g.toLowerCase()), context.toLowerCase()].filter(Boolean)
      } else {
        // For "Describe it" — extract from text via a simple keyword match
        const lower = describe.toLowerCase()
        const detected = GENRES.filter(g => lower.includes(g.toLowerCase()))
        genreAffinities = Object.fromEntries(detected.map(g => [g.toLowerCase(), 0.7]))
        tags = detected.map(g => g.toLowerCase())
      }

      await api.post(`/api/v1/blend/${sessionId}/taste`, {
        participantId,
        isAnonymous: isAnon,
        profile: {
          energyCentroid: energy,
          tempoCentroid: energy,  // use same as energy for simplicity
          genreAffinities,
          tags,
        },
      })

      setView('waiting')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleGenre = (g: string) => {
    setGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 3 ? [...prev, g] : prev,
    )
  }

  if (view === 'loading') return (
    <div className={styles.page}>
      <div className={styles.waiting}>
        <FrequencyVisualiserBars mode="idle" count={12} height={24} />
      </div>
    </div>
  )

  if (view === 'error') return (
    <div className={styles.page}>
      <div className={styles.waiting}>
        <p className={styles.waitingText}>Session not found or expired.</p>
        <Button onClick={() => navigate('/')}>Go home</Button>
      </div>
    </div>
  )

  if (view === 'result') return (
    <PlaylistResult
      open
      blueprintId={blueprintId}
      platform={resultPlatform}
      onClose={() => navigate('/')}
      isBlend
      isHost={false}
    />
  )

  return (
    <div className={styles.page}>
      {/* Auth choice — shown to non-logged-in users before joining */}
      {view === 'auth-choice' && (
        <div className={styles.authChoice}>
          <div className={styles.header}>
            <h1 className={styles.heading}>{hostName} invited you to blend</h1>
            <p className={styles.subheading}>Join with an account to save the playlist, or continue as a guest.</p>
          </div>
          <div className={styles.authButtons}>
            <Button fullWidth onClick={() => navigate(`/auth?from=/blend/${sessionId}`)}>Log in</Button>
            <Button variant="secondary" fullWidth onClick={() => navigate(`/auth?from=/blend/${sessionId}`)}>Sign up</Button>
            <Button variant="ghost" fullWidth onClick={handleGuestJoin}>Continue as guest</Button>
          </div>
        </div>
      )}

      {/* Method selection */}
      {view === 'method' && (
        <>
          <div className={styles.header}>
            <h1 className={styles.heading}>{hostName} wants to blend playlists with you</h1>
            <p className={styles.subheading}>Tell us what you are feeling right now.</p>
          </div>
          <div className={styles.methods}>
            <button className={styles.methodCard} onClick={() => setView('pick-energy')}>
              <span className={styles.methodIcon}>
                <SliderIcon />
              </span>
              <span className={styles.methodLabel}>Pick your sound</span>
              <span className={styles.methodDesc}>3 quick questions. 30 seconds.</span>
            </button>
            <button className={styles.methodCard} onClick={() => setView('describe')}>
              <span className={styles.methodIcon}>
                <ChatIcon />
              </span>
              <span className={styles.methodLabel}>Describe it</span>
              <span className={styles.methodDesc}>Tell us what you want to hear.</span>
            </button>
          </div>
        </>
      )}

      {/* Step 1: Energy */}
      {view === 'pick-energy' && (
        <div className={styles.stepContent}>
          <div className={styles.dots}>
            {[0, 1, 2].map(i => <span key={i} className={[styles.dot, i === 0 ? styles.dotActive : ''].join(' ')} />)}
          </div>
          <p className={styles.stepLabel}>How energetic?</p>
          <div className={styles.sliderWrapper}>
            <input
              type="range" min={0} max={1} step={0.01}
              value={energy}
              onChange={e => setEnergy(parseFloat(e.target.value))}
              className={styles.slider}
            />
            <div className={styles.sliderLabels}><span>Low</span><span>High</span></div>
          </div>
          <Button fullWidth onClick={() => setView('pick-genres')}>Next</Button>
        </div>
      )}

      {/* Step 2: Genres */}
      {view === 'pick-genres' && (
        <div className={styles.stepContent}>
          <div className={styles.dots}>
            {[0, 1, 2].map(i => <span key={i} className={[styles.dot, i === 1 ? styles.dotActive : ''].join(' ')} />)}
          </div>
          <p className={styles.stepLabel}>Pick up to 3 genres</p>
          <div className={styles.genreGrid}>
            {GENRES.map(g => (
              <button
                key={g}
                className={[styles.genrePill, genres.includes(g) ? styles.genrePillActive : ''].join(' ')}
                onClick={() => toggleGenre(g)}
              >{g}</button>
            ))}
          </div>
          <Button fullWidth disabled={genres.length === 0} onClick={() => setView('pick-context')}>Next</Button>
          <Button variant="ghost" fullWidth onClick={() => setView('pick-energy')}>Back</Button>
        </div>
      )}

      {/* Step 3: Context */}
      {view === 'pick-context' && (
        <div className={styles.stepContent}>
          <div className={styles.dots}>
            {[0, 1, 2].map(i => <span key={i} className={[styles.dot, i === 2 ? styles.dotActive : ''].join(' ')} />)}
          </div>
          <p className={styles.stepLabel}>What are you doing?</p>
          <div className={styles.contextGrid}>
            {CONTEXTS.map(c => (
              <button
                key={c}
                className={[styles.contextCard, context === c ? styles.contextCardActive : ''].join(' ')}
                onClick={() => setContext(c)}
              >{c}</button>
            ))}
          </div>
          <Button fullWidth loading={submitting} disabled={!context} onClick={() => submitQuickProfile('genres')}>
            Done
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setView('pick-genres')}>Back</Button>
        </div>
      )}

      {/* Describe it */}
      {view === 'describe' && (
        <div className={styles.stepContent}>
          <p className={styles.stepLabel}>What kind of music are you in the mood for?</p>
          <textarea
            className={styles.chatInput}
            placeholder="Dark and driving, something with real bass..."
            value={describe}
            onChange={e => setDescribe(e.target.value)}
            maxLength={300}
          />
          <Button fullWidth loading={submitting} disabled={!describe.trim()} onClick={() => submitQuickProfile('describe')}>
            Done
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setView('method')}>Back</Button>
        </div>
      )}

      {/* Waiting */}
      {view === 'waiting' && (
        <div className={styles.waiting}>
          <FrequencyVisualiserBars mode="generating" count={12} height={32} />
          <p className={styles.waitingText}>Waiting for the blend to generate...</p>
          {!accessToken && (
            <p className={styles.waitingText} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Create a Groovz account to save this playlist.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SliderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 8h16M4 16h16M8 8v-2m0 4v-2M16 16v-2m0 4v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
