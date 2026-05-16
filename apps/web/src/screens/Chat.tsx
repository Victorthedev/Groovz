import { useState, useRef, useEffect, type FormEvent } from 'react'
import { api } from '../api/client'
import { useGenerationStore } from '../store/generation'
import { useToast } from '../components/ui/Toast'
import PlaylistResult from '../components/PlaylistResult'
import styles from './Chat.module.css'

type Platform = 'spotify' | 'deezer' | 'audiomack' | 'youtube_music'

interface Message {
  role: 'user' | 'assistant'
  content: string
  blueprintId?: string
}

interface ChatResponse {
  sessionId: string
  message: string
  blueprintId?: string
  jobId?: string
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'spotify',       label: 'Spotify'       },
  { value: 'deezer',        label: 'Deezer'        },
  { value: 'audiomack',     label: 'Audiomack'     },
  { value: 'youtube_music', label: 'YouTube Music' },
]

export default function Chat() {
  const [messages, setMessages]       = useState<Message[]>([])
  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [input, setInput]             = useState('')
  const [platform, setPlatform]       = useState<Platform>('spotify')
  const [loading, setLoading]         = useState(false)
  const [resultOpen, setResultOpen]   = useState(false)
  const [resultBlueprintId, setResultBlueprintId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const generation = useGenerationStore()
  const toast = useToast()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Open result when generation triggered via chat completes
  useEffect(() => {
    if (generation.status === 'complete' && generation.blueprintId === resultBlueprintId && resultBlueprintId) {
      setResultOpen(true)
    }
  }, [generation.status, generation.blueprintId, resultBlueprintId])

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const body: Record<string, unknown> = { message: text, platform }
      if (sessionId) body['sessionId'] = sessionId

      const res = await api.post<ChatResponse>('/api/v1/chat', body)
      setSessionId(res.sessionId)

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.message,
        blueprintId: res.blueprintId,
      }
      setMessages(prev => [...prev, assistantMsg])

      if (res.blueprintId && res.jobId) {
        generation.start(res.jobId, res.blueprintId, platform)
        setResultBlueprintId(res.blueprintId)
      }
    } catch (err) {
      toast((err as Error).message, 'error')
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  const startNew = () => {
    setMessages([])
    setSessionId(null)
    setResultBlueprintId(null)
    generation.reset()
  }

  return (
    <>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Chat</h1>
            <p className={styles.subtitle}>Describe what you want — Groovz figures out the rest</p>
          </div>
          {messages.length > 0 && (
            <button className={styles.newBtn} onClick={startNew}>New</button>
          )}
        </div>

        {/* Platform picker */}
        <div className={styles.platformRow}>
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              className={[styles.platformPill, platform === value ? styles.platformPillActive : ''].join(' ')}
              onClick={() => setPlatform(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Start a conversation</p>
              <div className={styles.suggestions}>
                {[
                  'Late night drive, energetic',
                  'Studying — no lyrics, focused',
                  'Getting ready to go out',
                  'Sunday morning vibes',
                ].map(s => (
                  <button
                    key={s}
                    className={styles.suggestion}
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant].join(' ')}
            >
              <p className={styles.bubbleText}>{msg.content}</p>
              {msg.blueprintId && (
                generation.status === 'complete' && generation.blueprintId === msg.blueprintId
                  ? (
                    <button
                      className={styles.viewPlaylistBtn}
                      onClick={() => {
                        setResultBlueprintId(msg.blueprintId!)
                        setResultOpen(true)
                      }}
                    >
                      View playlist →
                    </button>
                  ) : generation.status === 'error' && generation.blueprintId === msg.blueprintId
                  ? <span className={styles.viewPlaylistBtn} style={{ color: 'var(--color-text-muted)' }}>Generation failed — try again</span>
                  : <span className={styles.viewPlaylistBtn} style={{ opacity: 0.5 }}>Creating playlist…</span>
              )}
            </div>
          ))}

          {loading && (
            <div className={[styles.bubble, styles.bubbleAssistant].join(' ')}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form className={styles.inputRow} onSubmit={sendMessage}>
          <input
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="What kind of playlist do you want?"
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
      </div>

      <PlaylistResult
        open={resultOpen}
        blueprintId={resultBlueprintId}
        platform={platform}
        onClose={() => { setResultOpen(false); generation.reset() }}
      />
    </>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
