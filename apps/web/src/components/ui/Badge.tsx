import type { ReactNode } from 'react'

type Variant = 'premium' | 'new' | 'plan-free' | 'plan-paid'

const STYLES: Record<Variant, React.CSSProperties> = {
  premium:    { background: 'var(--color-premium)',  color: 'var(--color-premium-text)' },
  new:        { background: 'var(--color-accent)',   color: 'var(--color-text-primary)' },
  'plan-free':{ background: 'var(--color-border)',   color: 'var(--color-text-muted)'   },
  'plan-paid':{ background: 'var(--color-premium)',  color: 'var(--color-premium-text)' },
}

interface Props {
  variant: Variant
  children: ReactNode
}

export default function Badge({ variant, children }: Props) {
  return (
    <span style={{
      ...STYLES[variant],
      fontFamily: 'Inter, sans-serif',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 'var(--radius-sm)',
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
