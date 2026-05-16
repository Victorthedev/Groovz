import { randomUUID } from 'crypto'
import { redis } from '../../shared/utils/redis.js'
import { classifyMusicDomain, chatCompletion, type ChatMessage } from '../recommendation/clients/huggingface.js'
import { startGeneration } from '../recommendation/recommendation.service.js'

const CHAT_SESSION_TTL = 30 * 60  // 30 minutes
const GENERATE_TAG = /\[GENERATE\]([\s\S]*?)\[\/GENERATE\]/

interface ChatSession {
  sessionId: string
  userId: string
  platform: string
  history: ChatMessage[]
  lastBlueprintId?: string
}

export interface ChatResponse {
  sessionId: string
  message: string
  blueprintId?: string
  jobId?: string
}

export async function processMessage(
  userId: string,
  userMessage: string,
  platform: string,
  sessionId?: string,
): Promise<ChatResponse> {
  // §7 — classify BEFORE calling Mistral, reject off-topic cheaply
  const isMusicRelated = await classifyMusicDomain(userMessage)
  if (!isMusicRelated) {
    return {
      sessionId: sessionId ?? randomUUID(),
      message: 'I can only help with playlist creation.',
    }
  }

  const session = await loadOrCreateSession(userId, platform, sessionId)

  // Call Mistral with full conversation history
  const rawResponse = await chatCompletion(session.history, userMessage)

  // Update history
  session.history.push({ role: 'user', content: userMessage })
  session.history.push({ role: 'assistant', content: rawResponse })

  // Check if Mistral embedded a generation trigger
  let blueprintId: string | undefined
  let jobId: string | undefined

  const match = GENERATE_TAG.exec(rawResponse)
  if (match) {
    try {
      const trigger = JSON.parse(match[1]) as {
        type?: 'seed' | 'prompt' | 'hybrid'
        prompt?: string
        intent?: { energy?: string; tempo?: string; durationMinutes?: number }
      }

      if (trigger.prompt) {
        const result = await startGeneration({
          userId,
          type: trigger.type ?? 'prompt',
          platform,
          prompt: trigger.prompt,
          intent: trigger.intent as Parameters<typeof startGeneration>[0]['intent'],
        })

        blueprintId = result.blueprintId
        jobId = result.jobId
        session.lastBlueprintId = blueprintId
      }
    } catch {
      // Generation failure doesn't block the conversational response
    }
  }

  await saveSession(session)

  // Strip the [GENERATE] tag — user only sees the conversational message
  const message = rawResponse.replace(GENERATE_TAG, '').trim()

  return { sessionId: session.sessionId, message, blueprintId, jobId }
}

// ─── Session helpers ──────────────────────────────────────────────────────────

async function loadOrCreateSession(
  userId: string,
  platform: string,
  sessionId?: string,
): Promise<ChatSession> {
  if (sessionId) {
    const raw = await redis.get(`chat:${sessionId}`)
    if (raw) {
      const session = JSON.parse(raw) as ChatSession
      // Ensure the session belongs to this user
      if (session.userId === userId) return session
    }
  }

  return {
    sessionId: randomUUID(),
    userId,
    platform,
    history: [],
  }
}

async function saveSession(session: ChatSession): Promise<void> {
  await redis.setex(`chat:${session.sessionId}`, CHAT_SESSION_TTL, JSON.stringify(session))
}
