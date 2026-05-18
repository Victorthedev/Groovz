import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { api } from '../api/client'
import { useGenerationStore } from '../store/generation'
import { useToast } from '../components/ui/Toast'
import { FrequencyVisualiserCanvas } from '../components/FrequencyVisualiser'
import Button from '../components/ui/Button'
import PlaylistResult from '../components/PlaylistResult'
import styles from './RoadTrip.module.css'

// Module-level — runs once per app load, never re-runs even in StrictMode
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined
if (MAPS_KEY) setOptions({ key: MAPS_KEY })

type Activity = 'drive' | 'cycle' | 'walk' | 'jog'
type Step = 'inputs' | 'preview' | 'generating'

interface Place { name: string; lat: number; lng: number }

interface RouteResult {
  routeId: string
  estimatedDurationMinutes: number
  polyline: string
  waypoints: Array<{ lat: number; lng: number }>
  confidence: number
  mapsDeepLink: string
}

interface Prediction {
  placeId: string
  mainText: string
  secondaryText: string
}

const ACTIVITIES: { value: Activity; label: string; icon: string }[] = [
  { value: 'drive', label: 'Drive',  icon: '🚗' },
  { value: 'cycle', label: 'Cycle',  icon: '🚴' },
  { value: 'jog',   label: 'Jog',    icon: '🏃' },
  { value: 'walk',  label: 'Walk',   icon: '🚶' },
]

const LOOP_DURATIONS = [
  { value: 30,  label: '30m' },
  { value: 60,  label: '1h'  },
  { value: 90,  label: '1.5h'},
  { value: 120, label: '2h'  },
]

const ACTIVITY_ENERGY: Record<Activity, 'low' | 'medium' | 'high'> = {
  drive: 'medium', cycle: 'high', jog: 'high', walk: 'low',
}
const ACTIVITY_TEMPO: Record<Activity, 'slow' | 'medium' | 'fast'> = {
  drive: 'medium', cycle: 'fast', jog: 'fast', walk: 'slow',
}

const ACTIVITY_PROMPT: Record<Activity, string> = {
  drive: 'Music for a road trip drive',
  cycle: 'High energy music for a cycling ride',
  jog:   'Fast upbeat music for running and jogging',
  walk:  'Relaxed music for a walk',
}

export default function RoadTrip() {
  const [step, setStep]               = useState<Step>('inputs')
  const [startQuery, setStartQuery]   = useState('')
  const [destQuery, setDestQuery]     = useState('')
  const [startPlace, setStartPlace]   = useState<Place | null>(null)
  const [destPlace, setDestPlace]     = useState<Place | null>(null)
  const [activity, setActivity]       = useState<Activity>('drive')
  const [loopDuration, setLoopDuration] = useState(60)
  const [activePicker, setActivePicker] = useState<'start' | 'dest' | null>(null)
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [calculating, setCalculating] = useState(false)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [blueprintId, setBlueprintId] = useState<string | null>(null)
  const [resultOpen, setResultOpen]   = useState(false)

  const mapsRef = useRef<{
    autocomplete: google.maps.places.AutocompleteService
    geocoder: google.maps.Geocoder
  } | null>(null)
  const suggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generation = useGenerationStore()
  const navigate   = useNavigate()
  const toast      = useToast()

  const isLoop = !!(startPlace && destPlace &&
    startPlace.lat === destPlace.lat && startPlace.lng === destPlace.lng)

  // Load Google Maps Places API
  useEffect(() => {
    if (!MAPS_KEY || mapsRef.current) return
    importLibrary('places')
      .then(() => {
        mapsRef.current = {
          autocomplete: new google.maps.places.AutocompleteService(),
          geocoder:     new google.maps.Geocoder(),
        }
      })
      .catch(() => {})
  }, [])

  // Open result when generation completes
  useEffect(() => {
    if (generation.status === 'complete' && step === 'generating') {
      setTimeout(() => setResultOpen(true), 600)
    }
  }, [generation.status, step])

  // ─── Autocomplete ──────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback((query: string) => {
    if (!mapsRef.current || query.length < 3) { setSuggestions([]); return }
    mapsRef.current.autocomplete.getPlacePredictions(
      { input: query },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.slice(0, 5).map(p => ({
            placeId:       p.place_id,
            mainText:      p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text ?? '',
          })))
        } else {
          setSuggestions([])
        }
      },
    )
  }, [])

  const handleQueryChange = (query: string, picker: 'start' | 'dest') => {
    if (picker === 'start') { setStartQuery(query); setStartPlace(null) }
    else                    { setDestQuery(query);  setDestPlace(null)  }
    setActivePicker(picker)

    if (suggestTimeout.current) clearTimeout(suggestTimeout.current)
    suggestTimeout.current = setTimeout(() => fetchSuggestions(query), 200)
  }

  const handleSelectPlace = (prediction: Prediction, picker: 'start' | 'dest') => {
    setSuggestions([])
    setActivePicker(null)
    mapsRef.current?.geocoder.geocode(
      { placeId: prediction.placeId },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]) return
        const loc = results[0].geometry.location
        const place: Place = { name: prediction.mainText, lat: loc.lat(), lng: loc.lng() }
        if (picker === 'start') { setStartPlace(place); setStartQuery(place.name) }
        else                    { setDestPlace(place);  setDestQuery(place.name)  }
      },
    )
  }

  const handleReturnToStart = () => {
    if (!startPlace) return
    setDestPlace(startPlace)
    setDestQuery(startPlace.name)
    setSuggestions([])
    setActivePicker(null)
  }

  // ─── Route calculation ─────────────────────────────────────────────────────

  const handleCalculate = async () => {
    if (!startPlace) return
    setCalculating(true)
    try {
      const body = isLoop
        ? { mode: 'loop'     as const, start: { lat: startPlace.lat, lng: startPlace.lng }, activity, targetDurationMinutes: loopDuration }
        : { mode: 'directed' as const, start: { lat: startPlace.lat, lng: startPlace.lng }, destination: { lat: destPlace!.lat, lng: destPlace!.lng }, activity }

      const result = await api.post<RouteResult>('/api/v1/routes/generate', body)
      setRouteResult(result)
      setStep('preview')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setCalculating(false)
    }
  }

  // ─── Playlist generation ───────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!routeResult) return
    setStep('generating')
    try {
      const res = await api.post<{ jobId: string; blueprintId: string }>('/api/v1/playlists/generate', {
        type: 'prompt',
        platform: 'spotify',
        prompt: ACTIVITY_PROMPT[activity],
        intent: {
          durationMinutes: routeResult.estimatedDurationMinutes,
          energy: ACTIVITY_ENERGY[activity],
          tempo:  ACTIVITY_TEMPO[activity],
        },
      })
      generation.start(res.jobId, res.blueprintId, 'spotify')
      setBlueprintId(res.blueprintId)
    } catch (e) {
      toast((e as Error).message, 'error')
      setStep('preview')
    }
  }

  const canCalculate = !!startPlace && (isLoop || !!destPlace)

  return (
    <>
      <div className={styles.page}>
        {/* Top bar */}
        <div className={styles.bar}>
          <button
            className={styles.backBtn}
            onClick={() => step === 'preview' ? setStep('inputs') : navigate(-1)}
            aria-label="Back"
          >
            <BackIcon />
          </button>
          <span className={styles.barTitle}>Road Trip</span>
          <span style={{ width: 44 }} />
        </div>

        {/* Generating state */}
        {step === 'generating' && (
          <div className={styles.generatingState}>
            <FrequencyVisualiserCanvas mode="generating" className={styles.generatingVis} />
            <p className={styles.generatingStatus}>Planning your route and playlist</p>
            <p className={styles.generatingHint}>Finding the right sounds for the journey…</p>
          </div>
        )}

        {/* Route preview */}
        {step === 'preview' && routeResult && (
          <div className={styles.previewContent}>
            <div className={styles.routeSummary}>
              <div className={styles.routeSummaryIcon}>
                {ACTIVITIES.find(a => a.value === activity)?.icon}
              </div>
              <div>
                <p className={styles.routeSummaryDuration}>
                  ~{routeResult.estimatedDurationMinutes} min
                </p>
                <p className={styles.routeSummaryMeta}>
                  {isLoop ? 'Loop from' : 'From'} {startPlace?.name}
                  {!isLoop && destPlace ? ` to ${destPlace.name}` : ''}
                </p>
              </div>
            </div>
            <p className={styles.routePreviewHint}>
              We'll build a playlist that fits this exactly.
            </p>
            <Button fullWidth onClick={handleGenerate}>Generate playlist</Button>
            <Button variant="ghost" fullWidth onClick={() => setStep('inputs')}>Change route</Button>
          </div>
        )}

        {/* Inputs */}
        {step === 'inputs' && (
          <div className={styles.content}>
            {/* Route input row */}
            <div className={styles.routeRow}>
              <div className={styles.connectorCol}>
                <div className={styles.connectorDot} />
                <div className={styles.connectorLine} />
                <div className={styles.connectorPin} />
              </div>

              <div className={styles.inputsCol}>
                {/* Start */}
                <div className={styles.locationBlock}>
                  <input
                    className={styles.locationInput}
                    value={startQuery}
                    onChange={e => handleQueryChange(e.target.value, 'start')}
                    onFocus={() => setActivePicker('start')}
                    placeholder="Starting point"
                    autoComplete="off"
                  />
                  {activePicker === 'start' && suggestions.length > 0 && (
                    <div className={styles.suggestions}>
                      {suggestions.map(p => (
                        <button
                          key={p.placeId}
                          className={styles.suggestion}
                          onMouseDown={e => { e.preventDefault(); handleSelectPlace(p, 'start') }}
                        >
                          <span className={styles.suggestionMain}>{p.mainText}</span>
                          <span className={styles.suggestionSub}>{p.secondaryText}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination */}
                <div className={styles.locationBlock}>
                  <input
                    className={styles.locationInput}
                    value={destQuery}
                    onChange={e => handleQueryChange(e.target.value, 'dest')}
                    onFocus={() => setActivePicker('dest')}
                    placeholder="Destination"
                    autoComplete="off"
                  />
                  {activePicker === 'dest' && suggestions.length > 0 && (
                    <div className={styles.suggestions}>
                      {suggestions.map(p => (
                        <button
                          key={p.placeId}
                          className={styles.suggestion}
                          onMouseDown={e => { e.preventDefault(); handleSelectPlace(p, 'dest') }}
                        >
                          <span className={styles.suggestionMain}>{p.mainText}</span>
                          <span className={styles.suggestionSub}>{p.secondaryText}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {startPlace && !isLoop && (
                    <button className={styles.returnToStart} onClick={handleReturnToStart}>
                      Return to start
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Activity selector */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Activity</p>
              <div className={styles.activityRow}>
                {ACTIVITIES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    className={[styles.activityBtn, activity === value ? styles.activityBtnActive : ''].join(' ')}
                    onClick={() => setActivity(value)}
                  >
                    <span className={styles.activityIcon}>{icon}</span>
                    <span className={styles.activityLabel}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration (loop only) */}
            {isLoop && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>How long?</p>
                <div className={styles.durationRow}>
                  {LOOP_DURATIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      className={[styles.durationBtn, loopDuration === value ? styles.durationBtnActive : ''].join(' ')}
                      onClick={() => setLoopDuration(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button fullWidth disabled={!canCalculate} loading={calculating} onClick={handleCalculate}>
              {isLoop ? 'Calculate loop' : 'Calculate route'}
            </Button>
          </div>
        )}
      </div>

      <PlaylistResult
        open={resultOpen}
        blueprintId={blueprintId}
        platform="spotify"
        mapsDeepLink={routeResult?.mapsDeepLink}
        onClose={() => { setResultOpen(false); generation.reset(); navigate('/') }}
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
