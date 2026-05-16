import { createHash } from 'crypto'
import { redis } from '../../../shared/utils/redis.js'
import { TAG_MAPPINGS, normaliseTag } from '../../../shared/data/tag-mappings.js'
import type { Intent } from '../../../shared/types/index.js'

const HF_BASE = 'https://api-inference.huggingface.co/models'
const INTENT_MODEL  = 'facebook/bart-large-mnli'
const EMBED_MODEL   = 'sentence-transformers/all-MiniLM-L6-v2'
const EMBED_CACHE_TTL = 60 * 60 * 24  // 24 hours (§7)

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL   = 'llama-3.1-8b-instant'

// System prompt — locked per §7. Never modify without explicit instruction.
const CHAT_SYSTEM_PROMPT = `You are a playlist assistant. You only respond to music and playlist-related requests. If the user asks anything unrelated to music, playlists, or audio, respond only with: "I can only help with playlist creation." Never deviate from this. Never discuss other topics.

When you have gathered enough information to generate a playlist (mood, vibe, genre, or activity is clear), include a generation trigger at the very end of your response in this exact format and nothing after it:
[GENERATE]{"type":"prompt","prompt":"<one-sentence description of the playlist>","intent":{"energy":"<low|medium|high>","durationMinutes":<number, default 60>}}[/GENERATE]

Only include the trigger once you are confident. If the user has not given enough context, ask one short clarifying question first.`

// ─── Intent extraction ────────────────────────────────────────────────────────

export async function extractIntent(prompt: string): Promise<Intent> {
  const intent: Intent = {}

  // Parse explicit duration request ("2 hours", "45 minutes", etc.)
  const durationMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(hour|hr|h|minute|min|m)\b/i)
  if (durationMatch) {
    const value = parseFloat(durationMatch[1])
    const unit = durationMatch[2].toLowerCase()
    intent.durationRequestedMs = unit.startsWith('h')
      ? value * 60 * 60 * 1000
      : value * 60 * 1000
  }

  // Classify energy level
  try {
    const energyResult = await zeroShotClassify(prompt, [
      'high energy', 'medium energy', 'low energy',
    ])
    const top = energyResult[0]
    if (top && energyResult[0].score > 0.5) {
      if (top.label === 'high energy') intent.energy = 'high'
      else if (top.label === 'low energy') intent.energy = 'low'
      else intent.energy = 'medium'
    }
  } catch {
    // HF failure — intent.energy stays undefined, scoring defaults to 0.5
  }

  // Classify tempo
  try {
    const tempoResult = await zeroShotClassify(prompt, [
      'fast tempo', 'medium tempo', 'slow tempo',
    ])
    const top = tempoResult[0]
    if (top && top.score > 0.5) {
      if (top.label === 'fast tempo') intent.tempo = 'fast'
      else if (top.label === 'slow tempo') intent.tempo = 'slow'
      else intent.tempo = 'medium'
    }
  } catch {
    // intent.tempo stays undefined
  }

  // Derive tags by matching prompt tokens against the tag mapping table
  intent.tags = extractTagsFromPrompt(prompt)

  return intent
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const cacheKey = `embed:${createHash('sha256').update(text).digest('hex').slice(0, 16)}`

  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as number[]

  const res = await hfFetch(EMBED_MODEL, { inputs: text })
  const raw = await res.json() as number[][] | number[][][]

  // sentence-transformers returns [[vector]] for a single input
  const vector = Array.isArray(raw[0]) && Array.isArray((raw[0] as number[][])[0])
    ? meanPool(raw as number[][][])
    : (raw as number[][])[0]

  await redis.setex(cacheKey, EMBED_CACHE_TTL, JSON.stringify(vector))
  return vector
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ZeroShotResult {
  label: string
  score: number
}

async function zeroShotClassify(
  text: string,
  labels: string[],
): Promise<ZeroShotResult[]> {
  const res = await hfFetch(INTENT_MODEL, {
    inputs: text,
    parameters: { candidate_labels: labels },
  })
  const data = await res.json() as { labels: string[]; scores: number[] }
  return data.labels.map((label, i) => ({ label, score: data.scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

async function hfFetch(model: string, body: unknown): Promise<Response> {
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) throw new Error('HUGGINGFACE_API_KEY not configured')

  const res = await fetch(`${HF_BASE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HuggingFace ${res.status} for ${model}`)
  return res
}

function meanPool(tensor: number[][][]): number[] {
  // tensor shape: [1, tokens, dims] — average over tokens
  const vecs = tensor[0]
  if (!vecs || vecs.length === 0) return []
  const dims = vecs[0].length
  const result = new Array<number>(dims).fill(0)
  for (const vec of vecs) {
    for (let i = 0; i < dims; i++) result[i] += vec[i]
  }
  return result.map(v => v / vecs.length)
}

// ─── Domain classification (§7) ───────────────────────────────────────────────
// Classify before sending to Mistral — reject off-topic messages cheaply.
// Fails open: if HF is down, allow the message through.

export async function classifyMusicDomain(message: string): Promise<boolean> {
  try {
    const results = await zeroShotClassify(message, [
      'music playlist request',
      'unrelated non-music topic',
    ])
    return results[0]?.label === 'music playlist request'
  } catch {
    return true
  }
}

// ─── Conversational chat (§7) ─────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')

  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role as string, content: m.content })),
    { role: 'user', content: userMessage },
  ]

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 500, temperature: 0.7 }),
  })

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0]?.message.content?.trim() ?? "I'm having trouble right now. Please try again."
}

// ─── Match prompt words against the tag mapping keys (§16.3). ────────────────
function extractTagsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const found: string[] = []

  for (const tag of Object.keys(TAG_MAPPINGS)) {
    const mapping = TAG_MAPPINGS[tag]
    if (!mapping || mapping.weight === 0) continue
    if (lower.includes(normaliseTag(tag))) found.push(tag)
  }

  return found
}
