/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Folder, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROUTES } from '../../../app/routes/routes'
import { useToast } from '../../../shared/ui/toast/toast'
import { useLabsI18n } from '../../labs/labsI18n'
import {
  RSS_TTL_MINUTES,
  addSource,
  assignSourceGroup,
  createSourceGroup,
  deleteSourceGroup,
  getEntriesView,
  getReadStates,
  getSourceGroups,
  getSources,
  markEntriesAsRead,
  refreshAll,
  refreshSource,
  removeSource,
  renameSourceGroup,
  restoreSource,
  starSource,
  type EntryViewScope,
  type RefreshResult,
  unstarSource,
} from '../rssApi'
import { groupEntriesByDay, isCacheExpired } from '../rssModel'

const UNGROUPED_KEY = '__ungrouped__'

type GroupDeleteTarget = {
  id: string
  name: string
}

const RssPage = () => {
  const i18n = useLabsI18n()
  const toast = useToast()

  const [sources, setSources] = useState<Awaited<ReturnType<typeof getSources>>>([])
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof getSourceGroups>>>([])
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getEntriesView>>>([])
  const [readState, setReadState] = useState(new Set<string>())

  const [scope, setScope] = useState<EntryViewScope>({ scope: 'all-active' })
  const scopeRef = useRef<EntryViewScope>({ scope: 'all-active' })

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [staleNotice, setStaleNotice] = useState<{ token: number; lastSuccessAt?: number } | null>(null)
  const [dismissedStaleToken, setDismissedStaleToken] = useState<number | null>(null)
  const [hardError, setHardError] = useState<string | null>(null)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newSourceRoute, setNewSourceRoute] = useState('')
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceGroupId, setNewSourceGroupId] = useState<string>(UNGROUPED_KEY)

  const [newGroupName, setNewGroupName] = useState('')
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renamingGroupName, setRenamingGroupName] = useState('')
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<GroupDeleteTarget | null>(null)

  const [removedOpen, setRemovedOpen] = useState(false)
  const [removeSourceId, setRemoveSourceId] = useState<string | null>(null)

  const autoRefreshDone = useRef(false)

  const loadAll = useCallback(async (nextScope: EntryViewScope) => {
    const [allSources, nextGroups, reads, nextEntries] = await Promise.all([
      getSources({ includeRemoved: true }),
      getSourceGroups(),
      getReadStates(),
      getEntriesView(nextScope),
    ])

    setSources(allSources)
    setGroups(nextGroups)
    setReadState(new Set(reads.map((item) => item.entryId)))
    setEntries(nextEntries)

    setSelectedEntryId((prev) => (nextEntries.some((item) => item.id === prev) ? prev : nextEntries[0]?.id ?? null))
  }, [])

  useEffect(() => {
    void loadAll(scopeRef.current)
  }, [loadAll])

  const setScopeAndReload = useCallback(
    (nextScope: EntryViewScope) => {
      scopeRef.current = nextScope
      setScope(nextScope)
      void loadAll(nextScope)
    },
    [loadAll],
  )

  const activeSources = useMemo(() => sources.filter((item) => !item.deletedAt), [sources])
  const removedSources = useMemo(() => sources.filter((item) => Boolean(item.deletedAt)), [sources])
  const starredSources = useMemo(() => activeSources.filter((item) => Boolean(item.starredAt)), [activeSources])

  const sourceMap = useMemo(() => new Map(activeSources.map((item) => [item.id, item])), [activeSources])

  const groupedSources = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        sources: activeSources.filter((source) => source.groupId === group.id),
      })),
    [activeSources, groups],
  )

  const ungroupedSources = useMemo(() => activeSources.filter((source) => !source.groupId), [activeSources])

  const selectedEntry = useMemo(
    () => entries.find((item) => item.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  )

  const dayBuckets = useMemo(() => groupEntriesByDay(entries), [entries])

  const runRefresh = useCallback(
    async (sourceId?: string) => {
      const result: RefreshResult = sourceId ? await refreshSource(sourceId) : await refreshAll()

      if (!result.ok) {
        const latestEntries = await getEntriesView(scopeRef.current)
        if (latestEntries.length === 0) {
          setHardError(i18n.rss.emptyError)
        }
      } else {
        setHardError(null)
      }

      if (result.stale) {
        setStaleNotice({ token: Date.now(), lastSuccessAt: result.lastSuccessAt })
      }

      await loadAll(scopeRef.current)
    },
    [i18n.rss.emptyError, loadAll],
  )

  useEffect(() => {
    if (autoRefreshDone.current) return
    if (!activeSources.length) return
    autoRefreshDone.current = true

    const latestSuccessAt = activeSources
      .map((item) => item.lastSuccessAt)
      .filter((item): item is number => typeof item === 'number')
      .sort((a, b) => b - a)[0]

    if (isCacheExpired(latestSuccessAt, RSS_TTL_MINUTES)) {
      void runRefresh()
    }
  }, [activeSources, runRefresh])

  const staleVisible = staleNotice && staleNotice.token !== dismissedStaleToken

  const handleAddSource = async () => {
    try {
      await addSource({
        route: newSourceRoute,
        displayName: newSourceName,
        groupId: newSourceGroupId === UNGROUPED_KEY ? null : newSourceGroupId,
      })
      setNewSourceRoute('')
      setNewSourceName('')
      setNewSourceGroupId(UNGROUPED_KEY)
      setAddDialogOpen(false)
      await loadAll(scopeRef.current)
    } catch (error) {
      toast.push({
        variant: 'error',
        message: error instanceof Error ? error.message : i18n.rss.emptyError,
      })
    }
  }

  const handleCreateGroup = async () => {
    try {
      await createSourceGroup(newGroupName)
      setNewGroupName('')
      toast.push({ variant: 'success', message: i18n.toast.groupCreated })
      await loadAll(scopeRef.current)
    } catch (error) {
      toast.push({ variant: 'error', message: error instanceof Error ? error.message : i18n.rss.emptyError })
    }
  }

  const handleRenameGroup = async () => {
    if (!renamingGroupId) return
    try {
      await renameSourceGroup(renamingGroupId, renamingGroupName)
      setRenamingGroupId(null)
      setRenamingGroupName('')
      toast.push({ variant: 'success', message: i18n.toast.groupRenamed })
      await loadAll(scopeRef.current)
    } catch (error) {
      toast.push({ variant: 'error', message: error instanceof Error ? error.message : i18n.rss.emptyError })
    }
  }

  const handleDeleteGroup = async () => {
    if (!groupDeleteTarget) return
    try {
      await deleteSourceGroup(groupDeleteTarget.id)
      setGroupDeleteTarget(null)
      toast.push({ variant: 'success', message: i18n.toast.groupDeleted })
      await loadAll(scopeRef.current)
    } catch (error) {
      toast.push({ variant: 'error', message: error instanceof Error ? error.message : i18n.rss.emptyError })
    }
  }

  const handleToggleStar = async (sourceId: string, starred: boolean) => {
    if (starred) {
      await unstarSource(sourceId)
      toast.push({ variant: 'success', message: i18n.toast.sourceUnstarred })
    } else {
      await starSource(sourceId)
      toast.push({ variant: 'success', message: i18n.toast.sourceStarred })
    }
    await loadAll(scopeRef.current)
  }

  const handleGroupAssign = async (sourceId: string, value: string) => {
    await assignSourceGroup(sourceId, value === UNGROUPED_KEY ? null : value)
    await loadAll(scopeRef.current)
  }

  const scopeTitle = useMemo(() => {
    if (scope.scope === 'all-active') return i18n.rss.list
    if (scope.scope === 'starred') return i18n.rss.favorites
    if (scope.scope === 'group') {
      if (!scope.groupId) return i18n.rss.ungrouped
      return groups.find((item) => item.id === scope.groupId)?.name ?? i18n.rss.subscriptions
    }
    return sourceMap.get(scope.sourceId)?.displayName ?? i18n.rss.subscriptions
  }, [groups, i18n.rss.favorites, i18n.rss.list, i18n.rss.subscriptions, i18n.rss.ungrouped, scope, sourceMap])

  return (
    <div className="rss-page">
      <header className="rss-page__header">
        <div>
          <h1>{i18n.rss.title}</h1>
          <p className="muted">{i18n.rss.subtitle}</p>
        </div>
        <div className="rss-page__header-actions">
          <Button variant="outline" asChild>
            <Link to={ROUTES.DASHBOARD}>{i18n.rss.back}</Link>
          </Button>
          <Button onClick={() => void runRefresh()}>{i18n.rss.refresh}</Button>
        </div>
      </header>

      {staleVisible ? (
        <div className="rss-page__stale-banner" role="status">
          <span>
            {i18n.rss.stale}. {i18n.rss.staleHint}:{' '}
            {staleNotice?.lastSuccessAt ? (
              <time
                dateTime={new Date(staleNotice.lastSuccessAt).toISOString()}
                title={new Date(staleNotice.lastSuccessAt).toLocaleString()}
              >
                {formatDistanceToNow(staleNotice.lastSuccessAt, { addSuffix: true })}
              </time>
            ) : (
              '--'
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setDismissedStaleToken(staleNotice?.token ?? null)}>
            ×
          </Button>
        </div>
      ) : null}

      {hardError ? (
        <Card className="rss-page__error-card">
          <CardHeader>
            <CardTitle>{hardError}</CardTitle>
            <CardDescription>{i18n.rss.retry}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void runRefresh()}>{i18n.rss.retry}</Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="rss-layout">
        <Card className="rss-left">
          <CardHeader className="rss-left__header">
            <div>
              <CardTitle>{i18n.rss.subscriptions}</CardTitle>
              <CardDescription>
                {activeSources.length} {i18n.rss.sourceCount}
              </CardDescription>
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" aria-label={i18n.rss.addSource}>
                  <Plus size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{i18n.rss.addSourceTitle}</DialogTitle>
                  <DialogDescription>{i18n.rss.addSourceDesc}</DialogDescription>
                </DialogHeader>
                <div className="rss-left__form-grid">
                  <Input
                    placeholder={i18n.rss.sourceInputRoute}
                    value={newSourceRoute}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSourceRoute(event.target.value)}
                  />
                  <Input
                    placeholder={i18n.rss.sourceInputName}
                    value={newSourceName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSourceName(event.target.value)}
                  />
                  <Select value={newSourceGroupId} onValueChange={setNewSourceGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder={i18n.rss.assignGroup} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNGROUPED_KEY}>{i18n.rss.ungrouped}</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    {i18n.labs.cancel}
                  </Button>
                  <Button onClick={() => void handleAddSource()}>{i18n.rss.addSource}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent className="rss-left__content">
            <div className="rss-left__section-list">
              <button
                type="button"
                className={`rss-left__section ${scope.scope === 'starred' ? 'is-active' : ''}`}
                onClick={() => setScopeAndReload({ scope: 'starred' })}
              >
                <span>{i18n.rss.favorites}</span>
                <Badge variant="outline">{starredSources.length}</Badge>
              </button>

              <button
                type="button"
                className={`rss-left__section ${scope.scope === 'all-active' ? 'is-active' : ''}`}
                onClick={() => setScopeAndReload({ scope: 'all-active' })}
              >
                <span>{i18n.rss.list}</span>
                <Badge variant="outline">{activeSources.length}</Badge>
              </button>
            </div>

            <section className="rss-left__groups">
              <div className="rss-left__groups-header">
                <p>{i18n.rss.subscriptions}</p>
                <div className="rss-left__group-create">
                  <Input
                    value={newGroupName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setNewGroupName(event.target.value)}
                    placeholder={i18n.rss.newGroup}
                  />
                  <Button size="sm" onClick={() => void handleCreateGroup()}>
                    {i18n.rss.newGroup}
                  </Button>
                </div>
              </div>

              <div className="rss-left__group-block">
                <button
                  type="button"
                  className={`rss-left__group-title ${scope.scope === 'group' && scope.groupId === null ? 'is-active' : ''}`}
                  onClick={() => setScopeAndReload({ scope: 'group', groupId: null })}
                >
                  <Folder size={14} />
                  <span>{i18n.rss.ungrouped}</span>
                  <Badge variant="outline">{ungroupedSources.length}</Badge>
                </button>
                <div className="rss-left__source-list">
                  {ungroupedSources.map((source) => (
                    <div key={source.id} className="rss-left__source-row">
                      <button
                        type="button"
                        className={`rss-left__source-link ${scope.scope === 'source' && scope.sourceId === source.id ? 'is-active' : ''}`}
                        onClick={() => setScopeAndReload({ scope: 'source', sourceId: source.id })}
                      >
                        <span>{source.displayName}</span>
                        <small>{source.route}</small>
                      </button>
                      <div className="rss-left__source-actions">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={source.starredAt ? i18n.rss.unstar : i18n.rss.star}
                          onClick={() => void handleToggleStar(source.id, Boolean(source.starredAt))}
                        >
                          {source.starredAt ? <StarOff size={14} /> : <Star size={14} />}
                        </Button>
                        <Select
                          value={source.groupId ?? UNGROUPED_KEY}
                          onValueChange={(value) => void handleGroupAssign(source.id, value)}
                        >
                          <SelectTrigger className="rss-left__source-select">
                            <SelectValue placeholder={i18n.rss.assignGroup} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNGROUPED_KEY}>{i18n.rss.ungrouped}</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => setRemoveSourceId(source.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {groupedSources.map((group) => {
                const isEditing = renamingGroupId === group.id
                const isGroupScope = scope.scope === 'group' && scope.groupId === group.id
                return (
                  <div key={group.id} className="rss-left__group-block">
                    <div className="rss-left__group-line">
                      <button
                        type="button"
                        className={`rss-left__group-title ${isGroupScope ? 'is-active' : ''}`}
                        onClick={() => setScopeAndReload({ scope: 'group', groupId: group.id })}
                      >
                        <Folder size={14} />
                        <span>{group.name}</span>
                        <Badge variant="outline">{group.sources.length}</Badge>
                      </button>
                      <div className="rss-left__group-tools">
                        {isEditing ? (
                          <>
                            <Input
                              value={renamingGroupName}
                              onChange={(event: ChangeEvent<HTMLInputElement>) => setRenamingGroupName(event.target.value)}
                            />
                            <Button size="sm" onClick={() => void handleRenameGroup()}>
                              {i18n.rss.renameGroup}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRenamingGroupId(group.id)
                                setRenamingGroupName(group.name)
                              }}
                            >
                              {i18n.rss.renameGroup}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setGroupDeleteTarget({ id: group.id, name: group.name })}>
                              {i18n.rss.deleteGroup}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rss-left__source-list">
                      {group.sources.map((source) => (
                        <div key={source.id} className="rss-left__source-row">
                          <button
                            type="button"
                            className={`rss-left__source-link ${scope.scope === 'source' && scope.sourceId === source.id ? 'is-active' : ''}`}
                            onClick={() => setScopeAndReload({ scope: 'source', sourceId: source.id })}
                          >
                            <span>{source.displayName}</span>
                            <small>{source.route}</small>
                          </button>
                          <div className="rss-left__source-actions">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={source.starredAt ? i18n.rss.unstar : i18n.rss.star}
                              onClick={() => void handleToggleStar(source.id, Boolean(source.starredAt))}
                            >
                              {source.starredAt ? <StarOff size={14} /> : <Star size={14} />}
                            </Button>
                            <Select
                              value={source.groupId ?? UNGROUPED_KEY}
                              onValueChange={(value) => void handleGroupAssign(source.id, value)}
                            >
                              <SelectTrigger className="rss-left__source-select">
                                <SelectValue placeholder={i18n.rss.assignGroup} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNGROUPED_KEY}>{i18n.rss.ungrouped}</SelectItem>
                                {groups.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" onClick={() => setRemoveSourceId(source.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>

            <div className="rss-left__removed">
              <Button variant="ghost" onClick={() => setRemovedOpen((prev) => !prev)}>
                {i18n.rss.removedSources} ({removedSources.length})
              </Button>
              {removedOpen ? (
                <div className="rss-left__removed-list">
                  {removedSources.length === 0 ? <p className="muted">{i18n.rss.noRemoved}</p> : null}
                  {removedSources.map((source) => (
                    <div key={source.id} className="rss-left__removed-item">
                      <div>
                        <p>{source.displayName}</p>
                        <small>{source.route}</small>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void restoreSource(source.id).then(() => loadAll(scopeRef.current))}>
                        {i18n.rss.restore}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rss-middle">
          <CardHeader>
            <CardTitle>{scopeTitle}</CardTitle>
            <CardDescription>{entries.length}</CardDescription>
          </CardHeader>
          <CardContent className="rss-middle__content">
            {dayBuckets.length === 0 ? <p className="muted">{i18n.rss.noEntries}</p> : null}
            {dayBuckets.map((bucket) => {
              const label =
                bucket.type === 'today'
                  ? i18n.rss.today
                  : bucket.type === 'yesterday'
                    ? i18n.rss.yesterday
                    : new Date(bucket.dateMs).toLocaleDateString()

              return (
                <section key={bucket.key} className="rss-middle__bucket">
                  <h3>{label}</h3>
                  <div className="rss-middle__bucket-list">
                    {bucket.entries.map((entry) => {
                      const source = sourceMap.get(entry.sourceId)
                      const isSelected = selectedEntryId === entry.id
                      return (
                        <button
                          type="button"
                          key={entry.id}
                          className={`rss-entry-card ${isSelected ? 'is-active' : ''}`}
                          onClick={() => {
                            setSelectedEntryId(entry.id)
                            setSummaryOpen(true)
                            void markEntriesAsRead([entry.id]).then((next) => {
                              setReadState((prev) => {
                                const merged = new Set(prev)
                                next.forEach((item) => merged.add(item.entryId))
                                return merged
                              })
                            })
                          }}
                        >
                          <div className="rss-entry-card__main">
                            <div className="rss-entry-card__meta">
                              <span>{source?.displayName ?? i18n.rss.subscriptions}</span>
                              <time dateTime={new Date(entry.publishedAt).toISOString()}>
                                {new Date(entry.publishedAt).toLocaleString()}
                              </time>
                            </div>
                            <p className="rss-entry-card__title">{entry.title}</p>
                            <p className="rss-entry-card__summary">{entry.summary}</p>
                            {readState.has(entry.id) ? <Badge variant="outline">{i18n.rss.read}</Badge> : null}
                          </div>
                          {entry.thumbnailUrl ? (
                            <div className="rss-entry-card__thumb-wrap">
                              <img src={entry.thumbnailUrl} alt={entry.title} className="rss-entry-card__thumb" loading="lazy" />
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rss-right">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>{selectedEntry?.title ?? i18n.rss.noSelection}</CardDescription>
            <div>
              {summaryOpen ? (
                <Button size="sm" variant="ghost" onClick={() => setSummaryOpen(false)}>
                  {i18n.rss.closeSummary}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setSummaryOpen(true)}>
                  {i18n.rss.openSummary}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="rss-right__content">
            {summaryOpen && selectedEntry ? (
              <article className="rss-page__summary">
                <p>{selectedEntry.summary}</p>
                <a href={selectedEntry.url} target="_blank" rel="noreferrer">
                  {selectedEntry.url}
                </a>
              </article>
            ) : (
              <p className="muted">{i18n.rss.noSelection}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(removeSourceId)} onOpenChange={(open) => (open ? undefined : setRemoveSourceId(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.rss.removeSourceTitle}</AlertDialogTitle>
            <AlertDialogDescription>{i18n.rss.removeSourceDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!removeSourceId) return
                void removeSource(removeSourceId).then(() => {
                  setRemoveSourceId(null)
                  return loadAll(scopeRef.current)
                })
              }}
            >
              {i18n.labs.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(groupDeleteTarget)} onOpenChange={(open) => (open ? undefined : setGroupDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.rss.deleteGroup}</AlertDialogTitle>
            <AlertDialogDescription>{groupDeleteTarget?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.labs.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteGroup()}>{i18n.rss.deleteGroup}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default RssPage
