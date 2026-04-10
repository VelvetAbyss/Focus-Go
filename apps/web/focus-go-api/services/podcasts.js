const NETEASE_BASE = 'https://music.163.com'
const NETEASE_HEADERS = {
  'user-agent': 'Mozilla/5.0 FocusGoPodcastImporter',
  referer: `${NETEASE_BASE}/`,
}
const MAX_EPISODES = 36
const SYNC_INTERVAL_MS = 30 * 60 * 1000

const fallbackEmojis = ['🎙', '🎧', '📻', '🗣']
const fallbackColors = ['#D8C2A6', '#B7CCB0', '#CBB5D9', '#E3BCA4', '#A9C8D8']

const hashValue = (value) => String(value).split('').reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)
const pickColor = (value) => fallbackColors[Math.abs(hashValue(value)) % fallbackColors.length]
const pickEmoji = (value) => fallbackEmojis[Math.abs(hashValue(value)) % fallbackEmojis.length]
const normalizeImageUrl = (value) => (typeof value === 'string' && value ? value.replace(/^http:\/\//, 'https://') : undefined)
const normalizeAudioUrl = (value) => (typeof value === 'string' && value ? value.replace(/^http:\/\//, 'https://') : undefined)

const toDuration = (value) => {
  if (!value || value <= 0) return undefined
  const totalMinutes = Math.round(value / 60000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

const toIsoDate = (value) => {
  const date = new Date(Number(value) || value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const flattenProgramDescription = (payload) => {
  if (typeof payload.description === 'string' && payload.description.trim()) return payload.description.trim()
  if (!Array.isArray(payload.programDesc)) return undefined
  const content = payload.programDesc
    .map((item) => (typeof item?.content === 'string' ? item.content.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
  return content || undefined
}

const extractTextareaJson = (html, id) => {
  const match = html.match(new RegExp(`<textarea[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/textarea>`))
  if (!match?.[1]) throw new Error(`Missing ${id}`)
  return JSON.parse(match[1])
}

const parseProgramIds = (html) => {
  const ids = new Set()
  for (const match of html.matchAll(/href="\/program\?id=(\d+)"/g)) {
    ids.add(match[1])
  }
  return [...ids]
}

const resolveRadioId = (input) => {
  const raw = String(input ?? '').trim()
  if (!raw) throw new Error('Missing radio input')
  if (/^\d+$/.test(raw)) return raw
  const normalized = raw.includes('://') ? raw : `https://${raw}`
  const url = new URL(normalized)
  const hashQuery = url.hash.includes('?') ? new URLSearchParams(url.hash.slice(url.hash.indexOf('?') + 1)) : null
  const id = url.searchParams.get('id') ?? hashQuery?.get('id')
  if (!id || !/^\d+$/.test(id)) throw new Error('Invalid netease radio id')
  return id
}

const getRadioUrl = (radioId, offset = 0) =>
  offset > 0
    ? `${NETEASE_BASE}/djradio?id=${encodeURIComponent(radioId)}&order=1&_hash=programlist&limit=100&offset=${offset}`
    : `${NETEASE_BASE}/djradio?id=${encodeURIComponent(radioId)}`

const fetchText = async (url) => {
  const response = await fetch(url, { headers: NETEASE_HEADERS })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.text()
}

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: NETEASE_HEADERS })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

const fetchProgramAudioUrl = async (trackId) => {
  if (!trackId) return undefined
  const payload = await fetchJson(
    `${NETEASE_BASE}/api/song/enhance/player/url?id=${encodeURIComponent(trackId)}&ids=${encodeURIComponent(`[${trackId}]`)}&br=320000`,
  ).catch(() => null)
  const directUrl = payload?.data?.[0]?.url
  return normalizeAudioUrl(directUrl)
}

const fetchProgramPayload = async (programId) => {
  const html = await fetchText(`${NETEASE_BASE}/program?id=${encodeURIComponent(programId)}`)
  return extractTextareaJson(html, 'program-data')
}

const fetchProgram = async (programId) => {
  const data = await fetchProgramPayload(programId)
  const audioUrl = await fetchProgramAudioUrl(data.mainTrackId ?? data.mainSong?.id)
  return {
    id: String(data.id ?? programId),
    title: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : `Program ${programId}`,
    description: flattenProgramDescription(data),
    duration: toDuration(data.duration ?? data.mainSong?.duration),
    releaseDate: toIsoDate(data.createTime ?? data.scheduledPublishTime),
    audioUrl,
  }
}

export const resolveNeteaseProgramAudioUrl = async (programId) => {
  const data = await fetchProgramPayload(programId)
  return fetchProgramAudioUrl(data.mainTrackId ?? data.mainSong?.id)
}

const fetchRadio = async (input) => {
  const radioId = resolveRadioId(input)
  const firstPage = await fetchText(getRadioUrl(radioId))
  const radio = extractTextareaJson(firstPage, 'radio-data')
  const programCount = Number(radio.programCount ?? 0)
  const ids = new Set(parseProgramIds(firstPage))
  if (programCount > ids.size) {
    for (let offset = 100; offset < programCount && ids.size < MAX_EPISODES; offset += 100) {
      const page = await fetchText(getRadioUrl(radioId, offset))
      for (const id of parseProgramIds(page)) ids.add(id)
    }
  }

  const programIds = [...ids].slice(0, MAX_EPISODES)
  const episodes = (await Promise.all(programIds.map((programId) => fetchProgram(programId).catch(() => null)))).filter(Boolean)
  episodes.sort((left, right) => `${right.releaseDate ?? ''}`.localeCompare(`${left.releaseDate ?? ''}`))

  return {
    source: 'netease',
    sourceId: String(radio.id ?? radioId),
    collectionId: Number(radio.id ?? radioId),
    name: typeof radio.name === 'string' ? radio.name.trim() : `Netease Radio ${radioId}`,
    author: typeof radio.dj?.nickname === 'string' && radio.dj.nickname.trim() ? radio.dj.nickname.trim() : '网易云音乐',
    artworkUrl: normalizeImageUrl(radio.picUrl ?? radio.intervenePicUrl),
    feedUrl: undefined,
    primaryGenre: typeof radio.category === 'string' ? radio.category : undefined,
    releaseDate: toIsoDate(radio.lastProgramCreateTime ?? radio.createTime),
    country: 'CN',
    coverColor: pickColor(radio.name ?? radioId),
    coverEmoji: pickEmoji(radio.name ?? radioId),
    episodes,
  }
}

const readCachedPodcasts = (db, userId, sourceIds) => {
  if (Array.isArray(sourceIds) && sourceIds.length > 0) {
    const placeholders = sourceIds.map(() => '?').join(', ')
    return db
      .prepare(`SELECT * FROM netease_podcast_sources WHERE user_id = ? AND source_id IN (${placeholders}) ORDER BY updated_at DESC`)
      .all(userId, ...sourceIds)
  }
  return db.prepare('SELECT * FROM netease_podcast_sources WHERE user_id = ? ORDER BY updated_at DESC').all(userId)
}

const upsertCachedPodcast = (db, userId, input, podcast) => {
  const now = Date.now()
  db.prepare(`
    INSERT INTO netease_podcast_sources (user_id, source_id, channel_url, payload, last_synced_at, created_at, updated_at)
    VALUES (@user_id, @source_id, @channel_url, @payload, @last_synced_at, @created_at, @updated_at)
    ON CONFLICT(user_id, source_id) DO UPDATE SET
      channel_url = excluded.channel_url,
      payload = excluded.payload,
      last_synced_at = excluded.last_synced_at,
      updated_at = excluded.updated_at
  `).run({
    user_id: String(userId),
    source_id: podcast.sourceId,
    channel_url: String(input ?? getRadioUrl(podcast.sourceId)),
    payload: JSON.stringify(podcast),
    last_synced_at: now,
    created_at: now,
    updated_at: now,
  })
}

export const ensureNeteasePodcastTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS netease_podcast_sources (
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      channel_url TEXT,
      payload TEXT NOT NULL,
      last_synced_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, source_id)
    )
  `)
}

export const importNeteasePodcast = async (db, userId, input) => {
  const podcast = await fetchRadio(input)
  upsertCachedPodcast(db, userId, input, podcast)
  return podcast
}

export const syncNeteasePodcasts = async (db, userId, sourceIds) => {
  const rows = readCachedPodcasts(db, userId, sourceIds)
  const podcasts = []
  for (const row of rows) {
    const podcast = await fetchRadio(row.channel_url || row.source_id)
    upsertCachedPodcast(db, userId, row.channel_url || row.source_id, podcast)
    podcasts.push(podcast)
  }
  return podcasts
}

let syncJobStarted = false

export const startNeteasePodcastSyncJob = (db) => {
  if (syncJobStarted) return
  syncJobStarted = true
  const run = async () => {
    const rows = db.prepare('SELECT user_id, source_id, channel_url FROM netease_podcast_sources').all()
    for (const row of rows) {
      try {
        const podcast = await fetchRadio(row.channel_url || row.source_id)
        upsertCachedPodcast(db, row.user_id, row.channel_url || row.source_id, podcast)
      } catch (error) {
        console.error('netease podcast sync failed', row.source_id, error)
      }
    }
  }
  void run()
  setInterval(() => {
    void run()
  }, SYNC_INTERVAL_MS)
}
