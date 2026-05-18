import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import PlaylistResult from '../components/PlaylistResult'
import styles from './Library.module.css'

type Filter = 'all' | 'playlists' | 'road-trips'

interface HistoryItem {
  id: string
  platform: string
  generationType: string
  seedTrackTitle: string | null
  seedTrackArtist: string | null
  promptSummary: string | null
  narrative: string | null
  durationMinutes: number
  trackCount: number
  platformPlaylistUrl: string | null
  createdAt: string
}

export default function Library() {
  const [filter, setFilter]   = useState<Filter>('all')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HistoryItem | null>(null)

  useEffect(() => {
    api.get<{ playlists: HistoryItem[] }>('/api/v1/playlists/history')
      .then(r => setHistory(r.playlists))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = history.filter(p => {
    if (filter === 'playlists') return p.generationType !== 'weekly_ml'
    if (filter === 'road-trips') return false // v3
    return true
  })

  return (
    <>
      <div className={styles.page}>
        <h1 className={styles.title}>Library</h1>

        {/* Filter pills */}
        <div className={styles.filters}>
          {(['all', 'playlists', 'road-trips'] as Filter[]).map(f => (
            <button
              key={f}
              className={[styles.filterPill, filter === f ? styles.filterActive : ''].join(' ')}
              onClick={() => setFilter(f)}
            >
              {f === 'road-trips' ? 'Road Trips' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className={styles.empty}>
            <p className={styles.emptyBody}>Loading…</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <FrequencyVisualiserBars mode="idle" count={12} height={32} dim />
            <h2 className={styles.emptyTitle}>No playlists yet</h2>
            <p className={styles.emptyBody}>Generate your first one from the home tab</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className={styles.list}>
            {filtered.map(pl => (
              <button key={pl.id} className={styles.card} onClick={() => setSelected(pl)}>
                <div className={styles.cardIcon}>
                  <FrequencyVisualiserBars mode="idle" count={3} height={16} />
                </div>
                <div className={styles.cardContent}>
                  <p className={styles.cardTitle}>
                    {pl.seedTrackTitle
                      ? `${pl.seedTrackTitle} Mix`
                      : pl.promptSummary
                      ? pl.promptSummary
                      : 'Generated Mix'}
                  </p>
                  <p className={styles.cardMeta}>
                    {pl.platform} · {pl.durationMinutes}m · {pl.trackCount} tracks · {formatDate(pl.createdAt)}
                  </p>
                  {pl.narrative && (
                    <p className={styles.cardNarrative}>{pl.narrative}</p>
                  )}
                </div>
                <ChevronIcon />
              </button>
            ))}
          </div>
        )}
      </div>

      <PlaylistResult
        open={!!selected}
        blueprintId={selected?.id ?? null}
        platform={selected?.platform ?? 'spotify'}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
