import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

// Inline frequency bars — uses currentColor so they're visible on any button background
function LoadingBars() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: '2px',
        height: 16,
        overflow: 'hidden',
      }}
    >
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 3,
            height: 16,
            background: 'currentColor',
            borderRadius: 2,
            transformOrigin: 'bottom center',
            animation: 'barLoad 0.9s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </span>
  )
}

export default function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  ...rest
}: Props) {
  const classes = [
    styles.btn,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <LoadingBars /> : children}
    </button>
  )
}
