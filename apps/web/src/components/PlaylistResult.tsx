import { useEffect, useState } from 'react'
import { api } from '../api/client'
import BottomSheet from './ui/BottomSheet'
import Button from './ui/Button'
import { useToast } from './ui/Toast'
import styles from './PlaylistResult.module.css'

interface Track {
  title: string
  artist: string
  durationMs?: number
}

interface Blueprint {
  id: string
  tracks: Track[]
  totalDurationMs: number
  generationType: string
  intent?: { mood?: string[]; energy?: string }
  narrative?: string | null
  deepCuts?: boolean
}

interface ExportResult {
  platformPlaylistUrl: string
  trackCount: number
  failedTracks: number
}

interface BlendParticipant {
  id: string
  displayName: string
  isAnonymous: boolean
}

interface Props {
  open: boolean
  blueprintId: string | null
  platform: string
  onClose: () => void
  isBlend?: boolean
  isHost?: boolean
  blendParticipants?: BlendParticipant[]
}

export default function PlaylistResult({ open, blueprintId, platform, onClose, isBlend, isHost, blendParticipants }: Props) {
  const [blueprint, setBlueprint]     = useState<Blueprint | null>(null)
  const [loading, setLoading]         = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open || !blueprintId) return
    setBlueprint(null)
    setExportResult(null)
    setLoading(true)

    const tryFetch = async (retries = 8) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await api.get<Blueprint>(`/api/v1/playlists/${blueprintId}`)
          setBlueprint(res)
          return
        } catch {
          if (i < retries - 1) await delay(2000)
        }
      }
      toast('Could not load playlist. Please try again.', 'error')
    }

    tryFetch().finally(() => setLoading(false))
  }, [open, blueprintId, toast])

  const handleExport = async () => {
    if (!blueprintId) return
    setExporting(true)
    try {
      const res = await api.post<ExportResult>(`/api/v1/playlists/${blueprintId}/export`, { platform })
      setExportResult(res)
      toast('Playlist created!', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const totalMin = blueprint ? Math.round(blueprint.totalDurationMs / 60_000) : 0

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className={styles.container}>
        {loading && (
          <div className={styles.loading}>
            <p className={styles.loadingText}>Loading your playlist…</p>
          </div>
        )}

        {!loading && blueprint && (
          <>
            <div className={styles.header}>
              <div>
                <h2 className={styles.title}>
                  {blueprint.intent?.energy
                    ? `${capitalise(blueprint.intent.energy)} Energy Mix`
                    : blueprint.generationType === 'seed'
                    ? 'Your Mix'
                    : 'Vibe Mix'}
                </h2>
                <p className={styles.meta}>
                  {totalMin}m · {blueprint.tracks.length} tracks · {platform}
                  {blueprint.deepCuts && <span className={styles.deepCutsBadge}>Deep Cuts</span>}
                </p>
                {blueprint.narrative && (
                  <p className={styles.narrative}>{blueprint.narrative}</p>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              {exportResult ? (
                <a
                  href={exportResult.platformPlaylistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openBtn}
                >
                  Open in {capitalise(platform)} →
                </a>
              ) : (
                <Button fullWidth loading={exporting} onClick={handleExport}>
                  Export to {capitalise(platform)}
                </Button>
              )}
              <Button variant="secondary" fullWidth onClick={onClose}>
                {exportResult ? 'Done' : 'Dismiss'}
              </Button>
            </div>

            {exportResult && exportResult.failedTracks > 0 && (
              <p className={styles.failedNote}>
                {exportResult.failedTracks} track{exportResult.failedTracks > 1 ? 's' : ''} couldn't be matched — your playlist is slightly shorter.
              </p>
            )}

            <div className={styles.trackList}>
              {blueprint.tracks.map((t, i) => (
                <div key={i} className={styles.trackRow}>
                  <span className={styles.trackIndex}>{i + 1}</span>
                  <div className={styles.trackInfo}>
                    <p className={styles.trackTitle}>{t.title}</p>
                    <p className={styles.trackArtist}>{t.artist}</p>
                  </div>
                  {t.durationMs && (
                    <span className={styles.trackDur}>{formatMs(t.durationMs)}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function capitalise(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ') }
function formatMs(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
