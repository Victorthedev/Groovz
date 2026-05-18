import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import styles from './Discover.module.css'

type TasteSummary =
  | { available: false; signalCount: number; threshold: number }
  | { available: true; signalCount: number; phaseLabel: string; genres: string[] }

export default function Discover() {
  const [summary, setSummary] = useState<TasteSummary | null>(null)

  useEffect(() => {
    api.get<TasteSummary>('/api/v1/user/taste-summary').then(setSummary).catch(() => {})
  }, [])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Discover</h1>

      <div className={styles.teaser}>
        <FrequencyVisualiserBars mode="idle" count={16} height={48} dim />
        <h2 className={styles.teaserTitle}>Your Weekly Mix</h2>
        <p className={styles.teaserBody}>
          Groovz learns your taste and generates a personalised weekly playlist, built just for you.
        </p>

        {!summary && (
          <p className={styles.progress}>Loading your profile…</p>
        )}

        {summary && !summary.available && (
          <p className={styles.progress}>
            {summary.threshold - summary.signalCount} signals to go until your taste profile activates
          </p>
        )}

        {summary?.available && (
          <p className={styles.progress} style={{ color: 'var(--color-accent)' }}>
            Your taste profile is live. Weekly mix updates every Sunday.
          </p>
        )}
      </div>
    </div>
  )
}
