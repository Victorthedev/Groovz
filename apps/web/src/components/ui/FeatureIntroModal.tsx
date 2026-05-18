import { useEffect, useState } from 'react'
import { usePreferencesStore } from '../../store/preferences'
import styles from './FeatureIntroModal.module.css'

// ─── Feature content ─────────────────────────────────────────────────────────

const INTROS: Record<string, { title: string; body: string }> = {
  make_a_playlist: {
    title: 'This is where it starts',
    body: 'Drop a track you love, describe what you\'re after or do both. Groovz traces the graph from there and builds a playlist you won\'t find on any curated list. Same inputs, different playlist every time.',
  },
  deep_cuts: {
    title: 'Further in',
    body: 'This goes three hops out from your seed instead of stopping at the obvious picks. You get artists and tracks that never surface on regular recommendation lists, sitting in the same sonic space as what you started with. First listen usually feels like you\'ve known them for years.',
  },
  session_blend: {
    title: 'One playlist for the room',
    body: 'Share the link and everyone joins from their phone. Groovz finds where your taste profiles actually overlap and builds from there. The result isn\'t a compromise. It\'s what you all genuinely have in common.',
  },
  context_cards: {
    title: 'Tell us what you are doing',
    body: 'Not just mood. These are specific situations with their own sonic logic. Pre-match warmup builds differently from getting ready to go out. Pick your moment and we handle the arc.',
  },
  taste_timeline: {
    title: 'Your taste has a history',
    body: 'Your taste moves over time whether you notice it or not. This shows you how. Dark periods, high-energy phases and the jazz exploration you did not realise you were having.',
  },
  rolling_playlist: {
    title: 'Your playlist that updates itself',
    body: 'Once Groovz knows you well enough it creates a playlist on your platform and refreshes it every week automatically. No prompt, no seed. Just your current sound, always up to date.',
  },
  taste_card: {
    title: 'Your taste, visualised',
    body: 'A shareable image of your current sound phase. Looks like album artwork, not a social media graphic. Share it if you want. Every card carries a bit of Groovz branding.',
  },
  whatsapp_bot: {
    title: 'Create playlists anywhere',
    body: 'Link your WhatsApp number and send a message from anywhere. Long drive, need something dark and fast and Groovz generates it and sends back a link. No app needed.',
  },
  road_trip: {
    title: 'Music that matches the journey',
    body: 'Tell Groovz where you are going or how long you want to drive and it plans a route and builds a playlist that fits exactly. The music and the road, designed together.',
  },
  drive_chapters: {
    title: 'Your journey in sonic chapters',
    body: 'On long drives the road changes. Leaving a city feels different from open motorway and different from arriving somewhere new. Drive Chapters gives each segment its own soundtrack.',
  },
  moment_playlists: {
    title: 'Groovz noticed something',
    body: 'You tend to generate a certain kind of playlist on Friday evenings or Sunday mornings. Once the pattern is clear, Groovz asks quietly if you want it. You can always say no.',
  },
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFeatureIntro(featureId: string, onDismiss?: () => void) {
  const { seenFeatureIntros, loaded, markSeen } = usePreferencesStore()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!loaded) return
    if (seenFeatureIntros.includes(featureId)) return
    if (!INTROS[featureId]) return

    const timer = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(timer)
  }, [featureId, loaded, seenFeatureIntros])

  const dismiss = () => {
    setShow(false)
    markSeen(featureId)
    onDismiss?.()
  }

  return { show, dismiss }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  featureId: string
  onDismiss?: () => void
}

export default function FeatureIntroModal({ featureId, onDismiss }: Props) {
  const { show, dismiss } = useFeatureIntro(featureId, onDismiss)
  const content = INTROS[featureId]

  if (!show || !content) return null

  return (
    <>
      <div className={styles.backdrop} onClick={dismiss} aria-hidden="true" />
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`fi-title-${featureId}`}
      >
        <div className={styles.header}>
          <h2 className={styles.title} id={`fi-title-${featureId}`}>
            {content.title}
          </h2>
          <button className={styles.closeBtn} onClick={dismiss} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className={styles.body}>{content.body}</p>
        <button className={styles.cta} onClick={dismiss}>Got it</button>
      </div>
    </>
  )
}
