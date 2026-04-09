import { useEffect, useMemo, useState } from 'react'
import type { MediaItem } from '../../../data/models/types'
import { mediaRepo } from '../../../data/repositories/mediaRepo'
import { MediaCardSurface } from '../components/MediaCardSurface'
import { dedupeMediaMatch, hasTmdbKey, hydrateRemoteMediaCandidate, searchRemoteMedia, type RemoteMediaCandidate } from '../mediaApi'
import { buildMediaPresentationModel } from './lifeDesignAdapters'

const toCreatePayload = (candidate: RemoteMediaCandidate) => ({
  ...candidate,
  status: 'want-to-watch' as const,
  progress: 0,
  cast: candidate.cast ?? [],
  genres: candidate.genres ?? [],
  watchedEpisodes: 0,
  reflection: '',
  lastSyncedAt: Date.now(),
})

const normalizeMediaPatch = (patch: Partial<MediaItem>): Partial<MediaItem> => {
  const next = { ...patch }
  if (typeof next.watchedEpisodes === 'number' && typeof next.episodes === 'number' && next.episodes > 0) {
    next.progress = Math.round((next.watchedEpisodes / next.episodes) * 100)
  }
  if (typeof next.progress !== 'number') return next
  if (next.progress >= 100) return { ...next, progress: 100, status: 'completed' }
  if (next.progress > 0) return { ...next, status: 'watching' }
  return next
}

const MediaCard = () => {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RemoteMediaCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const selected = useMemo(() => media.find((item) => item.id === selectedId) ?? null, [media, selectedId])
  const designModel = useMemo(() => buildMediaPresentationModel(media), [media])

  useEffect(() => {
    const loadMedia = async () => {
      setLoading(true)
      const rows = await mediaRepo.list()
      setMedia(rows)
      setSelectedId((current) => current ?? rows[0]?.id ?? null)
      setLoading(false)
    }
    void loadMedia()
  }, [])

  const handleSearch = async () => {
    if (!hasTmdbKey()) {
      setHint('Set VITE_TMDB_API_KEY to enable TMDb search.')
      return
    }
    const nextQuery = query.trim()
    if (!nextQuery) return
    setSearching(true)
    setHint(null)
    try {
      setResults(await searchRemoteMedia(nextQuery))
    } catch {
      setHint('Media search failed. Try another title.')
    } finally {
      setSearching(false)
    }
  }

  const handleDismissSearch = () => {
    setResults([])
  }

  const handleAdd = async (candidateId: string) => {
    const candidate = results.find((item) => `${item.mediaType}-${item.tmdbId}` === candidateId)
    if (!candidate) return
    setAddingCandidateId(candidateId)
    try {
      const hydrated = await hydrateRemoteMediaCandidate(candidate)
      const matched = dedupeMediaMatch(media.map((item) => ({ tmdbId: item.tmdbId, mediaType: item.mediaType })), hydrated)

      if (matched) {
        const existing = media.find((item) => item.tmdbId === hydrated.tmdbId && item.mediaType === hydrated.mediaType)
        if (!existing) return
        const updated = await mediaRepo.update(existing.id, { ...hydrated, lastSyncedAt: Date.now() })
        if (!updated) return
        setMedia((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
        setSelectedId(updated.id)
        return
      }

      const created = await mediaRepo.create(toCreatePayload(hydrated))
      setMedia((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
    } finally {
      setAddingCandidateId(null)
    }
  }

  const handlePatch = async (patch: Partial<MediaItem>) => {
    if (!selected) return
    const updated = await mediaRepo.update(selected.id, normalizeMediaPatch(patch))
    if (!updated) return
    setMedia((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    setSelectedId(updated.id)
  }

  const handleRemove = async (id: string) => {
    await mediaRepo.remove(id)
    const next = media.filter((item) => item.id !== id)
    setMedia(next)
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <MediaCardSurface
      model={designModel}
      items={media}
      selected={selected}
      selectedId={selectedId}
      open={open}
      loading={loading}
      query={query}
      searching={searching}
      hint={hint}
      results={results.map((item) => ({
        id: `${item.mediaType}-${item.tmdbId}`,
        title: item.title,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
        posterUrl: item.posterUrl,
      }))}
      addingCandidateId={addingCandidateId}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onQueryChange={setQuery}
      onSearch={() => void handleSearch()}
      onDismissSearch={handleDismissSearch}
      onSelectItem={setSelectedId}
      onAddItem={(id) => void handleAdd(id)}
      onPatchItem={(patch) => void handlePatch(patch)}
      onRemoveItem={(id) => void handleRemove(id)}
    />
  )
}

export default MediaCard
