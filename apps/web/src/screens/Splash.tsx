export default function Splash() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <span style={{
        fontFamily: '"Clash Display", sans-serif',
        fontWeight: 700,
        fontSize: 'var(--text-4xl)',
        color: 'var(--color-text-primary)',
        letterSpacing: '-0.04em',
      }}>
        Groovz
      </span>
    </div>
  )
}
