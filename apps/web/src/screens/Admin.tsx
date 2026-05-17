import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import styles from './Admin.module.css'

const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL as string | undefined

interface AdminStats {
  users: {
    total: number
    new7Days: number
    new30Days: number
    active7Days: number
    active30Days: number
  }
  playlists: {
    total: number
    last7Days: number
    last30Days: number
    avgDurationMinutes: number
    byType: Record<string, number>
    byPlatform: Record<string, number>
  }
  blend: {
    totalSessions: number
    sessions30Days: number
  }
  routes: {
    total: number
    last30Days: number
    byActivity: Record<string, number>
  }
  subscriptions: {
    paid: number
    free: number
  }
}

export default function Admin() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const [stats, setStats]     = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Guard: redirect immediately if not owner
  useEffect(() => {
    if (!OWNER_EMAIL || user?.email !== OWNER_EMAIL) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const load = useCallback(() => {
    setLoading(true)
    api.get<AdminStats>('/api/v1/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (!OWNER_EMAIL || user?.email !== OWNER_EMAIL) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <button className={styles.refreshBtn} onClick={load} aria-label="Refresh">
          <RefreshIcon />
        </button>
      </div>

      {/* Users */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Users</p>
        <div className={styles.grid}>
          <StatCard label="Total users"    value={stats?.users.total}        loading={loading} />
          <StatCard label="New (7 days)"   value={stats?.users.new7Days}     loading={loading} />
          <StatCard label="New (30 days)"  value={stats?.users.new30Days}    loading={loading} />
          <StatCard label="Active (7 days)"  value={stats?.users.active7Days}  loading={loading} sub="1+ playlist" />
          <StatCard label="Active (30 days)" value={stats?.users.active30Days} loading={loading} sub="1+ playlist" />
        </div>
      </div>

      {/* Playlists */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Playlists</p>
        <div className={styles.grid}>
          <StatCard label="All time"      value={stats?.playlists.total}              loading={loading} />
          <StatCard label="Last 7 days"   value={stats?.playlists.last7Days}          loading={loading} />
          <StatCard label="Last 30 days"  value={stats?.playlists.last30Days}         loading={loading} />
          <StatCard label="Avg duration"  value={stats ? `${stats.playlists.avgDurationMinutes}m` : undefined} loading={loading} />
        </div>
      </div>

      {/* Generation breakdown */}
      {stats && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Generation type</p>
          <BarChart data={stats.playlists.byType} />
        </div>
      )}

      {/* Platform distribution */}
      {stats && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Platform</p>
          <BarChart data={stats.playlists.byPlatform} />
        </div>
      )}

      {/* Session Blend */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Session Blend</p>
        <div className={styles.grid}>
          <StatCard label="All time"    value={stats?.blend.totalSessions}  loading={loading} />
          <StatCard label="Last 30 days" value={stats?.blend.sessions30Days} loading={loading} />
        </div>
      </div>

      {/* Routes — zeros until v3 */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Routes (v3)</p>
        <div className={styles.grid}>
          <StatCard label="All time"    value={stats?.routes.total}      loading={loading} />
          <StatCard label="Last 30 days" value={stats?.routes.last30Days} loading={loading} />
          <StatCard label="Drive"  value={stats?.routes.byActivity.drive}  loading={loading} />
          <StatCard label="Walk"   value={stats?.routes.byActivity.walk}   loading={loading} />
          <StatCard label="Jog"    value={stats?.routes.byActivity.jog}    loading={loading} />
          <StatCard label="Cycle"  value={stats?.routes.byActivity.cycle}  loading={loading} />
        </div>
      </div>

      {/* Subscriptions */}
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Subscriptions</p>
        <div className={styles.grid}>
          <StatCard label="Paid users" value={stats?.subscriptions.paid} loading={loading} />
          <StatCard label="Free users" value={stats?.subscriptions.free} loading={loading} />
        </div>
      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, loading, sub }: {
  label: string
  value: number | string | undefined
  loading: boolean
  sub?: string
}) {
  return (
    <div className={styles.card}>
      <p className={styles.cardLabel}>{label}</p>
      {loading && value === undefined
        ? <div className={styles.cardValueSkeleton} />
        : <p className={styles.cardValue}>{value ?? '—'}</p>
      }
      {sub && <p className={styles.cardSub}>{sub}</p>}
    </div>
  )
}

function BarChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)
  if (total === 0) return <p className={styles.barPct}>No data yet</p>

  return (
    <div className={styles.barChart}>
      {Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={key} className={styles.barRow}>
              <div className={styles.barMeta}>
                <span className={styles.barLabel}>{key.replace('_', ' ')}</span>
                <span className={styles.barCount}>{count}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.barPct}>{pct}%</span>
            </div>
          )
        })}
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
