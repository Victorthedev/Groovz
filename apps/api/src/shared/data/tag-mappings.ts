export interface TagMapping {
  energy: number | null
  tempo: number | null
  weight: number
}

export const TAG_MAPPINGS: Record<string, TagMapping> = {

  // AMBIENT / DRONE / EXPERIMENTAL
  'ambient':                { energy: 0.1,  tempo: 0.15, weight: 0.9 },
  'dark ambient':           { energy: 0.15, tempo: 0.1,  weight: 0.9 },
  'drone':                  { energy: 0.1,  tempo: 0.05, weight: 0.9 },
  'noise':                  { energy: 0.7,  tempo: null, weight: 0.8 },
  'experimental':           { energy: null, tempo: null, weight: 0.3 },
  'avant garde':            { energy: null, tempo: null, weight: 0.3 },
  'field recordings':       { energy: 0.05, tempo: 0.05, weight: 0.8 },
  'musique concrete':       { energy: 0.15, tempo: null, weight: 0.8 },
  'sound art':              { energy: 0.05, tempo: 0.05, weight: 0.7 },
  'space music':            { energy: 0.1,  tempo: 0.1,  weight: 0.8 },

  // CLASSICAL / ORCHESTRAL
  'classical':              { energy: 0.3,  tempo: null, weight: 0.9 },
  'orchestral':             { energy: 0.35, tempo: null, weight: 0.9 },
  'chamber music':          { energy: 0.25, tempo: null, weight: 0.9 },
  'opera':                  { energy: 0.45, tempo: null, weight: 0.9 },
  'baroque':                { energy: 0.3,  tempo: 0.45, weight: 0.9 },
  'romantic':               { energy: 0.35, tempo: null, weight: 0.8 },
  'contemporary classical': { energy: 0.3,  tempo: null, weight: 0.9 },
  'minimalism':             { energy: 0.15, tempo: 0.2,  weight: 0.9 },
  'neo classical':          { energy: 0.25, tempo: null, weight: 0.9 },
  'neoclassical':           { energy: 0.25, tempo: null, weight: 0.9 },
  'piano':                  { energy: 0.25, tempo: null, weight: 0.7 },
  'violin':                 { energy: 0.3,  tempo: null, weight: 0.6 },
  'choral':                 { energy: 0.3,  tempo: null, weight: 0.8 },
  'symphony':               { energy: 0.4,  tempo: null, weight: 0.8 },

  // JAZZ
  'jazz':                   { energy: 0.4,  tempo: null, weight: 0.9 },
  'jazz fusion':            { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'bebop':                  { energy: 0.6,  tempo: 0.75, weight: 0.9 },
  'smooth jazz':            { energy: 0.25, tempo: 0.3,  weight: 0.9 },
  'free jazz':              { energy: 0.65, tempo: null, weight: 0.9 },
  'acid jazz':              { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'swing':                  { energy: 0.55, tempo: 0.65, weight: 0.9 },
  'big band':               { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'bossa nova':             { energy: 0.35, tempo: 0.4,  weight: 0.9 },
  'nu jazz':                { energy: 0.45, tempo: 0.45, weight: 0.9 },

  // BLUES
  'blues':                  { energy: 0.45, tempo: 0.4,  weight: 0.9 },
  'electric blues':         { energy: 0.55, tempo: 0.45, weight: 0.9 },
  'delta blues':            { energy: 0.35, tempo: 0.3,  weight: 0.9 },
  'chicago blues':          { energy: 0.5,  tempo: 0.45, weight: 0.9 },
  'blues rock':             { energy: 0.6,  tempo: 0.55, weight: 0.9 },

  // SOUL / R&B / FUNK
  'soul':                   { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'r&b':                    { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'rnb':                    { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'funk':                   { energy: 0.7,  tempo: 0.65, weight: 0.9 },
  'neo soul':               { energy: 0.45, tempo: 0.45, weight: 0.9 },
  'contemporary r&b':       { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'motown':                 { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'gospel':                 { energy: 0.6,  tempo: 0.55, weight: 0.9 },

  // FOLK / ACOUSTIC / SINGER-SONGWRITER
  'folk':                   { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'acoustic':               { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'singer songwriter':      { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'singer-songwriter':      { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'folk rock':              { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'indie folk':             { energy: 0.35, tempo: 0.4,  weight: 0.9 },
  'americana':              { energy: 0.4,  tempo: 0.4,  weight: 0.9 },
  'country':                { energy: 0.45, tempo: 0.5,  weight: 0.9 },
  'bluegrass':              { energy: 0.55, tempo: 0.65, weight: 0.9 },
  'country rock':           { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'alt country':            { energy: 0.45, tempo: 0.45, weight: 0.9 },

  // INDIE / ALTERNATIVE
  'indie':                  { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'indie rock':             { energy: 0.6,  tempo: 0.55, weight: 0.9 },
  'indie pop':              { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'alternative':            { energy: 0.55, tempo: 0.5,  weight: 0.9 },
  'alternative rock':       { energy: 0.6,  tempo: 0.55, weight: 0.9 },
  'dream pop':              { energy: 0.35, tempo: 0.35, weight: 0.9 },
  'shoegaze':               { energy: 0.45, tempo: 0.4,  weight: 0.9 },
  'post rock':              { energy: 0.45, tempo: 0.35, weight: 0.9 },
  'math rock':              { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'emo':                    { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'lo fi':                  { energy: 0.25, tempo: 0.3,  weight: 0.9 },
  'lo-fi':                  { energy: 0.25, tempo: 0.3,  weight: 0.9 },
  'chillwave':              { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'bedroom pop':            { energy: 0.3,  tempo: 0.35, weight: 0.9 },
  'art rock':               { energy: 0.5,  tempo: 0.45, weight: 0.9 },

  // POP
  'pop':                    { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'synthpop':               { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'electropop':             { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'dance pop':              { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'teen pop':               { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'art pop':                { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'chamber pop':            { energy: 0.4,  tempo: 0.4,  weight: 0.9 },
  'baroque pop':            { energy: 0.45, tempo: 0.45, weight: 0.9 },
  'bubblegum':              { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'k-pop':                  { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'j-pop':                  { energy: 0.65, tempo: 0.65, weight: 0.9 },

  // HIP HOP / RAP
  'hip hop':                { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'hip-hop':                { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'rap':                    { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'trap':                   { energy: 0.7,  tempo: 0.55, weight: 0.9 },
  'drill':                  { energy: 0.75, tempo: 0.55, weight: 0.9 },
  'grime':                  { energy: 0.75, tempo: 0.65, weight: 0.9 },
  'lo fi hip hop':          { energy: 0.25, tempo: 0.35, weight: 0.9 },
  'conscious hip hop':      { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'gangsta rap':            { energy: 0.7,  tempo: 0.6,  weight: 0.9 },
  'old school hip hop':     { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'cloud rap':              { energy: 0.4,  tempo: 0.4,  weight: 0.9 },
  'mumble rap':             { energy: 0.55, tempo: 0.5,  weight: 0.8 },
  'afrobeats':              { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'afropop':                { energy: 0.7,  tempo: 0.7,  weight: 0.9 },

  // ROCK
  'rock':                   { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'classic rock':           { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'hard rock':              { energy: 0.8,  tempo: 0.7,  weight: 0.9 },
  'soft rock':              { energy: 0.4,  tempo: 0.45, weight: 0.9 },
  'psychedelic rock':       { energy: 0.55, tempo: 0.5,  weight: 0.9 },
  'progressive rock':       { energy: 0.55, tempo: 0.5,  weight: 0.9 },
  'prog rock':              { energy: 0.55, tempo: 0.5,  weight: 0.9 },
  'glam rock':              { energy: 0.7,  tempo: 0.65, weight: 0.9 },
  'garage rock':            { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'surf rock':              { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'post punk':              { energy: 0.6,  tempo: 0.55, weight: 0.9 },
  'new wave':               { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'britpop':                { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'grunge':                 { energy: 0.7,  tempo: 0.6,  weight: 0.9 },

  // METAL
  'metal':                  { energy: 0.9,  tempo: 0.75, weight: 0.9 },
  'heavy metal':            { energy: 0.9,  tempo: 0.75, weight: 0.9 },
  'death metal':            { energy: 0.95, tempo: 0.9,  weight: 0.9 },
  'black metal':            { energy: 0.9,  tempo: 0.85, weight: 0.9 },
  'thrash metal':           { energy: 0.95, tempo: 0.9,  weight: 0.9 },
  'doom metal':             { energy: 0.7,  tempo: 0.2,  weight: 0.9 },
  'sludge metal':           { energy: 0.75, tempo: 0.25, weight: 0.9 },
  'power metal':            { energy: 0.9,  tempo: 0.8,  weight: 0.9 },
  'progressive metal':      { energy: 0.8,  tempo: 0.65, weight: 0.9 },
  'metalcore':              { energy: 0.9,  tempo: 0.8,  weight: 0.9 },
  'deathcore':              { energy: 0.95, tempo: 0.85, weight: 0.9 },
  'nu metal':               { energy: 0.8,  tempo: 0.7,  weight: 0.9 },
  'folk metal':             { energy: 0.75, tempo: 0.65, weight: 0.9 },

  // PUNK
  'punk':                   { energy: 0.85, tempo: 0.8,  weight: 0.9 },
  'punk rock':              { energy: 0.85, tempo: 0.8,  weight: 0.9 },
  'pop punk':               { energy: 0.8,  tempo: 0.75, weight: 0.9 },
  'hardcore':               { energy: 0.95, tempo: 0.85, weight: 0.9 },
  'hardcore punk':          { energy: 0.95, tempo: 0.85, weight: 0.9 },
  'ska punk':               { energy: 0.8,  tempo: 0.8,  weight: 0.9 },
  'ska':                    { energy: 0.7,  tempo: 0.75, weight: 0.9 },
  'anarcho punk':           { energy: 0.9,  tempo: 0.8,  weight: 0.9 },

  // ELECTRONIC / EDM
  'electronic':             { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'edm':                    { energy: 0.8,  tempo: 0.8,  weight: 0.9 },
  'house':                  { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'deep house':             { energy: 0.6,  tempo: 0.65, weight: 0.9 },
  'tech house':             { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'progressive house':      { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'electro house':          { energy: 0.85, tempo: 0.8,  weight: 0.9 },
  'techno':                 { energy: 0.85, tempo: 0.85, weight: 0.9 },
  'trance':                 { energy: 0.8,  tempo: 0.85, weight: 0.9 },
  'psytrance':              { energy: 0.85, tempo: 0.9,  weight: 0.9 },
  'drum and bass':          { energy: 0.9,  tempo: 0.95, weight: 0.9 },
  'dnb':                    { energy: 0.9,  tempo: 0.95, weight: 0.9 },
  'jungle':                 { energy: 0.85, tempo: 0.9,  weight: 0.9 },
  'dubstep':                { energy: 0.85, tempo: 0.65, weight: 0.9 },
  'brostep':                { energy: 0.9,  tempo: 0.7,  weight: 0.9 },
  'future bass':            { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'trap edm':               { energy: 0.75, tempo: 0.6,  weight: 0.9 },
  'breakbeat':              { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'breaks':                 { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'garage':                 { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'uk garage':              { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'electronica':            { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'idm':                    { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'glitch':                 { energy: 0.55, tempo: null, weight: 0.8 },
  'synthwave':              { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'retrowave':              { energy: 0.6,  tempo: 0.6,  weight: 0.9 },
  'vaporwave':              { energy: 0.2,  tempo: 0.25, weight: 0.9 },
  'hyperpop':               { energy: 0.85, tempo: 0.8,  weight: 0.9 },
  'electro':                { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'minimal techno':         { energy: 0.65, tempo: 0.75, weight: 0.9 },
  'afrohouse':              { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'amapiano':               { energy: 0.65, tempo: 0.6,  weight: 0.9 },

  // DANCE / DISCO
  'dance':                  { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'disco':                  { energy: 0.75, tempo: 0.75, weight: 0.9 },
  'nu disco':               { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'eurodance':              { energy: 0.8,  tempo: 0.8,  weight: 0.9 },
  'dancehall':              { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'soca':                   { energy: 0.8,  tempo: 0.8,  weight: 0.9 },
  'cumbia':                 { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'salsa':                  { energy: 0.75, tempo: 0.8,  weight: 0.9 },
  'merengue':               { energy: 0.8,  tempo: 0.85, weight: 0.9 },
  'bachata':                { energy: 0.55, tempo: 0.55, weight: 0.9 },
  'reggaeton':              { energy: 0.75, tempo: 0.7,  weight: 0.9 },
  'latin pop':              { energy: 0.65, tempo: 0.65, weight: 0.9 },

  // REGGAE / DUB
  'reggae':                 { energy: 0.5,  tempo: 0.5,  weight: 0.9 },
  'dub':                    { energy: 0.45, tempo: 0.45, weight: 0.9 },
  'roots reggae':           { energy: 0.45, tempo: 0.45, weight: 0.9 },

  // WORLD MUSIC
  'world':                  { energy: null, tempo: null, weight: 0.3 },
  'world music':            { energy: null, tempo: null, weight: 0.3 },
  'african':                { energy: 0.65, tempo: 0.65, weight: 0.6 },
  'afrobeat':               { energy: 0.7,  tempo: 0.7,  weight: 0.9 },
  'highlife':               { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'indian classical':       { energy: 0.35, tempo: null, weight: 0.9 },
  'bollywood':              { energy: 0.65, tempo: 0.65, weight: 0.9 },
  'flamenco':               { energy: 0.65, tempo: 0.6,  weight: 0.9 },
  'celtic':                 { energy: 0.5,  tempo: 0.55, weight: 0.9 },
  'fado':                   { energy: 0.3,  tempo: 0.3,  weight: 0.9 },
  'tango':                  { energy: 0.6,  tempo: 0.55, weight: 0.9 },

  // DOWNTEMPO / TRIP HOP / CHILLOUT
  'downtempo':              { energy: 0.3,  tempo: 0.3,  weight: 0.9 },
  'trip hop':               { energy: 0.4,  tempo: 0.35, weight: 0.9 },
  'chillout':               { energy: 0.25, tempo: 0.3,  weight: 0.9 },
  'chill':                  { energy: 0.25, tempo: 0.3,  weight: 0.8 },
  'chillhop':               { energy: 0.3,  tempo: 0.35, weight: 0.9 },

  // MOOD TAGS
  'melancholic':            { energy: 0.25, tempo: 0.3,  weight: 0.7 },
  'melancholy':             { energy: 0.25, tempo: 0.3,  weight: 0.7 },
  'sad':                    { energy: 0.2,  tempo: 0.25, weight: 0.7 },
  'emotional':              { energy: 0.35, tempo: null, weight: 0.7 },
  'heartbreak':             { energy: 0.3,  tempo: 0.3,  weight: 0.7 },
  'nostalgic':              { energy: 0.35, tempo: 0.35, weight: 0.7 },
  'nostalgia':              { energy: 0.35, tempo: 0.35, weight: 0.7 },
  'happy':                  { energy: 0.65, tempo: 0.6,  weight: 0.7 },
  'uplifting':              { energy: 0.7,  tempo: 0.65, weight: 0.7 },
  'euphoric':               { energy: 0.85, tempo: 0.8,  weight: 0.7 },
  'energetic':              { energy: 0.8,  tempo: null, weight: 0.7 },
  'upbeat':                 { energy: 0.7,  tempo: 0.7,  weight: 0.7 },
  'aggressive':             { energy: 0.9,  tempo: null, weight: 0.7 },
  'angry':                  { energy: 0.85, tempo: null, weight: 0.7 },
  'dark':                   { energy: 0.45, tempo: null, weight: 0.6 },
  'atmospheric':            { energy: 0.2,  tempo: 0.2,  weight: 0.7 },
  'haunting':               { energy: 0.3,  tempo: 0.2,  weight: 0.7 },
  'epic':                   { energy: 0.75, tempo: null, weight: 0.7 },
  'love':                   { energy: 0.4,  tempo: null, weight: 0.6 },
  'peaceful':               { energy: 0.15, tempo: 0.2,  weight: 0.7 },
  'calm':                   { energy: 0.15, tempo: 0.2,  weight: 0.7 },
  'relaxing':               { energy: 0.15, tempo: 0.2,  weight: 0.7 },
  'mellow':                 { energy: 0.3,  tempo: 0.3,  weight: 0.7 },
  'groovy':                 { energy: 0.65, tempo: 0.65, weight: 0.7 },
  'funky':                  { energy: 0.7,  tempo: 0.65, weight: 0.7 },
  'sexy':                   { energy: 0.5,  tempo: 0.5,  weight: 0.6 },
  'dreamy':                 { energy: 0.25, tempo: 0.25, weight: 0.7 },
  'introspective':          { energy: 0.25, tempo: 0.3,  weight: 0.7 },
  'intense':                { energy: 0.85, tempo: null, weight: 0.7 },
  'powerful':               { energy: 0.8,  tempo: null, weight: 0.7 },
  'beautiful':              { energy: null, tempo: null, weight: 0.2 },
  'soulful':                { energy: 0.5,  tempo: null, weight: 0.6 },
  'raw':                    { energy: 0.65, tempo: null, weight: 0.6 },
  'heavy':                  { energy: 0.8,  tempo: null, weight: 0.7 },
  'gentle':                 { energy: 0.2,  tempo: 0.25, weight: 0.7 },
  'hypnotic':               { energy: 0.45, tempo: 0.45, weight: 0.7 },
  'psychedelic':            { energy: 0.55, tempo: 0.5,  weight: 0.7 },
  'trippy':                 { energy: 0.5,  tempo: 0.45, weight: 0.7 },

  // ACTIVITY TAGS
  'sleep':                  { energy: 0.05, tempo: 0.05, weight: 0.6 },
  'insomnia':               { energy: 0.1,  tempo: 0.1,  weight: 0.6 },
  'lullaby':                { energy: 0.05, tempo: 0.1,  weight: 0.6 },
  'meditation':             { energy: 0.08, tempo: 0.1,  weight: 0.6 },
  'yoga':                   { energy: 0.15, tempo: 0.2,  weight: 0.6 },
  'study':                  { energy: 0.25, tempo: 0.3,  weight: 0.6 },
  'focus':                  { energy: 0.25, tempo: 0.3,  weight: 0.6 },
  'concentration':          { energy: 0.25, tempo: 0.3,  weight: 0.6 },
  'work':                   { energy: 0.35, tempo: 0.4,  weight: 0.6 },
  'coding':                 { energy: 0.3,  tempo: 0.35, weight: 0.6 },
  'reading':                { energy: 0.2,  tempo: 0.25, weight: 0.6 },
  'morning':                { energy: 0.55, tempo: 0.55, weight: 0.6 },
  'wake up':                { energy: 0.6,  tempo: 0.6,  weight: 0.6 },
  'workout':                { energy: 0.85, tempo: 0.8,  weight: 0.6 },
  'gym':                    { energy: 0.85, tempo: 0.8,  weight: 0.6 },
  'running':                { energy: 0.8,  tempo: 0.8,  weight: 0.6 },
  'cycling':                { energy: 0.75, tempo: 0.75, weight: 0.6 },
  'party':                  { energy: 0.8,  tempo: 0.8,  weight: 0.6 },
  'club':                   { energy: 0.8,  tempo: 0.8,  weight: 0.6 },
  'rave':                   { energy: 0.9,  tempo: 0.85, weight: 0.6 },
  'driving':                { energy: 0.65, tempo: 0.65, weight: 0.6 },
  'road trip':              { energy: 0.65, tempo: 0.65, weight: 0.6 },
  'night drive':            { energy: 0.45, tempo: 0.5,  weight: 0.6 },
  'late night':             { energy: 0.4,  tempo: 0.4,  weight: 0.6 },
  'dinner':                 { energy: 0.35, tempo: 0.35, weight: 0.6 },
  'background':             { energy: 0.2,  tempo: 0.25, weight: 0.5 },
  'summer':                 { energy: 0.65, tempo: 0.65, weight: 0.6 },
  'winter':                 { energy: 0.3,  tempo: 0.3,  weight: 0.6 },
  'rainy day':              { energy: 0.25, tempo: 0.25, weight: 0.6 },
  'shower':                 { energy: 0.65, tempo: 0.65, weight: 0.5 },
  'cooking':                { energy: 0.55, tempo: 0.55, weight: 0.5 },

  // ERA / DECADE TAGS — no sonic signal
  '60s':                    { energy: null, tempo: null, weight: 0.0 },
  '70s':                    { energy: null, tempo: null, weight: 0.0 },
  '80s':                    { energy: null, tempo: null, weight: 0.0 },
  '90s':                    { energy: null, tempo: null, weight: 0.0 },
  '2000s':                  { energy: null, tempo: null, weight: 0.0 },
  'oldies':                 { energy: null, tempo: null, weight: 0.0 },
  'classic':                { energy: null, tempo: null, weight: 0.0 },
  'retro':                  { energy: null, tempo: null, weight: 0.0 },
  'vintage':                { energy: null, tempo: null, weight: 0.0 },

  // GEOGRAPHIC TAGS — no sonic signal
  'british':                { energy: null, tempo: null, weight: 0.0 },
  'american':               { energy: null, tempo: null, weight: 0.0 },
  'french':                 { energy: null, tempo: null, weight: 0.0 },
  'german':                 { energy: null, tempo: null, weight: 0.0 },
  'swedish':                { energy: null, tempo: null, weight: 0.0 },
  'australian':             { energy: null, tempo: null, weight: 0.0 },
  'canadian':               { energy: null, tempo: null, weight: 0.0 },
  'japanese':               { energy: null, tempo: null, weight: 0.0 },
  'korean':                 { energy: null, tempo: null, weight: 0.0 },
  'nigerian':               { energy: null, tempo: null, weight: 0.0 },
  'uk':                     { energy: null, tempo: null, weight: 0.0 },
  'us':                     { energy: null, tempo: null, weight: 0.0 },

  // FORMAT / QUALITY TAGS — no sonic signal
  'live':                   { energy: null, tempo: null, weight: 0.0 },
  'acoustic version':       { energy: 0.3,  tempo: 0.3,  weight: 0.5 },
  'cover':                  { energy: null, tempo: null, weight: 0.0 },
  'remix':                  { energy: null, tempo: null, weight: 0.0 },
  'instrumental':           { energy: null, tempo: null, weight: 0.0 },
  'remastered':             { energy: null, tempo: null, weight: 0.0 },
  'deluxe':                 { energy: null, tempo: null, weight: 0.0 },
  'soundtrack':             { energy: null, tempo: null, weight: 0.3 },
  'film score':             { energy: 0.4,  tempo: null, weight: 0.6 },

  // HIGH-FREQUENCY OPINION / MISC TAGS — no sonic signal
  'seen live':              { energy: null, tempo: null, weight: 0.0 },
  'favourites':             { energy: null, tempo: null, weight: 0.0 },
  'favorite':               { energy: null, tempo: null, weight: 0.0 },
  'love it':                { energy: null, tempo: null, weight: 0.0 },
  'amazing':                { energy: null, tempo: null, weight: 0.0 },
  'beautiful music':        { energy: null, tempo: null, weight: 0.0 },
  'all time favorites':     { energy: null, tempo: null, weight: 0.0 },
  'christian':              { energy: 0.5,  tempo: null, weight: 0.5 },
  'worship':                { energy: 0.45, tempo: null, weight: 0.6 },
  'gospel music':           { energy: 0.6,  tempo: 0.55, weight: 0.8 },
  'spoken word':            { energy: 0.2,  tempo: 0.2,  weight: 0.7 },
  'poetry':                 { energy: 0.2,  tempo: 0.2,  weight: 0.6 },
  'comedy':                 { energy: null, tempo: null, weight: 0.0 },
  'children':               { energy: 0.5,  tempo: 0.5,  weight: 0.5 },
  'musical':                { energy: 0.55, tempo: null, weight: 0.5 },
  'broadway':               { energy: 0.55, tempo: null, weight: 0.6 },
}

export function normaliseTag(raw: string): string {
  return raw.toLowerCase().trim().replace(/[-_]/g, ' ').replace(/\s+/g, ' ')
}

export function lookupTag(raw: string): TagMapping | null {
  return TAG_MAPPINGS[normaliseTag(raw)] ?? null
}

export function deriveTrackFeatures(tags: string[]): {
  energy: number | null
  tempo: number | null
} {
  let energySum = 0, energyWeightSum = 0
  let tempoSum = 0,  tempoWeightSum = 0

  for (const raw of tags) {
    const m = lookupTag(raw)
    if (!m || m.weight === 0) continue
    if (m.energy !== null) { energySum += m.energy * m.weight; energyWeightSum += m.weight }
    if (m.tempo  !== null) { tempoSum  += m.tempo  * m.weight; tempoWeightSum  += m.weight }
  }

  return {
    energy: energyWeightSum > 0 ? energySum / energyWeightSum : null,
    tempo:  tempoWeightSum  > 0 ? tempoSum  / tempoWeightSum  : null,
  }
}
