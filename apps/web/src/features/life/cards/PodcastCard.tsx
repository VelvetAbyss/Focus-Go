import { useEffect, useMemo, useState } from 'react'
import { podcastsRepo } from '../../../data/repositories/podcastsRepo'
import type { LifePodcast } from '../../../data/models/types'
import { PodcastCardSurface } from '../components/PodcastCardSurface'
import { buildPodcastPresentationModel } from './lifeDesignAdapters'
import {
  extractNeteaseRadioId,
  hydrateRemotePodcastCandidate,
  importNeteasePodcast,
  isNeteasePodcastUrl,
  NETEASE_CHANNEL_PRESETS,
  searchRemotePodcasts,
  syncNeteasePodcasts,
  type RemotePodcastCandidate,
} from '../podcastsApi'
import { pausePodcastPlayback, playPodcastEpisode, subscribePodcastPlayback } from '../podcastPlayback'

const mergeEpisodes = (current: LifePodcast['episodes'], incoming: LifePodcast['episodes']) => {
  const merged = new Map<string, LifePodcast['episodes'][number]>()
  for (const episode of [...incoming, ...current]) {
    if (!episode?.id) continue
    merged.set(episode.id, episode)
  }
  return [...merged.values()].sort((left, right) => `${right.releaseDate ?? ''}`.localeCompare(`${left.releaseDate ?? ''}`))
}

const toImportErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('Missing auth token')) return 'Netease import requires login first.'
  if (message.includes('404')) return 'Netease import API is not deployed yet. Start or deploy focus-go-api first.'
  if (message.includes('401')) return 'Netease import requires a valid login session.'
  return 'Netease podcast import failed. Check the channel link.'
}

const toRefreshErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('404')) return 'Netease sync API is not deployed yet. Start or deploy focus-go-api first.'
  if (message.includes('401')) return 'Netease sync requires a valid login session.'
  return 'Podcast refresh failed. Try again later.'
}

const PodcastCard = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<LifePodcast[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<RemotePodcastCandidate[]>([])
  const [addingCandidateId, setAddingCandidateId] = useState<string | null>(null)
  const [channelUrl, setChannelUrl] = useState('')
  const [refreshingPodcastId, setRefreshingPodcastId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId])
  const model = useMemo(() => buildPodcastPresentationModel(items), [items])
  const presetChannels = useMemo(
    () =>
      NETEASE_CHANNEL_PRESETS.filter(
        (channel) => !items.some((item) => item.source === 'netease' && item.sourceId === channel.id),
      ),
    [items],
  )

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

  useEffect(
    () =>
      subscribePodcastPlayback(() => {
        void podcastsRepo.list().then((rows) => {
          setItems(rows)
          setSelectedId((current) => current ?? rows[0]?.id ?? null)
        })
      }),
    [],
  )

  const applyPodcastUpdate = (updated: LifePodcast) => {
    setItems((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
    setSelectedId(updated.id)
    return updated
  }

  const toPlaybackErrorMessage = (playbackError: unknown) => {
    const message = playbackError instanceof Error ? playbackError.message : String(playbackError ?? '')
    if (message.includes('supported sources')) return 'This episode source is unavailable right now.'
    if (message.includes('play() failed')) return 'Playback was blocked by the browser.'
    return message || 'Podcast playback failed.'
  }

  const playSelection = async (podcast: LifePodcast, episodeId?: string) => {
    const episode = podcast.episodes.find((item) => item.id === (episodeId ?? podcast.selectedEpisodeId)) ?? podcast.episodes[0]
    if (!episode) {
      setError('This episode has no playable audio URL yet.')
      return
    }
    try {
      await playPodcastEpisode(podcast, episode)
    } catch (playbackError) {
      setError(toPlaybackErrorMessage(playbackError))
    }
  }

  const upsertPodcast = async (candidate: RemotePodcastCandidate) => {
    const hydrated = await hydrateRemotePodcastCandidate(candidate)
    const matched = items.find((item) => item.source === hydrated.source && item.collectionId === hydrated.collectionId)
    const mergedEpisodes = mergeEpisodes(matched?.episodes ?? [], hydrated.episodes)
    const selectedEpisodeId = matched?.selectedEpisodeId && mergedEpisodes.some((episode) => episode.id === matched.selectedEpisodeId)
      ? matched.selectedEpisodeId
      : mergedEpisodes[0]?.id

    if (matched) {
      const updated = await podcastsRepo.update(matched.id, {
        ...hydrated,
        episodes: mergedEpisodes,
        selectedEpisodeId,
        isPlaying: matched.isPlaying,
        lastSyncedAt: Date.now(),
      })
      if (!updated) return
      applyPodcastUpdate(updated)
      return
    }

    const created = await podcastsRepo.create({
      ...hydrated,
      episodes: mergedEpisodes,
      selectedEpisodeId: mergedEpisodes[0]?.id,
      isPlaying: false,
      lastSyncedAt: Date.now(),
    })
    applyPodcastUpdate(created)
  }

  const handleSearch = async () => {
    const nextQuery = query.trim()
    if (!nextQuery) return
    if (isNeteasePodcastUrl(nextQuery)) {
      setAddingCandidateId(`netease:${extractNeteaseRadioId(nextQuery) ?? nextQuery}`)
      setError(null)
      try {
        await upsertPodcast(await importNeteasePodcast(nextQuery))
        setChannelUrl(nextQuery)
        setResults([])
      } catch (error) {
        setError(toImportErrorMessage(error))
      } finally {
        setAddingCandidateId(null)
      }
      return
    }
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
      await upsertPodcast(candidate)
    } catch (error) {
      setError(error instanceof Error && error.message.includes('Netease') ? toImportErrorMessage(error) : 'Podcast import failed. Try another show.')
    } finally {
      setAddingCandidateId(null)
    }
  }

  const handleImportChannel = async (input: string, key: string) => {
    const nextInput = input.trim()
    if (!nextInput) return
    setAddingCandidateId(key)
    setError(null)
    try {
      await upsertPodcast(await importNeteasePodcast(nextInput))
      setChannelUrl(nextInput)
    } catch (error) {
      setError(toImportErrorMessage(error))
    } finally {
      setAddingCandidateId(null)
    }
  }

  const handleRefresh = async (podcastId: string) => {
    const podcast = items.find((item) => item.id === podcastId)
    if (!podcast || podcast.source !== 'netease') return
    setRefreshingPodcastId(podcastId)
    setError(null)
    try {
      const [fresh] = await syncNeteasePodcasts([podcast.sourceId])
      if (!fresh) return
      const mergedEpisodes = mergeEpisodes(podcast.episodes, fresh.episodes)
      const updated = await podcastsRepo.update(podcast.id, {
        ...fresh,
        episodes: mergedEpisodes,
        selectedEpisodeId:
          podcast.selectedEpisodeId && mergedEpisodes.some((episode) => episode.id === podcast.selectedEpisodeId)
            ? podcast.selectedEpisodeId
            : mergedEpisodes[0]?.id,
        isPlaying: podcast.isPlaying,
        lastSyncedAt: Date.now(),
      })
      if (!updated) return
      applyPodcastUpdate(updated)
    } catch (error) {
      setError(toRefreshErrorMessage(error))
    } finally {
      setRefreshingPodcastId(null)
    }
  }

  const handleSelectEpisode = async (podcastId: string, episodeId: string) => {
    const updated = await podcastsRepo.update(podcastId, { selectedEpisodeId: episodeId, isPlaying: true })
    if (!updated) return
    applyPodcastUpdate(updated)
    setError(null)
    await playSelection(updated, episodeId)
  }

  const handleTogglePlaying = async (podcastId: string) => {
    const item = items.find((entry) => entry.id === podcastId)
    if (!item) return
    const updated = await podcastsRepo.update(podcastId, { isPlaying: !item.isPlaying })
    if (!updated) return
    applyPodcastUpdate(updated)
    setError(null)
    if (updated.isPlaying) await playSelection(updated)
    else await pausePodcastPlayback(updated.id)
  }

  const handleRemove = async (id: string) => {
    if (items.find((item) => item.id === id)?.isPlaying) await pausePodcastPlayback(id)
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
      channelUrl={channelUrl}
      results={results.map((item) => ({
        id: item.sourceId,
        title: item.name,
        author: item.author,
        artworkUrl: item.artworkUrl,
        genre: item.primaryGenre,
      }))}
      presetChannels={presetChannels}
      addingCandidateId={addingCandidateId}
      refreshingPodcastId={refreshingPodcastId}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onQueryChange={setQuery}
      onChannelUrlChange={setChannelUrl}
      onSearch={() => void handleSearch()}
      onImportChannel={(input) => void handleImportChannel(input, `channel:${extractNeteaseRadioId(input) ?? input}`)}
      onImportPreset={(url, id) => void handleImportChannel(url, `preset:${id}`)}
      onSelectItem={setSelectedId}
      onAddItem={(id) => void handleAdd(id)}
      onSelectEpisode={(podcastId, episodeId) => void handleSelectEpisode(podcastId, episodeId)}
      onTogglePlaying={(podcastId) => void handleTogglePlaying(podcastId)}
      onRefreshItem={(id) => void handleRefresh(id)}
      onRemoveItem={(id) => void handleRemove(id)}
    />
  )
}

export default PodcastCard
