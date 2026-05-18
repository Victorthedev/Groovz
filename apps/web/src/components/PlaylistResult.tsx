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
                  {isBlend
                    ? 'Your Blend'
                    : blueprint.intent?.energy
                    ? `${capitalise(blueprint.intent.energy)} Energy Mix`
                    : blueprint.generationType === 'seed'
                    ? 'Your Mix'
                    : 'Vibe Mix'}
                </h2>
                <p className={styles.meta}>
                  {totalMin}m · {blueprint.tracks.length} tracks · {platform}
                  {blueprint.deepCuts && <span className={styles.deepCutsBadge}>Deep Cuts</span>}
                </p>
                {isBlend && blendParticipants && blendParticipants.length > 1 && (
                  <div className={styles.blendMeta}>
                    {blendParticipants.map(p => (
                      <span key={p.id} className={styles.blendCircle}>{p.displayName}</span>
                    ))}
                    <span className={styles.blendWith}>
                      Blended with {blendParticipants.slice(1).map(p => p.displayName).join(', ')}
                    </span>
                  </div>
                )}
                {blueprint.narrative && (
                  <p className={styles.narrative}>{blueprint.narrative}</p>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              {exportResult ? (
                <>
                  <a
                    href={exportResult.platformPlaylistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.openBtn}
                  >
                    Open in {capitalise(platform)} →
                  </a>
                  {isBlend && isHost && platform === 'spotify' && (
                    <a
                      href={exportResult.platformPlaylistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.jamBtn}
                    >
                      <SpotifyIcon />
                      Start a Jam
                    </a>
                  )}
                </>
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

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.077-.496 9.712 1.115.294.18.387.565.207.857zm1.223-2.723a.779.779 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.779.779 0 01-.973-.519.779.779 0 01.519-.973c3.632-1.102 8.147-.568 11.234 1.329.37.227.484.71.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.935.935 0 01-.955 1.608z"/>
    </svg>
  )
}
