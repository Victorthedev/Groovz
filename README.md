# Groovz

A music intelligence platform

Groovz builds playlists using a custom recommendation engine that uses Last.fm as its candidate graph, Hugging Face for intent extraction, and a hand-written scoring algorithm. Tracks resolve onto Spotify, Deezer, Audiomack, or YouTube Music at export time only. The engine never touches any streaming platform's recommender.

---

## Table of Contents

- [What This Is](#what-this-is)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [The Recommendation Algorithm](#the-recommendation-algorithm)
- [ML Pipeline](#ml-pipeline)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Features](#features)
- [Frontend Screens](#frontend-screens)
- [Design System](#design-system)
- [Background Jobs](#background-jobs)
- [Deployment](#deployment)
- [Versioned Roadmap](#versioned-roadmap)

---

## What This Is

Groovz is a music intelligence platform. The core is a platform-agnostic playlist generation engine that:

- Uses **Last.fm** as its recommendation graph (candidate source, free API)
- Uses **Hugging Face** open-source models for text and intent understanding
- Has a **custom-written algorithm** for all scoring, ranking, randomness, and flow logic
- Resolves tracks onto **Spotify, Deezer, Audiomack, or YouTube Music** only at export time
- Builds a **per-user taste profile** from signals collected silently from day one
- Never depends on any streaming platform's recommender

---

## Monorepo Structure

```
groovz/
├── apps/
│   ├── api/                          # Backend — Fastify + Prisma + BullMQ
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── app.ts                # Entry point
│   │       ├── modules/
│   │       │   ├── auth/             # Signup, login, JWT, platform OAuth
│   │       │   ├── user/             # Preferences, capabilities, taste summary
│   │       │   ├── recommendation/   # Core playlist engine
│   │       │   │   ├── engine/
│   │       │   │   │   ├── generator.ts    # Session creation
│   │       │   │   │   ├── expander.ts     # Last.fm candidate expansion
│   │       │   │   │   ├── scorer.ts       # Scoring function
│   │       │   │   │   ├── sequencer.ts    # Post-selection ordering
│   │       │   │   │   ├── fatigue.ts      # Artist/tag diversity rules
│   │       │   │   │   ├── temperature.ts  # Temperature schedule
│   │       │   │   │   ├── duration.ts     # Duration management
│   │       │   │   │   └── normaliser.ts   # Title/artist normalisation
│   │       │   │   ├── clients/
│   │       │   │   │   ├── lastfm.ts       # Last.fm API client
│   │       │   │   │   └── huggingface.ts  # HF intent + embedding client
│   │       │   │   └── recommendation.service.ts
│   │       │   ├── resolver/         # Platform track matching
│   │       │   ├── export/           # Playlist creation on platforms
│   │       │   ├── blend/            # Session Blend — multi-user playlist
│   │       │   ├── chat/             # Conversational playlist building
│   │       │   ├── route/            # Road Trip route generation
│   │       │   │   ├── maps.client.ts
│   │       │   │   ├── route.service.ts
│   │       │   │   └── route.routes.ts
│   │       │   ├── ml/               # Taste profile computation
│   │       │   │   └── index.ts
│   │       │   ├── billing/          # Stripe subscriptions
│   │       │   ├── whatsapp/         # WhatsApp bot (v2)
│   │       │   └── admin/            # Owner-only analytics
│   │       ├── jobs/
│   │       │   ├── playlist-generation.job.ts   # BullMQ worker
│   │       │   ├── spotify-signals.job.ts        # Background signal collection
│   │       │   └── weekly-recommendation.job.ts  # Sunday ML generation cron
│   │       └── shared/
│   │           ├── types/            # Shared TypeScript interfaces
│   │           ├── utils/
│   │           │   ├── redis.ts
│   │           │   ├── prisma.ts
│   │           │   ├── socket.ts     # socket.io setup
│   │           │   ├── redis-serialise.ts  # Map/Set ↔ JSON
│   │           │   └── encryption.ts
│   │           └── data/
│   │               ├── tag-mappings.ts     # 300-tag energy/tempo table
│   │               └── context-cards.ts    # Context card sonic profiles
│   └── web/                          # Frontend — React + Vite + TypeScript
│       └── src/
│           ├── App.tsx               # Router + WebSocket listener
│           ├── screens/              # One file per screen
│           ├── components/           # Shared UI components
│           ├── hooks/                # useSocket, custom hooks
│           ├── store/                # Zustand stores (auth, generation, preferences)
│           ├── api/                  # Typed API client
│           └── styles/               # Global CSS variables
├── package.json                      # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── railway.toml                      # API deployment config
├── DESIGN.md                         # Master architecture document (read before coding)
└── FRONTEND.md                       # Frontend design and experience document
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Fastify v4 + TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Cache / session state | Redis (ioredis) |
| Job queue | BullMQ |
| Real-time | socket.io |
| AI — intent extraction | Hugging Face Inference API (Groq for intent) |
| Music metadata | Last.fm API |
| Maps | Google Maps JS API (classic) + Google Directions API |
| Payments | Stripe |
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Package manager | pnpm workspaces |

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL running locally
- Redis running locally

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Generate Prisma client and run migrations
pnpm --filter @groovz/api exec prisma generate
pnpm --filter @groovz/api exec prisma migrate dev

# Start both apps in parallel
pnpm dev
```

API runs on `http://localhost:3001`.
Web runs on `http://localhost:5173` (Vite default).

### Individual commands

```bash
# API only
pnpm --filter @groovz/api dev

# Web only
pnpm --filter @groovz/web dev

# Type-check everything
pnpm type-check

# Build everything
pnpm build

# Prisma Studio
pnpm --filter @groovz/api exec prisma studio

# New migration
pnpm --filter @groovz/api exec prisma migrate dev --name <name>
```

---

## Environment Variables

### `apps/api/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (use a long random string in prod) |
| `LASTFM_API_KEY` | Yes | Last.fm API key (free at last.fm/api) |
| `HF_API_KEY` | Yes | Hugging Face Inference API token |
| `GROQ_API_KEY` | Yes | Groq API key for fast intent extraction |
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret |
| `SPOTIFY_REDIRECT_URI` | Yes | OAuth callback URL |
| `GOOGLE_MAPS_API_KEY` | Yes | For Directions API (Road Trip backend) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `WEB_BASE_URL` | Yes | Frontend origin for CORS (e.g. `https://groovz.vercel.app`) |
| `OWNER_EMAIL` | Yes | Email that gets access to `/admin` analytics |
| `PORT` | No | Port to listen on (defaults to 3001) |

### `apps/web/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend URL (e.g. `https://groovzapi-production.up.railway.app`) |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | For Road Trip autocomplete and map display |
| `VITE_OWNER_EMAIL` | Yes | Email that can access `/admin` route |

---

## Architecture

### Modular monolith

Single deployable service with clean module boundaries. Module rules:

- Modules do not import directly from each other — they communicate via explicit service calls or the internal event bus
- No module accesses another module's database tables directly
- Shared types live in `shared/types` only
- API route handlers are thin — all logic lives in modules

### Request flow for playlist generation

```
POST /api/v1/playlists/generate
  → recommendation.service.ts (startGeneration)
    → fetch TasteProfile (ML signals)
    → resolve seed track via platform service
    → extract intent (Groq / HuggingFace)
    → expandFromSeed / expandFromPrompt / expandFromSeedDeepCuts (Last.fm)
    → createSession (PlaylistSession to Redis)
    → playlistGenerationQueue.add (BullMQ job)
    → return { jobId, blueprintId }

BullMQ worker (playlist-generation.job.ts)
  → fetch session + pool from Redis
  → run selection loop (scorer.ts + fatigue.ts + temperature.ts)
  → sequence tracks (sequencer.ts)
  → resolve tracks on target platform (resolver)
  → export to platform (export.service.ts)
  → store PlaylistBlueprint in Redis
  → emit playlist:ready via socket.io

Frontend receives playlist:ready WebSocket event
  → renders result
```

### Stateless backend

No in-memory state. Every piece of generation state lives in Redis with a 10-minute TTL. Horizontal scaling requires no architectural change — just add instances.

---

## Data Models

### PostgreSQL (Prisma)

**User** — core identity, email/password auth, region.

**ConnectedPlatform** — OAuth tokens for each streaming platform the user connects. Tokens are encrypted at rest. Platform track IDs never reach the frontend.

**UserPreferences** — default platform, default duration, diversity bias, WhatsApp linkage, signal consent toggle, list of feature intro modals the user has already seen.

**UserCapabilities** — plan tier (`free` or `paid`), playlist duration cap, monthly generation count, feature flags for route and WhatsApp.

**PlaylistRecord** — metadata for every playlist ever generated: type, seed track, prompt summary, duration, track count, narrative, platform URL. Full track lists are not stored — the blueprint lives in Redis during generation, exported to the platform, then discarded.

**UserSignal** — every signal collected for ML: `playlist_created`, `seed_used`, `prompt_used`, `context_used`, `spotify_top_track`, `spotify_recent_play`, `lastfm_scrobble`. JSON data field holds flexible per-signal payload. Indexed on `userId` and `recordedAt`.

**TasteProfile** — computed weekly per user. Stores: signal count, ML stage, energy/tempo centroids, novelty tolerance, genre/artist/tag affinity maps, temporal patterns (Stage 3), current phase descriptor. Replaces previous record entirely on each computation — not appended.

**Subscription** — Stripe subscription data.

**CryptoSubscription** — on-chain USDC subscription state (v2).

### Redis (temporary)

**PlaylistSession** — active generation state. TTL: 10 minutes. Contains: selected tracks, artist counts, tag counts, rejected IDs, blocked artists, temperature, iteration counter. Serialised via `redis-serialise.ts` (Maps → objects, Sets → arrays).

**CandidatePool** — raw candidates for active session. TTL: 10 minutes. Indexed by artist and tag for fast lookup.

**PlaylistBlueprint** — completed blueprint after generation. TTL: 24 hours. Used by the client to display the result before/after export.

**BlendSession** — multi-user blend session state. TTL: 30 minutes.

**ResolutionCache** — platform track ID resolution results. TTL: 1 hour.

---

## The Recommendation Algorithm

The scoring algorithm is custom-written. It does not call any AI service for recommendations. Last.fm is the candidate source; the algorithm decides what to include.

### Generation modes

| Mode | Seed | Prompt | Notes |
|---|---|---|---|
| `seed` | Required | No | 1-hop Last.fm track similarity |
| `prompt` | No | Required | Intent extraction → tag-based expansion |
| `hybrid` | Required | Required | Both seed and prompt |
| `weekly_ml` | No | No | TasteProfile is the implicit seed |

### Candidate expansion

**Seed mode:**
1. `track.getSimilar(title, artist)` — direct track similarity
2. `artist.getSimilar(seed_artist)` — similar artists
3. `artist.getTopAlbumTracks(similar_artists)` — their tracks from albums (not just top tracks)
4. Tag-based expansion from the seed artist's top tags

**Deep Cuts mode** (3 hops, popularity inverted):
1. Hop 1: `getSimilarArtists(seed)` — 15 artists
2. For each: `getSimilarArtists(hop1_artist)` — 10 more per artist
3. Album tracks only from the expanded set — never top tracks
4. Popularity weight dropped to 0.05 (vs 0.4 standard), novelty weight raised to 0.45

**Prompt mode:**
1. Extract tags from intent (Groq / HuggingFace)
2. `tag.getTopArtists(tags)` — artists per tag
3. Album tracks from those artists
4. Broader oversampling since there is no anchor track

**Oversampling targets:** ~400 candidates for 60-minute playlist, ~900 for 120-minute.

### Scoring function

For each candidate track during selection:

```
S_raw = (0.5 × S_base)
      + (0.15 × S_energy)
      + (0.15 × S_tempo)
      + (w_pop × S_pop)
      + (w_novel × S_novel)

S_raw = S_raw × P_artist × P_tag

samplingWeight = S_raw ^ (1 / T)
```

Where:
- `S_base` — Last.fm similarity (track + artist weighted 0.7/0.3)
- `S_energy`, `S_tempo` — derived from tag mapping table (300 tags, curated energy/tempo values)
- `w_pop` — lerp(0.4, 0.1, T) — popularity weight shrinks as temperature rises
- `w_novel` — lerp(0.1, 0.4, T) — novelty weight grows as temperature rises
- `P_artist` — 0.0 if artist hard cap exceeded, 0.6 near cap
- `P_tag` — 0.5–1.0 tag overuse penalty

**Selection:** top 20 candidates by `S_raw`, then `weightedRandom(top20, samplingWeight)`. Same input never produces the same playlist.

**With ML Stage 1+ active:**
```
S_raw += (0.1 + (mlStage - 1) × 0.05) × computeAffinityScore(track, affinityMaps)
```

### Temperature schedule

```
progress = currentDurationMs / targetDurationMs

if progress < 0.2:   T = 0.25
if progress < 0.6:   T = lerp(0.25, 0.6, ...)
else:                T = lerp(0.6, 0.85, ...)

// Modifiers
seed mode:    T -= 0.05
prompt mode:  T += 0.05
>90 min:      T *= 0.9

T = clamp(T, 0.2, 0.9)
```

### Diversity rules (hard, checked before scoring)

1. **Artist cap:** max 2 tracks per artist (3 for playlists over 70 minutes). Exceeded = immediate reject.
2. **Consecutive rule:** never two consecutive tracks from the same artist.
3. **Spacing rule:** minimum 3-track gap between same artist.
4. **Seed artist rule:** seed artist gets at most 2 tracks; after 40% through, max 1.
5. **Tag diversity:** if the last 4 tracks share a dominant tag, apply 0.5 penalty and force diversity.

### Tag mapping table

300 Last.fm tags mapped to `{ energy: 0.0–1.0 | null, tempo: 0.0–1.0 | null, weight: 0.0–0.9 }`. Weight tiers:
- 0.9 — genre tags (`techno`, `ambient`, `bluegrass`)
- 0.7 — mood tags (`melancholic`, `euphoric`)
- 0.6 — activity tags (`workout`, `coding`, `driving`)
- 0.0 — era, geographic, format, and opinion tags (explicit no-signal)

Source of truth: `apps/api/src/shared/data/tag-mappings.ts`.

### Sequence ordering (post-selection)

After the selection loop completes:
1. Sort loosely by energy ascending for the first 30%, plateau, slight lift at the end
2. Small swaps to avoid back-to-back similar artists
3. Avoid sudden energy spikes or drops between adjacent tracks

---

## ML Pipeline

ML activates per-user, not per app version. Rules-only mode runs for any user below threshold.

### Signal collection (day one)

All signals are collected silently from the moment a user signs up:

- `playlist_created` — after every generation
- `seed_used` — every seed track selection (with artist tags)
- `prompt_used` — every text prompt (hash stored, not raw text)
- `context_used` — every context card selection
- `playlist_regenerated` — same seed within 48 hours
- `spotify_top_track` — fetched weekly per connected Spotify user
- `spotify_recent_play` — fetched every 6 hours per connected Spotify user
- `lastfm_scrobble` — fetched daily per connected Last.fm user

### ML stages

| Stage | Threshold | What activates |
|---|---|---|
| 0 | < 50 signals | Rules-only. No affinity scoring. Cold-start UI. |
| 1 | 50+ signals | Weighted affinity scoring in generation. Weekly ML playlist. Taste Card. |
| 2 | 200+ signals | Collaborative filtering (finds users with similar taste profiles). |
| 3 | 500+ signals | Temporal pattern recognition. Moment Playlists. |

### Affinity computation (Stage 1)

```
affinity(entity) = Σ(signal_weight × recency_decay) / total_contributing_signals
```

Signal weights: `seed_used` (1.0) > `prompt_used` (0.8) > `context_used` (0.7) > `playlist_created` (0.6) > `spotify_top_track` (0.5) > `lastfm_scrobble` (0.4) > `spotify_recent_play` (0.3)

Recency decay: last 7 days (1.0) → last 30 days (0.7) → last 90 days (0.4) → older (0.1)

### TasteProfile

Computed weekly by `weekly-recommendation.job.ts` (cron: `0 2 * * 0`). Stored in PostgreSQL, replaces previous record. Fields: `energyCentroid`, `tempoCentroid`, `noveltyTolerance`, `genreAffinities`, `artistAffinities`, `tagAffinities`, `temporalPatterns` (Stage 3), `currentPhase`.

Source: `apps/api/src/modules/ml/index.ts`

---

## API Reference

All routes prefixed `/api/v1/`. Auth required on all except `/auth/*` and `/blend/:id` (public join page).

### Auth

```
POST   /api/v1/auth/signup          { email, password, region }
POST   /api/v1/auth/login           { email, password }
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
DELETE /api/v1/auth/account
```

### Platforms

```
POST   /api/v1/platforms/connect             { platform }   → returns OAuth URL
GET    /api/v1/platforms/callback/:platform  OAuth callback
GET    /api/v1/platforms/library             Fetch connected platform library
DELETE /api/v1/platforms/:platform           Disconnect platform
```

### Playlists

```
POST   /api/v1/playlists/generate
  Body: {
    type: 'seed' | 'prompt' | 'hybrid'
    platform: 'spotify' | 'deezer' | 'audiomack' | 'youtube_music'
    seedDisplayId?: string
    prompt?: string
    contextCardId?: string
    deepCuts?: boolean
    intent?: {
      energy?: 'low' | 'medium' | 'high'
      tempo?: 'slow' | 'medium' | 'fast'
      mood?: string[]
      tags?: string[]
      durationMinutes?: number
    }
  }
  Returns: { jobId, blueprintId }

GET    /api/v1/playlists/:id         Get completed blueprint
GET    /api/v1/playlists/history     User's playlist history (last 50)
POST   /api/v1/playlists/:id/export  Export blueprint to platform
```

### User

```
GET    /api/v1/user/preferences
PATCH  /api/v1/user/preferences
GET    /api/v1/user/capabilities
GET    /api/v1/user/taste-summary    Returns available: false | full TasteProfile summary
```

### Chat

```
POST   /api/v1/chat    { message, sessionId? }   Conversational playlist building
```

### Blend

```
POST   /api/v1/blend                  Create blend session (host)
GET    /api/v1/blend/:id              Get session state
POST   /api/v1/blend/:id/join         Authenticated user joins
POST   /api/v1/blend/:id/join-anon    Anonymous join
POST   /api/v1/blend/:id/taste        Submit cold-start taste profile
POST   /api/v1/blend/:id/generate     Host triggers blend generation
```

### Routes (Road Trip)

```
POST   /api/v1/routes/generate
  Body (loop):
  {
    type: 'loop'
    start: { lat, lng }
    targetDurationMinutes: number
    toleranceMinutes: number
    activity: 'drive' | 'walk' | 'jog' | 'cycle'
  }

  Body (directed):
  {
    type: 'directed'
    start: { lat, lng }
    destination: { lat, lng }
    activity: 'drive' | 'walk' | 'jog' | 'cycle'
  }

  Returns: {
    routeId
    estimatedDurationMinutes
    polyline
    waypoints
    mapsDeepLink
  }
```

### Billing

```
POST   /api/v1/billing/stripe/checkout
POST   /api/v1/billing/stripe/webhook  (Stripe webhook)
GET    /api/v1/billing/status
```

### Admin

```
GET    /api/v1/admin/stats   Owner-only (OWNER_EMAIL check). Returns aggregate platform stats.
```

### Health

```
GET    /health   Returns { status: 'ok' }
```

---

## WebSocket Events

The frontend connects via socket.io authenticated with the user's JWT. Rooms are scoped per `userId` — no user receives another user's events.

### Server → Client

```typescript
'playlist:ready'           { blueprintId: string }
'playlist:error'           { error: string }
'blend:participant_joined' { sessionId, participantId, displayName }
'blend:participant_left'   { sessionId, participantId }
'blend:participant_ready'  { sessionId, participantId }
'blend:generating'         { sessionId }
'blend:ready'              { sessionId, blueprintId }
'blend:failed'             { sessionId, reason }
```

The frontend does not poll. It receives `playlist:ready` the moment the BullMQ job completes.

---

## Features

### Make a Playlist

Standard generation. Pick a seed track from your connected platform library, write a text prompt, or both. Optional context cards to merge a situational sonic profile into the intent. Optional Deep Cuts mode for discovery-first generation (inverted popularity, 3-hop expansion).

### Deep Cuts

Deliberately avoids popular tracks. Goes 3 hops deep into the Last.fm similarity graph from the seed artist. Uses artist similarity then album tracks only — never top tracks. Novelty weight raised to 0.45, popularity weight dropped to 0.05.

### Session Blend

Up to 4 users merge taste profiles into one playlist. Host generates a shareable link and QR code. Participants join without needing to be friends or contacts. Cold-start users (below ML threshold) go through a 3-question quick selector. Generation finds the genuine intersection across all profiles: 70% shared affinities, 30% each person's unique contribution. Each participant exports independently to their own platform.

### Road Trip

Generates a route and a playlist that fits it exactly. Two modes:
- **Loop** — you set duration and activity, the algorithm computes a circular route using Google Directions API with up to 5 radius iterations to match the target duration
- **Directed (A to B)** — enter start and destination, duration is derived from the route

Location inputs use Google Maps AutocompleteService with Geocoder for precision. After generation, a "Open in Google Maps" deep link is shown alongside the Spotify export button.

### Weekly ML Playlist (Rolling Playlist)

Runs every Sunday at 02:00 UTC. For each user at ML Stage 1+, computes a playlist using their current TasteProfile as the implicit seed. The playlist is exported to their default platform automatically. Activates passively — users don't configure it.

### Context Cards

Situation-based sonic profiles that merge into intent. Pre-match warmup, Can't sleep, Deep focus, Running, Flight, and more. Each card has a curated energy arc, preferred and avoided tags, and tempo/energy ranges.

### Taste Card

A shareable image generated in-app via Canvas API. Shows the user's current phase label, top 3 genres, a frequency bar visualiser with bar heights representing genre energy affinities, and a descriptor line. Looks like album artwork. Every card has Groovz branding.

### Conversational Generation

Chat-style interface. Messages are classified before being sent to HuggingFace. Non-music messages return a fixed rejection message and are never forwarded. Intent is extracted from the conversation and fed into the standard generation engine.

### Owner Analytics

Private dashboard at `/admin`. Accessible only if the authenticated user's email matches `VITE_OWNER_EMAIL`. All numbers are direct Prisma aggregate queries — no external analytics service.

---

## Frontend Screens

| Route | Auth | Description |
|---|---|---|
| `/auth` | No | Login and signup |
| `/onboarding` | Yes | Platform connection + data consent |
| `/` | Yes | Generate home (4 mode cards + Taste Card section) |
| `/library` | Yes | Playlist history |
| `/discover` | Yes | Weekly ML playlist + taste insights |
| `/profile` | Yes | Account, connected platforms, preferences, legal links |
| `/chat` | Yes | Conversational generation |
| `/blend/start` | Yes | Blend waiting room (host) |
| `/blend/:id` | No | Blend join page (public) |
| `/road-trip` | Yes | Road Trip route + playlist generation |
| `/taste-card` | Yes | Shareable taste card |
| `/privacy` | No | Privacy Policy |
| `/terms` | No | Terms of Service |
| `/admin` | Yes (owner) | Analytics dashboard |

---

## Design System

Dark only. Two fonts. Custom SVG icons only.

### Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0A0A0A` | Primary background |
| `--color-surface` | `#111111` | Cards, sheets |
| `--color-surface-raised` | `#1A1A1A` | Modals, overlays |
| `--color-accent` | `#7B1F1F` | Oxblood — CTAs, active states, visualiser |
| `--color-text-primary` | `#F0F0F0` | Primary text |
| `--color-text-secondary` | `#888888` | Metadata, labels |
| `--color-text-muted` | `#444444` | Disabled, placeholders |

No gradients on backgrounds or cards. Gradients only on the frequency visualiser bars and the generation pill.

### Typography

- **Clash Display** — headings, wordmark, expressive text. Loaded from Fontshare. Sizes 24px and above.
- **Inter** — all body text, track names, labels, inputs. Loaded from Fontsource. Sizes 23px and below.

### Motion

CSS transforms and opacity only. Never animate width, height, margin, or padding — these cause layout thrashing on mobile. All animations respect `prefers-reduced-motion`.

### The frequency visualiser

The core visual motif. 24 bars driven by `requestAnimationFrame`. Canvas API for full-screen version, DOM for the pill version. Appears in: the splash screen, the generation loading state, the generate pill, the bottom nav Generate tab, empty states. The JavaScript loop pauses when `document.visibilityState` is hidden.

---

## Background Jobs

All jobs use BullMQ with a shared Redis connection.

### `playlist-generation` queue

Worker process: `startPlaylistGenerationWorker()`. One job per generation request. Fetches session and candidate pool from Redis, runs the selection loop, sequences tracks, resolves on the target platform, exports, stores the blueprint, emits `playlist:ready`.

### `spotify-signals` queue

Two repeating jobs started by `startSpotifySignalJobs()`:

- **recently_played** — fetches the last 50 Spotify recently played tracks per user every 6 hours. Stores as `spotify_recent_play` signals. Skips duplicates by `(trackId + playedAt)`.
- **top_tracks** — fetches Spotify top tracks (short, medium, long term) every Sunday. Stores as `spotify_top_track` signals.

Only runs for users who have Spotify connected and `spotifySignalEnabled = true`.

### `weekly-recommendation` queue

Cron: `0 2 * * 0` (Sunday 02:00 UTC). Started by `startWeeklyRecommendationJob()`.

For each user with a TasteProfile at ML Stage 1+:
1. Fetches TasteProfile
2. Builds intent from top tags and sonic centroids
3. Expands candidates via `expandFromPrompt`
4. Generates a `weekly_ml` playlist
5. Exports to the user's default platform

---

## Deployment

### Backend (Railway)

Config in `railway.toml`:

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install -g pnpm@9 && pnpm install --frozen-lockfile && pnpm --filter @groovz/api exec prisma generate && pnpm --filter @groovz/api build"

[deploy]
startCommand = "pnpm --filter @groovz/api exec prisma migrate deploy && node apps/api/dist/app.js"
healthcheckPath = "/health"
healthcheckTimeout = 60
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

Railway automatically runs `prisma migrate deploy` before starting the server. The health check endpoint `/health` returns `{ status: 'ok' }`.

### Frontend (Vercel)

Config in `apps/web/vercel.json`. All routes rewrite to `/index.html` (SPA). Content Security Policy is set in response headers:

- `script-src` includes `maps.googleapis.com` and `maps.gstatic.com` for the Google Maps JS API
- `connect-src` includes the Railway API URL, WebSocket URL, and `maps.googleapis.com`
- `img-src` includes Spotify CDN domains and Google Maps static

### Required services

| Service | Purpose |
|---|---|
| PostgreSQL | Primary database (Railway provides managed instance) |
| Redis | Session state, job queues, resolution cache (Railway provides managed instance) |
| Vercel | Frontend hosting and CDN |
| Railway | Backend hosting |
| Spotify Developer App | OAuth + library + export |
| Last.fm API | Recommendation graph (free, no auth for most endpoints) |
| Hugging Face | Intent extraction and embeddings (free tier sufficient) |
| Groq | Fast intent extraction (free tier sufficient) |
| Google Maps Platform | Road Trip directions (free tier sufficient for personal use) |

---

## Versioned Roadmap

| Version | Scope | Status |
|---|---|---|
| v1 | Core engine (seed + prompt + hybrid), Deep Cuts, Session Blend, ML pipeline, Road Trip, Privacy/Terms, Stripe billing | Complete |
| v2 | WhatsApp bot, crypto subscriptions, Deezer/Audiomack/YouTube Music OAuth, Taste Timeline UI, Context Cards personalisation | Planned |
| v3 | Drive Chapters, Rolling Playlist notifications, Moment Playlists | Planned |
| v4 | SageMaker / proper ML infrastructure (only if usage data justifies it) | Future |

---

## Key Design Decisions

**No streaming platform recommenders.** Last.fm is the only recommendation source. Platform APIs are used for library reading, track search/resolution, and playlist export only.

**Platform track IDs never reach the frontend.** Backend maintains the mapping from `displayId` (a Groovz-internal temporary ID) to platform track ID. The frontend only ever sees display IDs.

**Generation is always async.** `POST /api/v1/playlists/generate` returns `{ jobId, blueprintId }` immediately. The frontend never polls — it receives `playlist:ready` via WebSocket the moment the BullMQ job completes.

**ML activates per user, not per release.** User A may have ML active in week 3. User B who joined later is still on rules-only in week 5. The system degrades gracefully.

**Redis serialisation is centralised.** `PlaylistSession` and `CandidatePool` use `Map` and `Set` internally. All Redis reads and writes go through `redis-serialise.ts` — never raw `JSON.stringify`. Maps serialise as plain objects; Sets as arrays.

**Prisma nullable JSON uses `Prisma.DbNull`.** Prisma rejects plain `null` for nullable `Json` fields. Always use `Prisma.DbNull` for null values in upserts.

**No feature gates removed from code.** Premium gates are commented out, not deleted. The comment explains what was gated and why it was removed.