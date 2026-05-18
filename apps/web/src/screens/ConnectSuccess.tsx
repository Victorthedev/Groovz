import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// Handles the redirect after OAuth platform connection.
// If coming from onboarding, returns there. Otherwise goes to profile.
export default function ConnectSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const fromOnboarding = sessionStorage.getItem('platform_connect_source') === 'onboarding'
    sessionStorage.removeItem('platform_connect_source')

    const platform = params.get('platform') ?? ''
    if (fromOnboarding) {
      navigate(`/onboarding?connected=${platform}`, { replace: true })
    } else {
      navigate('/profile', { replace: true })
    }
  }, [])

  return null
}
