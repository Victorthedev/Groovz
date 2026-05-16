import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useGenerationStore } from './store/generation'
import { useSocket } from './hooks/useSocket'
import { ToastProvider } from './components/ui/Toast'

import Splash   from './screens/Splash'
import Auth     from './screens/Auth'
import AppShell from './components/AppShell'
import Generate from './screens/Generate'
import Library  from './screens/Library'
import Discover from './screens/Discover'
import Profile  from './screens/Profile'
import Chat     from './screens/Chat'

export default function App() {
  const { isLoading, accessToken } = useAuthStore()

  if (isLoading) return <Splash />

  return (
    <ToastProvider>
      <BrowserRouter>
        <WebSocketListener />
        <Routes>
          <Route path="/auth" element={
            accessToken ? <Navigate to="/" replace /> : <Auth />
          } />

          <Route path="/" element={
            accessToken ? <AppShell /> : <Navigate to="/auth" replace />
          }>
            <Route index          element={<Generate />} />
            <Route path="library"  element={<Library />}  />
            <Route path="discover" element={<Discover />} />
            <Route path="profile"  element={<Profile />}  />
            <Route path="chat"     element={<Chat />}     />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

// Connects the WebSocket to the generation store.
// Runs inside the router so hooks that navigate are safe to use.
function WebSocketListener() {
  const { accessToken } = useAuthStore()
  const generation  = useGenerationStore()
  const socketRef   = useSocket(accessToken)
  // Keep generation in a ref so the socket callbacks don't need it as a dep
  const genRef      = useRef(generation)
  useEffect(() => { genRef.current = generation })

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onReady = ({ blueprintId }: { blueprintId: string }) => {
      if (genRef.current.blueprintId === blueprintId) genRef.current.complete()
    }
    const onError = () => {
      if (genRef.current.status === 'generating') genRef.current.fail('Generation failed — please try again.')
    }

    socket.on('playlist:ready', onReady)
    socket.on('playlist:error', onError)
    return () => { socket.off('playlist:ready', onReady); socket.off('playlist:error', onError) }
  }, [socketRef, accessToken])

  return null
}
