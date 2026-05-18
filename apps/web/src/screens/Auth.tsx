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
  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [region, setRegion]     = useState<Region>('US')
  const [loading, setLoading]   = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [errors, setErrors]     = useState<{ email?: string; password?: string; legal?: string }>({})

  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()
  const toast    = useToast()

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!email.trim()) {
      next.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address'
    }
    if (!password) {
      next.password = 'Password is required'
    } else if (mode === 'signup' && password.length < 8) {
      next.password = 'Password must be at least 8 characters'
    }
    if (mode === 'signup' && !agreedToTerms) {
      next.legal = 'You must agree to the Privacy Policy and Terms of Service'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const path = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/login'
      const body = mode === 'signup' ? { email, password, region } : { email, password }

      const res = await api.post<{ accessToken: string }>(path, body)
      setToken(res.accessToken)

      const [me, prefs] = await Promise.all([
        api.get<{ id: string; email: string }>('/api/v1/auth/me'),
        api.get<{ signalCollectionConsented: boolean }>('/api/v1/user/preferences'),
      ])
      setUser(me)

      navigate(prefs.signalCollectionConsented ? '/' : '/onboarding', { replace: true })
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
        <div className={styles.toggle}>
          <button
            type="button"
            className={[styles.toggleBtn, mode === 'login' ? styles.toggleActive : ''].join(' ')}
            onClick={() => { setMode('login'); setErrors({}); setAgreedToTerms(false) }}
          >
            Log in
          </button>
          <button
            type="button"
            className={[styles.toggleBtn, mode === 'signup' ? styles.toggleActive : ''].join(' ')}
            onClick={() => { setMode('signup'); setErrors({}); setAgreedToTerms(false) }}
          >
            Sign up
          </button>
        </div>

        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })) }}
          autoComplete="email"
          error={errors.email}
        />

        <Input
          type="password"
          label="Password"
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
          value={password}
          onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })) }}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          error={errors.password}
        />

        {mode === 'signup' && (
          <>
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

            <div className={styles.legalCheck}>
              <div className={styles.legalCheckRow}>
                <input
                  type="checkbox"
                  id="legal-agree"
                  className={styles.legalCheckbox}
                  checked={agreedToTerms}
                  onChange={e => {
                    setAgreedToTerms(e.target.checked)
                    setErrors(prev => ({ ...prev, legal: undefined }))
                  }}
                />
                <label htmlFor="legal-agree" className={styles.legalLabel}>
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                    Privacy Policy
                  </a>
                  {' '}and{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                    Terms of Service
                  </a>
                </label>
              </div>
              {errors.legal && <p className={styles.legalError}>{errors.legal}</p>}
            </div>
          </>
        )}

        <Button type="submit" fullWidth loading={loading}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </Button>
      </form>
    </div>
  )
}
