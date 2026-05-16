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
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast    = useToast()

  useEffect(() => {
    Promise.all([
      api.get<BillingStatus>('/api/v1/billing/status'),
      api.get<Capabilities>('/api/v1/user/capabilities'),
      api.get<{ platforms: ConnectedPlatform[] }>('/api/v1/platforms/connected').catch(() => ({ platforms: [] })),
    ]).then(([b, c, p]) => {
      setBilling(b)
      setCaps(c)
      setPlatforms(p.platforms)
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

  const handleLogout = () => {
    clear()
    navigate('/auth', { replace: true })
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
              <p className={styles.capLabel}>of {caps.maxPlaylistsPerMonth === 9999 ? '∞' : caps.maxPlaylistsPerMonth} playlists</p>
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
                ) : (
                  <button
                    className={[styles.platformAction, styles.platformActionConnect].join(' ')}
                    onClick={() => handleConnect(platform)}
                    disabled={!!connecting}
                  >
                    {connecting === platform ? '…' : 'Connect'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Billing */}
      {billing?.plan === 'free' && billing.pricing && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Upgrade</p>
          <div className={styles.upgradeCard}>
            <div>
              <p className={styles.upgradeTitle}>Groovz Pro</p>
              <p className={styles.upgradePrice}>{billing.pricing.label}</p>
              <ul className={styles.upgradePerks}>
                <li>Unlimited playlists</li>
                <li>Up to 4 hours per playlist</li>
                <li>Multiple platforms simultaneously</li>
                <li>Weekly personalised mix</li>
              </ul>
            </div>
            <Button
              fullWidth
              onClick={() =>
                api.post<{ url: string }>('/api/v1/billing/stripe/checkout')
                  .then(r => window.location.href = r.url)
                  .catch(e => toast((e as Error).message, 'error'))
              }
            >
              Upgrade to Pro
            </Button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <Button variant="ghost" fullWidth onClick={handleLogout}>Log out</Button>
      </section>
    </div>
  )
}
