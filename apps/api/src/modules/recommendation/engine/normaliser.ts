import { createHash } from 'crypto'

const STRIP_PATTERNS = [
  /\s*[\(\[]\s*remaster(ed)?\s*[\)\]]/gi,
  /\s*-\s*remaster(ed)?(\s+\d{4})?$/gi,
  /\s*[\(\[]\s*\d{4}\s+remaster\s*[\)\]]/gi,
  /\s*[\(\[]\s*feat\.?\s+[^\)\]]+[\)\]]/gi,
  /\s*ft\.?\s+.+$/gi,
  /\s*[\(\[]\s*live[^\)\]]*[\)\]]/gi,
  /\s*-\s*live(\s+at\s+.+)?$/gi,
  /\s*[\(\[]\s*acoustic[^\)\]]*[\)\]]/gi,
  /\s*-\s*acoustic$/gi,
  /\s*[\(\[]\s*radio edit\s*[\)\]]/gi,
  /\s*-\s*radio edit$/gi,
]

export function normaliseTitle(title: string): string {
  let t = title.toLowerCase()
  for (const pattern of STRIP_PATTERNS) t = t.replace(pattern, '')
  return t.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function normaliseArtist(artist: string): string {
  return artist.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function canonicalId(artist: string, title: string): string {
  const key = `${normaliseArtist(artist)}::${normaliseTitle(title)}`
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}
