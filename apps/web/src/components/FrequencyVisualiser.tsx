import { useEffect, useRef } from 'react'
import styles from './FrequencyVisualiser.module.css'

export type VisualisationMode = 'idle' | 'generating' | 'complete'

// ─── Canvas version (full-screen, §4.4) ──────────────────────────────────────

interface CanvasProps {
  mode: VisualisationMode
  barCount?: number
  className?: string
}

export function FrequencyVisualiserCanvas({ mode, barCount = 24, className }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const startRef  = useRef<number>(0)
  const phasesRef = useRef<number[]>([])

  // Pre-generate random phases once per bar count
  useEffect(() => {
    phasesRef.current = Array.from({ length: barCount }, () => Math.random() * Math.PI * 2)
  }, [barCount])

  // Single rAF loop — pauses when tab is hidden
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const t = (ts - startRef.current) / 1000

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width  / devicePixelRatio
      const h = canvas.height / devicePixelRatio

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(devicePixelRatio, devicePixelRatio)

      const bw = 3, bg = 3
      const totalW = barCount * (bw + bg) - bg
      const x0 = (w - totalW) / 2

      for (let i = 0; i < barCount; i++) {
        const bh = barHeight(t, i, barCount, mode, h, phasesRef.current)
        const x  = x0 + i * (bw + bg)
        const y  = h - bh

        const g = ctx.createLinearGradient(x, h, x, y)
        g.addColorStop(0,   '#7B1F1F')
        g.addColorStop(0.6, '#8B2424')
        g.addColorStop(1,   '#A02828')

        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, 2)
        ctx.fill()
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
      } else {
        startRef.current = 0
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(rafRef.current)
    }
  }, [mode, barCount])

  // Resize observer — keeps canvas pixel-perfect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      canvas.width  = Math.round(width  * devicePixelRatio)
      canvas.height = Math.round(height * devicePixelRatio)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return <canvas ref={canvasRef} className={[styles.canvas, className ?? ''].join(' ')} />
}

// ─── DOM bar version (pill, small contexts, §4.4) ────────────────────────────

interface BarsProps {
  mode: VisualisationMode
  count?: number
  height?: number
  dim?: boolean
  className?: string
}

export function FrequencyVisualiserBars({ mode, count = 12, height = 20, dim = false, className }: BarsProps) {
  return (
    <div
      className={[styles.bars, className ?? ''].join(' ')}
      style={{ height, opacity: dim ? 0.15 : 1 }}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={[styles.bar, styles[mode]].join(' ')}
          style={{
            height,
            animationDelay: `${(i / count) * 1.2}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Height calculation ───────────────────────────────────────────────────────

function barHeight(
  t: number,
  i: number,
  count: number,
  mode: VisualisationMode,
  maxH: number,
  phases: number[],
): number {
  const n = i / count
  const p = phases[i] ?? 0

  if (mode === 'idle') {
    return maxH * (0.1 + 0.08 * Math.sin(t * 0.8 + n * Math.PI * 2))
  }
  if (mode === 'generating') {
    const w1 = Math.sin(t * 2.0 + n * Math.PI * 2   + p)
    const w2 = Math.sin(t * 3.7 + n * Math.PI * 1.3 + p * 1.4)
    const w3 = Math.sin(t * 1.2 + n * Math.PI * 3   + p * 0.7)
    return Math.max(8, maxH * (0.2 + 0.5 * ((w1 * 0.4 + w2 * 0.35 + w3 * 0.25 + 1) / 2)))
  }
  // complete
  return maxH * (0.28 + 0.06 * Math.sin(t * 0.5 + n * Math.PI * 2))
}
