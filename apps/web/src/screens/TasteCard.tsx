import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Button from '../components/ui/Button'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import styles from './TasteCard.module.css'

interface TasteSummaryAvailable {
  available: true
  signalCount: number
  phaseLabel: string
  genres: string[]
  energyCentroid: number
  playlistCount: number
  memberSince: string
}

interface TasteSummaryUnavailable {
  available: false
  signalCount: number
  threshold: number
}

type TasteSummary = TasteSummaryAvailable | TasteSummaryUnavailable

const CARD_SIZE = 1080
const ACCENT    = '#7B1F1F'
const ACCENT_MID = '#8B2424'
const ACCENT_TOP = '#A02828'

export default function TasteCard() {
  const [summary, setSummary] = useState<TasteSummary | null>(null)
  const [sharing, setSharing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const navigate  = useNavigate()

  useEffect(() => {
    api.get<TasteSummary>('/api/v1/user/taste-summary')
      .then(setSummary)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (summary?.available) {
      drawCard(summary)
    }
  }, [summary])

  const drawCard = async (data: TasteSummaryAvailable) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Wait for fonts — Clash Display should already be in the browser cache from the app
    await document.fonts.ready

    canvas.width  = CARD_SIZE
    canvas.height = CARD_SIZE
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

    // Wordmark — top left
    ctx.font = '500 36px "Clash Display", sans-serif'
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'left'
    ctx.fillText('groovz', 64, 100)

    // Phase label — centred, large
    ctx.textAlign = 'center'
    const fontSize = data.phaseLabel.length > 20 ? 96 : 120
    ctx.font = `700 ${fontSize}px "Clash Display", sans-serif`
    ctx.fillStyle = '#F0F0F0'
    wrapText(ctx, data.phaseLabel, CARD_SIZE / 2, 480, CARD_SIZE - 128, fontSize * 1.15)

    // Genre pills
    if (data.genres.length > 0) {
      drawGenrePills(ctx, data.genres, CARD_SIZE / 2, 680)
    }

    // Frequency bars — heights proportional to energyCentroid
    drawBars(ctx, data.energyCentroid, CARD_SIZE / 2, 820)

    // Descriptor line — bottom
    ctx.font = '400 32px "Inter", sans-serif'
    ctx.fillStyle = '#555555'
    ctx.textAlign = 'center'
    const desc = `${data.playlistCount} playlists · ${data.memberSince}`
    ctx.fillText(desc, CARD_SIZE / 2, CARD_SIZE - 80)
  }

  const handleShare = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSharing(true)

    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), 'image/png'),
      )
      const file = new File([blob], 'groovz-taste-card.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Groovz Taste Card' })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'groovz-taste-card.png'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // User cancelled share — not an error
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className={styles.title}>Taste Card</h1>
      </div>

      {!summary && (
        <div className={styles.coldStart}>
          <FrequencyVisualiserBars mode="idle" count={12} height={32} />
        </div>
      )}

      {summary && !summary.available && (
        <div className={styles.coldStart}>
          <FrequencyVisualiserBars mode="idle" count={12} height={32} />
          <h2 className={styles.coldHeading}>Keep using Groovz</h2>
          <p className={styles.coldBody}>
            Your Taste Card unlocks once Groovz knows you well enough to say something true about your sound.
          </p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, (summary.signalCount / summary.threshold) * 100)}%` }}
            />
          </div>
          <p className={styles.progressLabel}>
            {summary.signalCount} of {summary.threshold} signals collected
          </p>
        </div>
      )}

      {summary?.available && (
        <div className={styles.cardWrapper}>
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.actions}>
            <Button fullWidth loading={sharing} onClick={handleShare}>
              Share
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, currentY)
}

function drawGenrePills(ctx: CanvasRenderingContext2D, genres: string[], centreX: number, y: number) {
  const pillPad = 32
  const pillH   = 56
  const gap     = 16
  ctx.font = '500 28px "Inter", sans-serif'

  // Measure total width
  const widths = genres.map(g => ctx.measureText(g).width + pillPad * 2)
  const totalW = widths.reduce((s, w) => s + w, 0) + gap * (genres.length - 1)
  let x = centreX - totalW / 2

  for (let i = 0; i < genres.length; i++) {
    const w = widths[i]
    const r = pillH / 2

    // Pill background
    ctx.fillStyle = ACCENT
    ctx.beginPath()
    ctx.moveTo(x + r, y - pillH / 2)
    ctx.arcTo(x + w, y - pillH / 2, x + w, y + pillH / 2, r)
    ctx.arcTo(x + w, y + pillH / 2, x, y + pillH / 2, r)
    ctx.arcTo(x, y + pillH / 2, x, y - pillH / 2, r)
    ctx.arcTo(x, y - pillH / 2, x + w, y - pillH / 2, r)
    ctx.closePath()
    ctx.fill()

    // Text
    ctx.fillStyle = '#F0F0F0'
    ctx.textAlign = 'center'
    ctx.fillText(genres[i], x + w / 2, y + 10)

    x += w + gap
  }
}

function drawBars(ctx: CanvasRenderingContext2D, energyCentroid: number, centreX: number, y: number) {
  const barCount  = 12
  const barW      = 18
  const barGap    = 10
  const maxH      = 120
  const totalW    = barCount * barW + (barCount - 1) * barGap
  let x = centreX - totalW / 2

  for (let i = 0; i < barCount; i++) {
    // Sine wave modulated by energyCentroid
    const wave = Math.sin((i / barCount) * Math.PI)
    const h = Math.max(8, (0.3 + wave * 0.5 + energyCentroid * 0.2) * maxH)

    const grad = ctx.createLinearGradient(x, y - h, x, y)
    grad.addColorStop(0, ACCENT_TOP)
    grad.addColorStop(0.5, ACCENT_MID)
    grad.addColorStop(1, ACCENT)
    ctx.fillStyle = grad

    const r = barW / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + barW, y, x + barW, y - h, r)
    ctx.arcTo(x + barW, y - h, x, y - h, r)
    ctx.arcTo(x, y - h, x, y, r)
    ctx.arcTo(x, y, x + barW, y, r)
    ctx.closePath()
    ctx.fill()

    x += barW + barGap
  }
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
