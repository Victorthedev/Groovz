import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import styles from './Discover.module.css'

export default function Discover() {
  const [playlistCount, setPlaylistCount] = useState(0)
  const THRESHOLD = 10

  useEffect(() => {
    api.get<{ playlists: unknown[] }>('/api/v1/playlists/history')
      .then(r => setPlaylistCount(r.playlists.length))
      .catch(() => {})
  }, [])

  const remaining = Math.max(0, THRESHOLD - playlistCount)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Discover</h1>

      <div className={styles.teaser}>
        <FrequencyVisualiserBars mode="idle" count={16} height={48} dim />
        <h2 className={styles.teaserTitle}>Your Weekly Mix</h2>
        <p className={styles.teaserBody}>
          Groovz learns your taste and generates a personalised weekly playlist — just for you.
        </p>
        {remaining > 0 ? (
          <p className={styles.progress}>
            {remaining} more playlist{remaining !== 1 ? 's' : ''} until your taste profile activates
          </p>
        ) : (
          <p className={styles.progress} style={{ color: 'var(--color-accent)' }}>
            Your taste profile is active — weekly playlist incoming!
          </p>
        )}
      </div>
    </div>
  )
}
