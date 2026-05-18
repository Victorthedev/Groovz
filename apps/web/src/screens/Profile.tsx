import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { useToast } from '../components/ui/Toast'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import styles from './Profile.module.css'

interface BillingStatus {
  plan: 'free' | 'paid'
  pricing: { label: string; currency: string } | null
  stripe: { status: string; currentPeriodEnd: string } | null
}

interface Capabilities {
  maxPlaylistDurationMinutes: number
  maxPlaylistsPerMonth: number
  playlistsGeneratedThisMonth: number
  canUseRouteFeature: boolean
  canUseWhatsapp: boolean
}

interface ConnectedPlatform {
  platform: string
  connectedAt: string
}

const PLATFORM_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  deezer: 'Deezer',
  audiomack: 'Audiomack',
  youtube_music: 'YouTube Music',
}

export default function Profile() {
  const { user, clear }           = useAuthStore()
  const [billing, setBilling]     = useState<BillingStatus | null>(null)
  const [caps, setCaps]           = useState<Capabilities | null>(null)
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([])
  const [spotifyEnabled, setSpotifyEnabled] = useState<boolean | null>(null)
  const [connecting, setConnecting]       = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const navigate = useNavigate()
  const toast    = useToast()

  useEffect(() => {
    Promise.all([
      api.get<BillingStatus>('/api/v1/billing/status'),
      api.get<Capabilities>('/api/v1/user/capabilities'),
      api.get<{ platforms: ConnectedPlatform[] }>('/api/v1/platforms/connected').catch(() => ({ platforms: [] })),
      api.get<{ spotifySignalEnabled: boolean }>('/api/v1/user/preferences'),
    ]).then(([b, c, p, prefs]) => {
      setBilling(b)
      setCaps(c)
      setPlatforms(p.platforms)
      setSpotifyEnabled(prefs.spotifySignalEnabled)
    }).catch(() => {})
  }, [])

  const handleConnect = async (platform: string) => {
    setConnecting(platform)
    try {
      const res = await api.post<{ authUrl: string }>('/api/v1/platforms/connect', { platform })
      window.location.href = res.authUrl
    } catch (e) {
      toast((e as Error).message, 'error')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      await api.delete(`/api/v1/platforms/${platform}`)
      setPlatforms(prev => prev.filter(p => p.platform !== platform))
      toast(`${PLATFORM_LABELS[platform] ?? platform} disconnected`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleToggleSpotifySignals = async () => {
    const next = !spotifyEnabled
    setSpotifyEnabled(next)
    try {
      await api.patch('/api/v1/user/preferences', { spotifySignalEnabled: next })
    } catch {
      setSpotifyEnabled(!next)
      toast('Could not update preference', 'error')
    }
  }

  const handleLogout = async () => {
    await api.post('/api/v1/auth/logout').catch(() => {})
    clear()
    navigate('/auth', { replace: true })
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/api/v1/auth/account')
      clear()
      navigate('/auth', { replace: true })
    } catch (err) {
      toast((err as Error).message, 'error')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  const isConnected = (platform: string) => platforms.some(p => p.platform === platform)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Profile</h1>

      {/* Account section */}
      <section className={styles.section}>
        <div className={styles.accountRow}>
          <div className={styles.avatar}>{initial}</div>
          <div className={styles.accountInfo}>
            <p className={styles.email}>{user?.email}</p>
            <Badge variant={billing?.plan === 'paid' ? 'plan-paid' : 'plan-free'}>
              {billing?.plan === 'paid' ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      {caps && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Usage this month</p>
          <div className={styles.capsRow}>
            <div className={styles.capItem}>
              <p className={styles.capValue}>{caps.playlistsGeneratedThisMonth}</p>
              <p className={styles.capLabel}>playlists generated</p>
            </div>
            <div className={styles.capItem}>
              <p className={styles.capValue}>{caps.maxPlaylistDurationMinutes}m</p>
              <p className={styles.capLabel}>max duration</p>
            </div>
          </div>
        </section>
      )}

      {/* Connected platforms */}
      <section className={styles.section}>
        <p className={styles.sectionTitle}>Connected platforms</p>
        <div className={styles.platformList}>
          {(['spotify', 'deezer', 'audiomack', 'youtube_music'] as string[]).map(platform => {
            const connected = isConnected(platform)
            return (
              <div key={platform} className={styles.platformRow}>
                <div className={styles.platformLeft}>
                  <span className={[styles.platformDot, connected ? styles.platformDotConnected : ''].join(' ')} />
                  <span className={styles.platformName}>{PLATFORM_LABELS[platform]}</span>
                  {connected && <span className={styles.platformStatus}>Connected</span>}
                </div>
                {connected ? (
                  <button
                    className={styles.platformAction}
                    onClick={() => handleDisconnect(platform)}
                    disabled={disconnecting === platform}
                  >
                    {disconnecting === platform ? '…' : 'Disconnect'}
                  </button>
                ) : platform === 'spotify' ? (
                  <button
                    className={[styles.platformAction, styles.platformActionConnect].join(' ')}
                    onClick={() => handleConnect(platform)}
                    disabled={!!connecting}
                  >
                    {connecting === platform ? '…' : 'Connect'}
                  </button>
                ) : (
                  <span className={styles.platformComingSoon}>Coming soon</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Spotify signal collection toggle — fulfils the withdrawal right in the Privacy Policy */}
        {isConnected('spotify') && spotifyEnabled !== null && (
          <div className={styles.signalToggleRow}>
            <div className={styles.signalToggleInfo}>
              <p className={styles.signalToggleLabel}>Include my Spotify listening history</p>
              <p className={styles.signalToggleSub}>Lets Groovz learn from what you've been playing</p>
            </div>
            <button
              className={[styles.signalToggle, spotifyEnabled ? styles.signalToggleOn : ''].join(' ')}
              onClick={handleToggleSpotifySignals}
              role="switch"
              aria-checked={spotifyEnabled}
              aria-label="Toggle Spotify listening history"
            >
              <span className={styles.signalToggleThumb} />
            </button>
          </div>
        )}
      </section>

      {/* Billing — commented out until monetisation is ready
      {billing?.plan === 'free' && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Upgrade</p>
          <div className={styles.upgradeCard}>
            <p className={styles.upgradeTitle}>Groovz Pro</p>
            {billing.pricing && (
              <p className={styles.upgradePrice}>{billing.pricing.label}</p>
            )}
            <ul className={styles.upgradePerks}>
              <li>Up to 4 hours per playlist</li>
              <li>Multiple platforms simultaneously</li>
              <li>WhatsApp bot, generate playlists from anywhere</li>
              <li>Road Trip, routes and playlists built around each other</li>
              <li>Drive Chapters, a distinct sound for each stretch</li>
              <li>Weekly personalised mix that updates automatically</li>
              <li>Moment Playlists, suggestions that know the time and day</li>
              <li>Context Cards personalised to your listening history</li>
            </ul>
            <div className={styles.comingSoon}>Coming Soon</div>
          </div>
        </section>
      )}
      */}

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Your taste</p>
        <button className={styles.tasteRow} onClick={() => navigate('/taste-card')}>
          <span className={styles.tasteRowLabel}>Share Your Taste</span>
          <span className={styles.tasteRowChevron}>›</span>
        </button>
      </section>

      <section className={styles.section}>
        <a href="mailto:ubahakweemeka@gmail.com" className={styles.contactLink}>Contact support</a>
        <Button variant="ghost" fullWidth onClick={handleLogout}>Log out</Button>
        <button className={styles.deleteBtn} onClick={() => setShowDeleteModal(true)}>
          Delete account
        </button>
      </section>

      <div className={styles.legalLinks}>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>Privacy Policy</a>
        <span className={styles.legalDot}>·</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>Terms of Service</a>
      </div>

      {showDeleteModal && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setShowDeleteModal(false)} />
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Delete your account?</h2>
            <p className={styles.modalBody}>
              This permanently deletes your account, all your playlists and your listening history. There is no undo.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalDelete}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                className={styles.modalCancel}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
