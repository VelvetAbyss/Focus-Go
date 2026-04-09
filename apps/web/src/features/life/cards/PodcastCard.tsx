import { useEffect, useMemo, useState } from 'react'
import { podcastsRepo } from '../../../data/repositories/podcastsRepo'
import type { LifePodcast } from '../../../data/models/types'
import { PodcastCardSurface } from '../components/PodcastCardSurface'
import { buildPodcastPresentationModel } from './lifeDesignAdapters'
import { dedupePodcastMatch, hydrateRemotePodcastCandidate, searchRemotePodcasts, type RemotePodcastCandidate } from '../podcastsApi'

const PodcastCard = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LifePodcast[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RemotePodcastCandidate[]>([])
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])
  const model = useMemo(() => buildPodcastPresentationModel(items), [items])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const rows = await podcastsRepo.list()
      setItems(rows)
      setSelectedId((current) => current ?? rows[0]?.id ?? null)
      setLoading(false)
    }
    void load()
  }, [])

  const handleSearch = async () => {
    const nextQuery = query.trim()
    if (!nextQuery) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchRemotePodcasts(nextQuery))
    } catch {
      setError('Podcast search failed. Try another title.')
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (candidateId: string) => {
    const candidate = results.find((item) => item.sourceId === candidateId)
    if (!candidate) return
    setAddingCandidateId(candidateId)
    try {
      const hydrated = await hydrateRemotePodcastCandidate(candidate)
      const matched = dedupePodcastMatch(items, hydrated)
      if (matched) {
        const existing = items.find((item) => item.collectionId === hydrated.collectionId)
        if (!existing) return
        const updated = await podcastsRepo.update(existing.id, {
          ...hydrated,
          selectedEpisodeId: hydrated.episodes[0]?.id,
          lastSyncedAt: Date.now(),
        })
        if (!updated) return
        setItems((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
        setSelectedId(updated.id)
        return
      }

      const created = await podcastsRepo.create({
        ...hydrated,
        selectedEpisodeId: hydrated.episodes[0]?.id,
        isPlaying: false,
        lastSyncedAt: Date.now(),
      })
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
    } catch {
      setError('Podcast import failed. Try another show.')
    } finally {
      setAddingCandidateId(null)
    }
  }

  const handleSelectEpisode = async (podcastId: string, episodeId: string) => {
    const updated = await podcastsRepo.update(podcastId, { selectedEpisodeId: episodeId, isPlaying: true })
    if (!updated) return
    setItems((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    setSelectedId(updated.id)
  }

  const handleTogglePlaying = async (podcastId: string) => {
    const item = items.find((entry) => entry.id === podcastId)
    if (!item) return
    const updated = await podcastsRepo.update(podcastId, { isPlaying: !item.isPlaying })
    if (!updated) return
    setItems((current) => [updated, ...current.filter((entry) => entry.id !== updated.id)])
    setSelectedId(updated.id)
  }

  const handleRemove = async (id: string) => {
    await podcastsRepo.remove(id)
    const next = items.filter((item) => item.id !== id)
    setItems(next)
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <PodcastCardSurface
      model={model}
      items={items}
      selected={selected}
      selectedId={selectedId}
      open={open}
      loading={loading}
      query={query}
      searching={searching}
      error={error}
      results={results.map((item) => ({
        id: item.sourceId,
        title: item.name,
        author: item.author,
        artworkUrl: item.artworkUrl,
        genre: item.primaryGenre,
      }))}
      addingCandidateId={addingCandidateId}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onQueryChange={setQuery}
      onSearch={() => void handleSearch()}
      onSelectItem={setSelectedId}
      onAddItem={(id) => void handleAdd(id)}
      onSelectEpisode={(podcastId, episodeId) => void handleSelectEpisode(podcastId, episodeId)}
      onTogglePlaying={(podcastId) => void handleTogglePlaying(podcastId)}
      onRemoveItem={(id) => void handleRemove(id)}
    />
  )
}

export default PodcastCard
