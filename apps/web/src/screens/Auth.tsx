import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { api } from '../api/client'
import { useToast } from '../components/ui/Toast'
import { FrequencyVisualiserBars } from '../components/FrequencyVisualiser'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import styles from './Auth.module.css'

type Mode = 'login' | 'signup'

type Region = 'NG' | 'UK' | 'EU' | 'US' | 'CA'
const REGIONS: { value: Region; label: string }[] = [
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'NG', label: 'Nigeria'        },
  { value: 'EU', label: 'Europe'         },
  { value: 'CA', label: 'Canada'         },
]

export default function Auth() {
  const [mode, setMode]       = useState<Mode>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [region, setRegion]   = useState<Region>('US')
  const [loading, setLoading] = useState(false)

  const { setTokens, setUser } = useAuthStore()
  const navigate = useNavigate()
  const toast    = useToast()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const path = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login'
      const body = mode === 'signup' ? { email, password, region } : { email, password }

      const res = await api.post<{ accessToken: string; refreshToken: string }>(path, body)
      setTokens(res.accessToken, res.refreshToken)

      // Fetch the user profile and store it
      const me = await api.get<{ id: string; email: string }>('/api/v1/auth/me')
      setUser(me)

      navigate('/', { replace: true })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <FrequencyVisualiserBars mode="idle" count={12} height={24} />
        <h1 className={styles.wordmark}>Groovz</h1>
        <p className={styles.tagline}>Music intelligence, personally yours</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {/* Mode toggle */}
        <div className={styles.toggle}>
          <button
            type="button"
            className={[styles.toggleBtn, mode === 'login' ? styles.toggleActive : ''].join(' ')}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={[styles.toggleBtn, mode === 'signup' ? styles.toggleActive : ''].join(' ')}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <Input
          type="password"
          label="Password"
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
        />

        {mode === 'signup' && (
          <div className={styles.regionWrapper}>
            <label className={styles.regionLabel}>Region</label>
            <select
              className={styles.regionSelect}
              value={region}
              onChange={e => setRegion(e.target.value as Region)}
            >
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <Button type="submit" fullWidth loading={loading}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </Button>
      </form>
    </div>
  )
}
