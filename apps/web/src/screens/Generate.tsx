import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useGenerationStore } from '../store/generation'
import { useToast } from '../components/ui/Toast'
import { FrequencyVisualiserCanvas, FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import Button from '../components/ui/Button'
import { Textarea } from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import PlaylistResult from '../components/PlaylistResult'
import styles from './Generate.module.css'

type GenType  = 'seed' | 'prompt' | 'hybrid'
type Platform = 'spotify' | 'deezer' | 'audiomack' | 'youtube_music'
type Energy   = 'low' | 'medium' | 'high'
type Tempo    = 'slow' | 'medium' | 'fast'

const CONTEXT_CARDS = [
  { id: 'pre_match',     label: 'Pre-match warmup',     description: 'Build to peak intensity' },
  { id: 'cant_sleep',    label: "Can't sleep",           description: 'Wind down slowly'        },
  { id: 'cooking',       label: 'Cooking for someone',   description: 'Warm and easy'            },
  { id: 'flight',        label: 'Flight or travel',      description: 'Atmospheric and steady'   },
  { id: 'running',       label: 'Running',               description: 'Consistent and high energy' },
  { id: 'getting_ready', label: 'Getting ready',         description: 'Build the energy up'     },
  { id: 'deep_focus',    label: 'Deep focus',            description: 'Low and uninterrupted'   },
  { id: 'post_workout',  label: 'Post-workout wind down', description: 'Come back to earth'     },
]

interface LibraryTrack {
  displayId: string
  title: string
  artist: string
  artworkUrl: string
}

interface LibraryPlaylist {
  displayPlaylistId: string
  name: string
  trackCount: number
  artworkUrl: string
}

const PROMPTS = [
  'What do you want to feel?',
  'Where are you going?',
  "What's the vibe tonight?",
  'Set the scene.',
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'spotify',       label: 'Spotify'       },
  { value: 'deezer',        label: 'Deezer'        },
  { value: 'audiomack',     label: 'Audiomack'     },
  { value: 'youtube_music', label: 'YouTube Music' },
]

const DURATIONS = [30, 60, 90, 120]

export default function Generate() {
  const [takeover, setTakeover]     = useState(false)
  const [step, setStep]             = useState<'type' | 'inputs' | 'options'>('type')
  const [genType, setGenType]       = useState<GenType>('seed')
  const [platform, setPlatform]     = useState<Platform>('spotify')
  const [duration, setDuration]     = useState(60)
  const [prompt, setPrompt]         = useState('')
  const [energy, setEnergy]           = useState<Energy | ''>('')
  const [tempo, setTempo]             = useState<Tempo | ''>('')
  const [contextCard, setContextCard] = useState<string | null>(null)
  const [contextOpen, setContextOpen] = useState(false)
  const [deepCuts, setDeepCuts]       = useState(false)
  const [seedTrack, setSeedTrack]   = useState<LibraryTrack | null>(null)
  const [library, setLibrary]       = useState<LibraryTrack[]>([])
  const [playlists, setPlaylists]   = useState<LibraryPlaylist[]>([])
  const [libraryTab, setLibraryTab] = useState<'tracks' | 'playlists'>('tracks')
  const [playlistTracks, setPlaylistTracks] = useState<LibraryTrack[]>([])
  const [loadingLib, setLoadingLib]       = useState(false)
  const [generatingNow, setGeneratingNow] = useState(false)
  const [promptIdx, setPromptIdx]         = useState(0)
  const [resultOpen, setResultOpen]       = useState(false)
  const [history, setHistory]             = useState<HistoryItem[]>([])

  const generation = useGenerationStore()
  const toast      = useToast()

  // Cycle prompt text
  useEffect(() => {
    const t = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 4000)
    return () => clearInterval(t)
  }, [])

  // Fetch recent history for the strip
  useEffect(() => {
    api.get<{ playlists: HistoryItem[] }>('/api/v1/playlists/history')
      .then(r => setHistory(r.playlists.slice(0, 5)))
      .catch(() => {})
  }, [])

  // Open result when generation completes
  useEffect(() => {
    if (generation.status === 'complete' && takeover) {
      const t = setTimeout(() => setResultOpen(true), 600)
      return () => clearTimeout(t)
    }
  }, [generation.status, takeover])

  const fetchLibrary = useCallback(async () => {
    setLoadingLib(true)
    try {
      const res = await api.get<{ tracks: LibraryTrack[]; playlists: LibraryPlaylist[] }>(
        `/api/v1/platforms/library?platform=${platform}`,
      )
      setLibrary(res.tracks)
      setPlaylists(res.playlists)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingLib(false)
    }
  }, [platform, toast])

  const fetchPlaylistTracks = async (displayPlaylistId: string) => {
    setLoadingLib(true)
    try {
      const res = await api.get<{ tracks: LibraryTrack[] }>(
        `/api/v1/platforms/library?platform=${platform}&playlistId=${displayPlaylistId}`,
      )
      setPlaylistTracks(res.tracks)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingLib(false)
    }
  }

  const openTakeover = () => {
    setStep('type')
    setSeedTrack(null)
    setPrompt('')
    setEnergy('')
    setTempo('')
    setContextCard(null)
    setContextOpen(false)
    setDeepCuts(false)
    setTakeover(true)
  }

  const handleGenerate = async () => {
    if (genType !== 'prompt' && !seedTrack) { toast('Pick a seed track first', 'error'); return }
    if (genType !== 'seed' && !prompt.trim()) { toast('Enter a prompt first', 'error'); return }

    setGeneratingNow(true)
    try {
      const body: Record<string, unknown> = { type: genType, platform, intent: { durationMinutes: duration } }
      if (seedTrack)     body['seedDisplayId'] = seedTrack.displayId
      if (prompt.trim()) body['prompt']         = prompt.trim()
      if (energy)        (body['intent'] as Record<string, unknown>)['energy'] = energy
      if (tempo)         (body['intent'] as Record<string, unknown>)['tempo']  = tempo
      if (contextCard)   body['contextCardId']  = contextCard
      if (deepCuts)      body['deepCuts']       = true

      const res = await api.post<{ jobId: string; blueprintId: string }>('/api/v1/playlists/generate', body)
      generation.start(res.jobId, res.blueprintId, platform)
      setStep('type')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setGeneratingNow(false)
    }
  }

  const isGenerating = generation.status === 'generating'
  const isComplete   = generation.status === 'complete'

  return (
    <>
      {/* ─── Home screen ───────────────────────────────────────────────────── */}
      <div className={styles.page}>
        <div className={styles.wordmarkRow}>
          <span className={styles.wordmark}>Groovz</span>
        </div>

        <div className={styles.hero} onClick={openTakeover}>
          <FrequencyVisualiserCanvas
            mode={isGenerating ? 'generating' : 'idle'}
            className={styles.heroVis}
          />
          <p className={styles.prompt} key={promptIdx}>{PROMPTS[promptIdx]}</p>
        </div>

        <div className={styles.ctaRow}>
          <button className={styles.ctaCard} onClick={openTakeover}>
            <FrequencyVisualiserBars mode="idle" count={3} height={16} />
            <span className={styles.ctaLabel}>Playlist</span>
          </button>
          <button className={styles.ctaCard} disabled>
            <span className={styles.ctaLabel}>Road Trip</span>
            <Badge variant="premium">Pro</Badge>
          </button>
        </div>

        {/* Recent strip */}
        {history.length > 0 && (
          <div className={styles.recentSection}>
            <p className={styles.recentLabel}>Recent</p>
            <div className={styles.recentStrip}>
              {history.map(pl => (
                <button
                  key={pl.id}
                  className={styles.recentCard}
                  onClick={() => {
                    generation.start('', pl.id, pl.platform)
                    generation.complete()
                    setResultOpen(true)
                  }}
                >
                  <p className={styles.recentTitle}>{pl.seedTrackTitle ?? pl.promptSummary ?? 'Mix'}</p>
                  <p className={styles.recentMeta}>{pl.durationMinutes}m · {pl.trackCount} tracks</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Full-screen generation takeover ───────────────────────────────── */}
      {takeover && (
        <div className={styles.takeover}>
          {/* Top bar */}
          <div className={styles.takeoverBar}>
            <button
              className={styles.backBtn}
              onClick={() => { if (!isGenerating) setTakeover(false) }}
              aria-label="Go back"
            >
              <BackIcon />
            </button>
            <span className={styles.takeoverTitle}>New Playlist</span>
            <span style={{ width: 44 }} />
          </div>

          {/* Generation state */}
          {isGenerating && (
            <div className={styles.generatingState}>
              <FrequencyVisualiserCanvas mode="generating" className={styles.generatingVis} />
              <div className={styles.generatingText}>
                <p className={styles.generatingStatus}>Building your playlist</p>
                <p className={styles.generatingHint}>Finding the right sounds…</p>
              </div>
            </div>
          )}

          {isComplete && !resultOpen && (
            <div className={styles.generatingState}>
              <FrequencyVisualiserCanvas mode="complete" className={styles.generatingVis} />
              <p className={styles.generatingStatus}>Your playlist is ready</p>
            </div>
          )}

          {!isGenerating && !isComplete && (
            <div className={styles.takeoverContent}>
              {/* Step: type selector */}
              {step === 'type' && (
                <div className={styles.stepSection}>
                  <p className={styles.stepLabel}>How would you like to generate?</p>
                  <div className={styles.typeCards}>
                    {([
                      { value: 'seed',   label: 'Pick a seed track', icon: '♫' },
                      { value: 'prompt', label: 'Describe a vibe',   icon: '✍' },
                      { value: 'hybrid', label: 'Both',              icon: '⊕' },
                    ] as { value: GenType; label: string; icon: string }[]).map(({ value, label, icon }) => (
                      <button
                        key={value}
                        className={[styles.typeCard, genType === value ? styles.typeCardActive : ''].join(' ')}
                        onClick={() => setGenType(value)}
                      >
                        <span className={styles.typeIcon}>{icon}</span>
                        <span className={styles.typeLabel}>{label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Deep Cuts toggle */}
                  <div className={styles.modeToggle}>
                    <button
                      className={[styles.modeBtn, !deepCuts ? styles.modeBtnActive : ''].join(' ')}
                      onClick={() => setDeepCuts(false)}
                      type="button"
                    >Standard</button>
                    <button
                      className={[styles.modeBtn, deepCuts ? styles.modeBtnActive : ''].join(' ')}
                      onClick={() => setDeepCuts(true)}
                      type="button"
                    >Deep Cuts</button>
                  </div>
                  {deepCuts && (
                    <p className={styles.deepCutsHint}>
                      Tracks you have never heard but will immediately connect with.
                    </p>
                  )}

                  {/* Context cards */}
                  <div className={styles.contextSection}>
                    <button
                      className={styles.contextToggle}
                      onClick={() => setContextOpen(o => !o)}
                      type="button"
                    >
                      <span className={styles.contextToggleLabel}>
                        {contextCard
                          ? CONTEXT_CARDS.find(c => c.id === contextCard)?.label
                          : 'Add context'}
                      </span>
                      <ChevronDownIcon open={contextOpen} />
                    </button>

                    {contextOpen && (
                      <div className={styles.contextCards}>
                        {CONTEXT_CARDS.map(card => (
                          <button
                            key={card.id}
                            className={[styles.contextCard, contextCard === card.id ? styles.contextCardActive : ''].join(' ')}
                            onClick={() => {
                              setContextCard(contextCard === card.id ? null : card.id)
                              setContextOpen(false)
                            }}
                            type="button"
                          >
                            <span className={styles.contextCardLabel}>{card.label}</span>
                            <span className={styles.contextCardDesc}>{card.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button fullWidth onClick={() => { setStep('inputs'); if (genType !== 'prompt') fetchLibrary() }}>
                    Next
                  </Button>
                </div>
              )}

              {/* Step: inputs (seed / prompt) */}
              {step === 'inputs' && (
                <div className={styles.stepSection}>
                  {/* Seed track picker */}
                  {(genType === 'seed' || genType === 'hybrid') && (
                    <div className={styles.librarySection}>
                      <p className={styles.stepLabel}>Seed track</p>

                      {/* Tabs: Liked / Playlists */}
                      <div className={styles.libTabs}>
                        <button
                          className={[styles.libTab, libraryTab === 'tracks' ? styles.libTabActive : ''].join(' ')}
                          onClick={() => setLibraryTab('tracks')}
                        >Liked Songs</button>
                        <button
                          className={[styles.libTab, libraryTab === 'playlists' ? styles.libTabActive : ''].join(' ')}
                          onClick={() => setLibraryTab('playlists')}
                        >Playlists</button>
                      </div>

                      {loadingLib && <p className={styles.loadingText}>Loading library…</p>}

                      {!loadingLib && libraryTab === 'tracks' && (
                        <div className={styles.trackList}>
                          {library.map(t => (
                            <button
                              key={t.displayId}
                              className={[styles.trackRow, seedTrack?.displayId === t.displayId ? styles.trackRowSelected : ''].join(' ')}
                              onClick={() => setSeedTrack(t)}
                            >
                              {t.artworkUrl
                                ? <img src={t.artworkUrl} alt="" className={styles.trackArt} loading="lazy" />
                                : <div className={styles.trackArtPlaceholder} />
                              }
                              <div className={styles.trackInfo}>
                                <p className={styles.trackTitle}>{t.title}</p>
                                <p className={styles.trackArtist}>{t.artist}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {!loadingLib && libraryTab === 'playlists' && playlistTracks.length === 0 && (
                        <div className={styles.trackList}>
                          {playlists.map(pl => (
                            <button
                              key={pl.displayPlaylistId}
                              className={styles.trackRow}
                              onClick={() => fetchPlaylistTracks(pl.displayPlaylistId)}
                            >
                              {pl.artworkUrl
                                ? <img src={pl.artworkUrl} alt="" className={styles.trackArt} loading="lazy" />
                                : <div className={styles.trackArtPlaceholder} />
                              }
                              <div className={styles.trackInfo}>
                                <p className={styles.trackTitle}>{pl.name}</p>
                                <p className={styles.trackArtist}>{pl.trackCount} tracks</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {!loadingLib && libraryTab === 'playlists' && playlistTracks.length > 0 && (
                        <>
                          <button className={styles.backToPlaylists} onClick={() => setPlaylistTracks([])}>← Playlists</button>
                          <div className={styles.trackList}>
                            {playlistTracks.map(t => (
                              <button
                                key={t.displayId}
                                className={[styles.trackRow, seedTrack?.displayId === t.displayId ? styles.trackRowSelected : ''].join(' ')}
                                onClick={() => setSeedTrack(t)}
                              >
                                {t.artworkUrl
                                  ? <img src={t.artworkUrl} alt="" className={styles.trackArt} loading="lazy" />
                                  : <div className={styles.trackArtPlaceholder} />
                                }
                                <div className={styles.trackInfo}>
                                  <p className={styles.trackTitle}>{t.title}</p>
                                  <p className={styles.trackArtist}>{t.artist}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Prompt input */}
                  {(genType === 'prompt' || genType === 'hybrid') && (
                    <div className={styles.promptSection}>
                      <Textarea
                        label="Describe the vibe"
                        placeholder="Late night drive through empty streets…"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        maxLength={500}
                      />
                      <details className={styles.tuneDetails}>
                        <summary className={styles.tuneSummary}>Tune it</summary>
                        <div className={styles.tuneContent}>
                          <div className={styles.intentRow}>
                            <p className={styles.intentLabel}>Energy</p>
                            <div className={styles.intentChips}>
                              {(['low', 'medium', 'high'] as Energy[]).map(v => (
                                <button
                                  key={v}
                                  className={[styles.chip, energy === v ? styles.chipActive : ''].join(' ')}
                                  onClick={() => setEnergy(energy === v ? '' : v)}
                                >{v}</button>
                              ))}
                            </div>
                          </div>
                          <div className={styles.intentRow}>
                            <p className={styles.intentLabel}>Tempo</p>
                            <div className={styles.intentChips}>
                              {(['slow', 'medium', 'fast'] as Tempo[]).map(v => (
                                <button
                                  key={v}
                                  className={[styles.chip, tempo === v ? styles.chipActive : ''].join(' ')}
                                  onClick={() => setTempo(tempo === v ? '' : v)}
                                >{v}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}

                  <Button fullWidth onClick={() => setStep('options')}>Next</Button>
                  <Button variant="ghost" fullWidth onClick={() => setStep('type')}>Back</Button>
                </div>
              )}

              {/* Step: options (platform + duration) */}
              {step === 'options' && (
                <div className={styles.stepSection}>
                  <p className={styles.stepLabel}>Export to</p>
                  <div className={styles.platformGrid}>
                    {PLATFORMS.map(({ value, label }) => (
                      <button
                        key={value}
                        className={[styles.platformBtn, platform === value ? styles.platformBtnActive : ''].join(' ')}
                        onClick={() => setPlatform(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className={styles.stepLabel} style={{ marginTop: 'var(--space-6)' }}>Duration</p>
                  <div className={styles.durationRow}>
                    {DURATIONS.map(d => (
                      <button
                        key={d}
                        className={[styles.durationBtn, duration === d ? styles.durationBtnActive : ''].join(' ')}
                        onClick={() => setDuration(d)}
                      >
                        {d < 60 ? `${d}m` : `${d / 60}h`}
                        {d === 120 && <Badge variant="premium">Pro</Badge>}
                      </button>
                    ))}
                  </div>

                  {seedTrack && (
                    <div className={styles.seedPreview}>
                      <p className={styles.seedPreviewLabel}>Seed</p>
                      <p className={styles.seedPreviewTrack}>{seedTrack.title} — {seedTrack.artist}</p>
                    </div>
                  )}

                  <Button fullWidth loading={generatingNow} onClick={handleGenerate}>Generate</Button>
                  <Button variant="ghost" fullWidth onClick={() => setStep('inputs')}>Back</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Playlist result ───────────────────────────────────────────────── */}
      <PlaylistResult
        open={resultOpen}
        blueprintId={generation.blueprintId}
        platform={generation.platform ?? 'spotify'}
        onClose={() => { setResultOpen(false); setTakeover(false); generation.reset() }}
      />
    </>
  )
}

interface HistoryItem {
  id: string
  platform: string
  seedTrackTitle: string | null
  seedTrackArtist: string | null
  promptSummary: string | null
  durationMinutes: number
  trackCount: number
  platformPlaylistUrl: string | null
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
