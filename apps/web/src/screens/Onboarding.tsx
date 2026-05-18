import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/ui/Toast'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import Button from '../components/ui/Button'
import styles from './Onboarding.module.css'

const STEPS = 4
const PLATFORMS = [
  { value: 'spotify',       label: 'Spotify'       },
  { value: 'deezer',        label: 'Deezer'        },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'audiomack',     label: 'Audiomack'     },
]

export default function Onboarding() {
  const [step, setStep]                     = useState(0)
  const [connected, setConnected]           = useState<string[]>([])
  const [spotifyEnabled, setSpotifyEnabled] = useState(true)
  const [loading, setLoading]               = useState(false)
  const navigate    = useNavigate()
  const toast       = useToast()
  const [params]    = useSearchParams()

  // After OAuth redirect — mark platform as connected and return to step 1
  useEffect(() => {
    const platform = params.get('connected')
    if (platform) {
      setConnected(prev => prev.includes(platform) ? prev : [...prev, platform])
      setStep(1)
    }
  }, [])

  // Fetch already-connected platforms on mount
  useEffect(() => {
    api.get<{ platforms: Array<{ platform: string }> }>('/api/v1/platforms/connected')
      .then(res => setConnected(res.platforms.map(p => p.platform)))
      .catch(() => {})
  }, [])

  const handleConnect = async (platform: string) => {
    try {
      sessionStorage.setItem('platform_connect_source', 'onboarding')
      const res = await api.post<{ authUrl: string }>('/api/v1/platforms/connect', { platform })
      window.location.href = res.authUrl
    } catch (err) {
      sessionStorage.removeItem('platform_connect_source')
      toast((err as Error).message, 'error')
    }
  }

  const handleFinish = async () => {
    setLoading(true)
    try {
      await api.patch('/api/v1/user/preferences', {
        signalCollectionConsented: true,
        spotifySignalEnabled: spotifyEnabled,
      })
      navigate('/', { replace: true })
    } catch {
      // Don't block the user from entering the app — consent can be re-attempted later
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const next = () => setStep(s => Math.min(s + 1, STEPS - 1))

  return (
    <div className={styles.page}>
      {/* Skip button — visible on steps 0–2 only */}
      <div className={styles.header}>
        {step < STEPS - 1 && (
          <button className={styles.skipBtn} onClick={() => setStep(STEPS - 1)}>
            Skip
          </button>
        )}
      </div>

      {/* ── Step 0: Welcome ── */}
      {step === 0 && (
        <div className={styles.step}>
          <div className={styles.welcomeVisualiser}>
            <FrequencyVisualiserBars mode="idle" count={24} height={48} />
          </div>
          <h1 className={styles.welcomeHeading}>Music intelligence,{'\n'}personally yours</h1>
          <p className={styles.welcomeBody}>
            Groovz builds playlists that actually sound like you — not an algorithm's best guess. It learns your taste as you go.
          </p>
        </div>
      )}

      {/* ── Step 1: Platform connection ── */}
      {step === 1 && (
        <div className={styles.step}>
          <h2 className={styles.stepHeading}>Connect where you listen</h2>
          <p className={styles.stepBody}>Connect at least one platform to start generating playlists.</p>
          <div className={styles.platformList}>
            {PLATFORMS.map(({ value, label }) => {
              const isConnected = connected.includes(value)
              return (
                <button
                  key={value}
                  className={[styles.platformCard, isConnected ? styles.platformCardConnected : ''].join(' ')}
                  onClick={() => !isConnected && handleConnect(value)}
                  disabled={isConnected}
                >
                  <span className={styles.platformName}>{label}</span>
                  {isConnected
                    ? <span className={styles.platformStatusRow}><span className={styles.platformStatusDot} /><span className={styles.platformStatus}>Connected</span></span>
                    : <span className={styles.platformStatus}>Connect →</span>
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: WhatsApp ── */}
      {step === 2 && (
        <div className={styles.step}>
          <div className={styles.whatsappIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.5 9.5c.3.9.9 1.8 1.8 2.7.9.9 1.8 1.5 2.7 1.8l1.3-1.3c.1-.1.3-.1.4 0l2 1.3c.1.1.1.3 0 .4l-1.3 1.4c-.5.5-1.2.6-1.8.3C11.1 14.9 9.1 12.9 8.2 10.6c-.3-.6-.2-1.3.3-1.8L9.8 7.5c.1-.1.3-.1.4 0l1.3 2c.1.1.1.3 0 .4L10.2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className={styles.stepHeading}>Create playlists anywhere</h2>
          <p className={styles.stepBody}>
            Link your WhatsApp number and message Groovz from anywhere. "Long drive, something dark and fast" — done. Available on the Pro plan.
          </p>
        </div>
      )}

      {/* ── Step 3: Data consent ── */}
      {step === 3 && (
        <div className={styles.step}>
          <h2 className={styles.stepHeading}>Groovz gets better at you</h2>
          <p className={styles.consentBody}>
            Every playlist you make, every seed you pick builds a picture of your sound. After a while, Groovz starts doing things automatically — a weekly playlist that just knows you, suggestions before you ask. The more you use it, the smarter it gets.
          </p>
          <p className={styles.consentBody}>
            To make this work we collect data about what you generate and listen to. Never sold. Never shared with anyone. Just yours.
          </p>
          <div className={styles.consentToggleRow}>
            <div className={styles.consentToggleText}>
              <span className={styles.consentToggleLabel}>Include my Spotify listening history</span>
              <span className={styles.consentToggleHint}>Lets Groovz learn from what you've been playing, not just what you generate here. Recommended.</span>
            </div>
            <button
              className={[styles.toggle, spotifyEnabled ? styles.toggleOn : ''].join(' ')}
              onClick={() => setSpotifyEnabled(v => !v)}
              aria-label="Toggle Spotify listening history"
              type="button"
            >
              <span className={[styles.toggleThumb, spotifyEnabled ? styles.toggleThumbOn : ''].join(' ')} />
            </button>
          </div>
        </div>
      )}

      {/* ── Footer: dots + CTA ── */}
      <div className={styles.footer}>
        <div className={styles.dots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} className={[styles.dot, i === step ? styles.dotActive : ''].join(' ')} />
          ))}
        </div>

        {step < STEPS - 1 ? (
          <Button fullWidth onClick={next}>
            {step === 0 ? 'Get started' : 'Continue'}
          </Button>
        ) : (
          <Button fullWidth loading={loading} onClick={handleFinish}>
            Let's go
          </Button>
        )}
      </div>
    </div>
  )
}
