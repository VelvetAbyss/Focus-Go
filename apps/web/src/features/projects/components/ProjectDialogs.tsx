import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Calendar, Check, ChevronDown, Flag, Palette, Search, Tag, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Dialog from '../../../shared/ui/Dialog'
import type { LifePerson, ProjectItem, ProjectPerson, TaskItem } from '../../../data/models/types'
import { peopleRepo } from '../../../data/repositories/peopleRepo'
import { PROJECT_COLORS, resolveProjectColor } from '../../../shared/design/tokens'
import { useProjectsI18n } from '../projectsI18n'
import { usePreferences } from '../../../shared/prefs/usePreferences'

type ProjectFormPayload = {
  title: string
  goal: string
  description: string
  color?: string
  status: ProjectItem['status']
  priority: ProjectItem['priority']
  ownerId?: string
  startDate?: string
  dueDate?: string
  nextAction?: string
  riskSummary?: string
}

type ProjectFormDialogProps = {
  open: boolean
  project?: ProjectItem | null
  people: ProjectPerson[]
  onClose: () => void
  onAutoSave?: (payload: ProjectFormPayload) => Promise<void> | void
  onSubmit: (payload: ProjectFormPayload) => Promise<void> | void
}

type PersonFormDialogProps = {
  open: boolean
  person?: ProjectPerson | null
  onClose: () => void
  onSubmit: (payload: {
    name: string
    roleType: ProjectPerson['roleType']
    phone?: string
    email?: string
    note?: string
  }) => Promise<void> | void
}

const inputClassName = 'h-11 rounded-2xl border-[#3A3733]/12 bg-white text-[#3A3733] shadow-none'
const textareaClassName = 'min-h-[112px] rounded-3xl border-[#3A3733]/12 bg-white text-[#3A3733] shadow-none'

const GROUP_COLORS: Record<string, string> = {
  Family: '#f59e0b',
  Friends: '#10b981',
  Work: '#3b82f6',
  Community: '#8b5cf6',
  Other: '#9ca3af',
}

type ProjectStatus = NonNullable<ProjectItem['status']>
type ProjectPriority = NonNullable<ProjectItem['priority']>

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: '#B0AAA1',
  active: '#4F8A5E',
  blocked: '#B5361B',
  done: '#3A3733',
  archived: '#8A8478',
}

const PRIORITY_LEVEL: Record<ProjectPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  high: '#B5361B',
  medium: '#C58C2E',
  low: '#6E8A4F',
}

const toISODate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatShortDate = (iso: string, locale: string) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

const computeDatePresets = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const weekend = new Date(today)
  const dow = weekend.getDay() // 0=Sun..6=Sat
  const daysToSat = (6 - dow + 7) % 7 || 7
  weekend.setDate(weekend.getDate() + daysToSat)
  const nextMonday = new Date(today)
  const daysToMon = (8 - dow) % 7 || 7
  nextMonday.setDate(nextMonday.getDate() + daysToMon)
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30)
  return { today, tomorrow, weekend, nextMonday, in30 }
}

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const ProjectFormDialog = ({ open, project, people, onClose, onAutoSave, onSubmit }: ProjectFormDialogProps) => {
  const i18n = useProjectsI18n()
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [priority, setPriority] = useState<ProjectPriority>('medium')
  const [ownerId, setOwnerId] = useState<string>('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [riskSummary, setRiskSummary] = useState('')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [ownerQuery, setOwnerQuery] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const titleWrapRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)

  const isEditMode = !!project && !!onAutoSave
  const { language } = usePreferences()
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'

  // Reset on open
  useEffect(() => {
    isInitializedRef.current = false
    if (!open) return
    setTitle(project?.title ?? '')
    setGoal(project?.goal ?? '')
    setDescription(project?.description ?? '')
    setColor(project ? resolveProjectColor(project) : PROJECT_COLORS[0])
    setStatus((project?.status as ProjectStatus | undefined) ?? 'planning')
    setPriority((project?.priority as ProjectPriority | null | undefined) ?? 'medium')
    setOwnerId(project?.ownerId ?? 'unassigned')
    setStartDate(project?.startDate ?? '')
    setDueDate(project?.dueDate ?? '')
    setNextAction(project?.nextAction ?? '')
    setRiskSummary(project?.riskSummary ?? '')
    setTitleError(false)
    setOwnerQuery('')
    setSavedAt(null)
    // Auto-expand drawer in edit mode when those fields have content
    const drawerHasContent = !!(project?.startDate || project?.nextAction || project?.riskSummary)
    setDrawerOpen(drawerHasContent)
  }, [open, project])

  // Autofocus the title input on open
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      titleRef.current?.focus()
      titleRef.current?.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [open])

  // Auto-grow the description textarea
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`
  }, [description, open])

  // Autosave (preserve existing 400ms debouncer behavior for edit mode)
  useEffect(() => {
    if (!open || !onAutoSave || !project) return
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      void Promise.resolve(
        onAutoSave({
          title, goal, description, status, priority,
          color,
          ownerId: ownerId === 'unassigned' ? undefined : ownerId,
          startDate: startDate || undefined,
          dueDate: dueDate || undefined,
          nextAction: nextAction || undefined,
          riskSummary: riskSummary || undefined,
        }),
      ).then(() => setSavedAt(Date.now()))
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, goal, description, color, status, priority, ownerId, startDate, dueDate, nextAction, riskSummary])

  // Tick once a second so "Saved · 5s ago" stays fresh while editing
  useEffect(() => {
    if (!isEditMode || !savedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isEditMode, savedAt])

  const buildPayload = useCallback((): ProjectFormPayload => ({
    title: title.trim(),
    goal,
    description,
    color,
    status,
    priority,
    ownerId: ownerId === 'unassigned' ? undefined : ownerId,
    startDate: startDate || undefined,
    dueDate: dueDate || undefined,
    nextAction: nextAction || undefined,
    riskSummary: riskSummary || undefined,
  }), [title, goal, description, color, status, priority, ownerId, startDate, dueDate, nextAction, riskSummary])

  const triggerTitleShake = useCallback(() => {
    setTitleError(true)
    const el = titleWrapRef.current
    if (el) {
      el.classList.remove('pd-shake')
      // force reflow to restart animation
      void el.offsetWidth
      el.classList.add('pd-shake')
    }
    titleRef.current?.focus()
  }, [])

  const handleCreate = useCallback(() => {
    if (title.trim().length === 0) {
      triggerTitleShake()
      return
    }
    void onSubmit(buildPayload())
  }, [title, buildPayload, onSubmit, triggerTitleShake])

  const handleRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (isEditMode) onClose()
      else handleCreate()
    }
  }

  const focusNext = (current: HTMLElement | null) => {
    if (!current) return
    const focusables = current.closest('.pd-v2')?.querySelectorAll<HTMLElement>('input, textarea, button, [tabindex]:not([tabindex="-1"])')
    if (!focusables) return
    const arr = Array.from(focusables).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
    const idx = arr.indexOf(current)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSingleLineEnter = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault()
      focusNext(event.currentTarget)
    }
  }

  // Date presets
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presets = useMemo(() => computeDatePresets(), [open])
  const setDueFromPreset = (d: Date) => setDueDate(toISODate(d))

  // Owner filtering
  const filteredPeople = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => p.name.toLowerCase().includes(q))
  }, [people, ownerQuery])

  const ownerName = useMemo(() => {
    if (ownerId === 'unassigned') return null
    return people.find((p) => p.id === ownerId)?.name ?? null
  }, [people, ownerId])

  // Saved indicator text
  const savedLabel = useMemo(() => {
    if (!savedAt) return null
    const sec = Math.max(0, Math.round((now - savedAt) / 1000))
    if (sec < 2) return i18n.dialog.savedJustNow
    return i18n.t(i18n.dialog.savedAgo, { n: sec })
  }, [savedAt, now, i18n])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(620px,calc(100vw-32px))] rounded-[24px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div
        className="pd-v2"
        onKeyDown={handleRootKeyDown}
        style={{ ['--pd-accent' as string]: color }}
      >
        <div className="pd-v2__header">
          <p className="project-dialog__eyebrow">{i18n.dialog.projectEyebrow}</p>
          <h2 className="project-dialog__title">{project ? i18n.dialog.editProject : i18n.dialog.newProject}</h2>
        </div>

        <div className="pd-v2__hero">
          <div className="pd-v2__title-wrap" ref={titleWrapRef}>
            <input
              ref={titleRef}
              className="pd-v2__title-input"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false) }}
              onKeyDown={handleSingleLineEnter}
              placeholder={i18n.dialog.titlePlaceholderHero}
              aria-label={i18n.dialog.fieldTitle}
              aria-invalid={titleError}
              maxLength={120}
              autoComplete="off"
            />
            <span className="pd-v2__title-underline" />
          </div>
          {titleError ? (
            <p className="pd-v2__hint" role="alert">{i18n.dialog.titleRequiredHint}</p>
          ) : null}

          <input
            className="pd-v2__goal-input"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={handleSingleLineEnter}
            placeholder={i18n.dialog.goalPlaceholderShort}
            aria-label={i18n.dialog.fieldGoal}
            autoComplete="off"
          />

          <textarea
            ref={descRef}
            className="pd-v2__desc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={i18n.dialog.descriptionPlaceholderShort}
            aria-label={i18n.dialog.fieldDescription}
            rows={1}
          />
        </div>

        <div className="pd-v2__pills" role="toolbar" aria-label={i18n.dialog.sectionBasic}>
          {/* Due date pill */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pd-pill"
                data-active={dueDate ? 'true' : 'false'}
                aria-label={i18n.dialog.pillDue}
              >
                <Calendar className="pd-pill__icon" size={13} />
                <span>{dueDate ? formatShortDate(dueDate, locale) : i18n.dialog.pillDue}</span>
                {dueDate ? (
                  <span
                    aria-hidden
                    className="pd-pill__clear"
                    onClick={(e) => { e.stopPropagation(); setDueDate('') }}
                  >×</span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent className="pd-popover" align="start" sideOffset={6}>
              <div className="pd-popover__title">{i18n.dialog.pillDue}</div>
              <div className="pd-date-presets">
                <button type="button" className="pd-date-preset" onClick={() => setDueFromPreset(presets.today)}>
                  <span className="pd-date-preset__label">{i18n.dialog.dueQuickToday}</span>
                  <span className="pd-date-preset__date">{formatShortDate(toISODate(presets.today), locale)}</span>
                </button>
                <button type="button" className="pd-date-preset" onClick={() => setDueFromPreset(presets.tomorrow)}>
                  <span className="pd-date-preset__label">{i18n.dialog.dueQuickTomorrow}</span>
                  <span className="pd-date-preset__date">{formatShortDate(toISODate(presets.tomorrow), locale)}</span>
                </button>
                <button type="button" className="pd-date-preset" onClick={() => setDueFromPreset(presets.weekend)}>
                  <span className="pd-date-preset__label">{i18n.dialog.dueQuickWeekend}</span>
                  <span className="pd-date-preset__date">{formatShortDate(toISODate(presets.weekend), locale)}</span>
                </button>
                <button type="button" className="pd-date-preset" onClick={() => setDueFromPreset(presets.nextMonday)}>
                  <span className="pd-date-preset__label">{i18n.dialog.dueQuickNextWeek}</span>
                  <span className="pd-date-preset__date">{formatShortDate(toISODate(presets.nextMonday), locale)}</span>
                </button>
                <button type="button" className="pd-date-preset" onClick={() => setDueFromPreset(presets.in30)} style={{ gridColumn: 'span 2' }}>
                  <span className="pd-date-preset__label">{i18n.dialog.dueQuickIn30Days}</span>
                  <span className="pd-date-preset__date">{formatShortDate(toISODate(presets.in30), locale)}</span>
                </button>
              </div>
              <div className="pd-date-custom">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label={i18n.dialog.dueCustom}
                />
                {dueDate ? (
                  <button type="button" className="pd-date-clear" onClick={() => setDueDate('')}>
                    {i18n.dialog.dueClear}
                  </button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          {/* Status pill */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pd-pill"
                data-active={status !== 'planning' ? 'true' : 'false'}
                aria-label={i18n.dialog.pillStatus}
              >
                <span className="pd-pill__dot" style={{ ['--pd-pill-dot' as string]: STATUS_COLORS[status] }} />
                <span>{i18n.dialog[`status${status.charAt(0).toUpperCase()}${status.slice(1)}` as keyof typeof i18n.dialog] as string}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="pd-popover" align="start" sideOffset={6}>
              <div className="pd-popover__title">{i18n.dialog.pillStatus}</div>
              {(['planning', 'active', 'blocked', 'done', 'archived'] as ProjectStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pd-popover__option"
                  data-selected={status === s}
                  onClick={() => setStatus(s)}
                >
                  <span className="pd-popover__option-dot" style={{ background: STATUS_COLORS[s] }} />
                  <span>{i18n.dialog[`status${s.charAt(0).toUpperCase()}${s.slice(1)}` as keyof typeof i18n.dialog] as string}</span>
                  {status === s ? <Check className="pd-popover__check" size={14} /> : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Priority pill */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pd-pill"
                data-active={priority !== 'medium' ? 'true' : 'false'}
                aria-label={i18n.dialog.pillPriority}
                style={{ color: priority === 'medium' ? undefined : PRIORITY_COLORS[priority] }}
              >
                <Flag className="pd-pill__icon" size={13} />
                <span className="pd-pill__priority-dots" aria-hidden>
                  <i data-dim={PRIORITY_LEVEL[priority] < 1} />
                  <i data-dim={PRIORITY_LEVEL[priority] < 2} />
                  <i data-dim={PRIORITY_LEVEL[priority] < 3} />
                </span>
                <span>
                  {priority === 'high' ? i18n.dialog.priorityHigh : priority === 'low' ? i18n.dialog.priorityLow : i18n.dialog.priorityMedium}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="pd-popover" align="start" sideOffset={6}>
              <div className="pd-popover__title">{i18n.dialog.pillPriority}</div>
              {(['high', 'medium', 'low'] as ProjectPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="pd-popover__option"
                  data-selected={priority === p}
                  onClick={() => setPriority(p)}
                >
                  <span className="pd-popover__option-dot" style={{ background: PRIORITY_COLORS[p] }} />
                  <span>
                    {p === 'high' ? i18n.dialog.priorityHigh : p === 'low' ? i18n.dialog.priorityLow : i18n.dialog.priorityMedium}
                  </span>
                  {priority === p ? <Check className="pd-popover__check" size={14} /> : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Owner pill */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pd-pill"
                data-active={ownerId !== 'unassigned' ? 'true' : 'false'}
                aria-label={i18n.dialog.pillOwner}
              >
                {ownerName ? (
                  <span className="pd-owner-avatar" style={{ width: 18, height: 18, fontSize: 9 }}>
                    {initialsFromName(ownerName)}
                  </span>
                ) : (
                  <User className="pd-pill__icon" size={13} />
                )}
                <span>{ownerName ?? i18n.dialog.pillOwner}</span>
                {ownerId !== 'unassigned' ? (
                  <span
                    aria-hidden
                    className="pd-pill__clear"
                    onClick={(e) => { e.stopPropagation(); setOwnerId('unassigned') }}
                  >×</span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent className="pd-popover" align="start" sideOffset={6}>
              <div className="pd-popover__title">{i18n.dialog.pillOwner}</div>
              {people.length > 4 ? (
                <input
                  className="pd-owner-search"
                  placeholder={i18n.dialog.searchContacts}
                  value={ownerQuery}
                  onChange={(e) => setOwnerQuery(e.target.value)}
                />
              ) : null}
              <div className="pd-owner-list">
                <button
                  type="button"
                  className="pd-popover__option"
                  data-selected={ownerId === 'unassigned'}
                  onClick={() => setOwnerId('unassigned')}
                >
                  <span className="pd-owner-avatar"><Tag size={11} /></span>
                  <span>{i18n.dialog.unassigned}</span>
                  {ownerId === 'unassigned' ? <Check className="pd-popover__check" size={14} /> : null}
                </button>
                {filteredPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="pd-popover__option"
                    data-selected={ownerId === person.id}
                    onClick={() => setOwnerId(person.id)}
                  >
                    <span className="pd-owner-avatar">{initialsFromName(person.name)}</span>
                    <span>{person.name}</span>
                    {ownerId === person.id ? <Check className="pd-popover__check" size={14} /> : null}
                  </button>
                ))}
                {filteredPeople.length === 0 && ownerQuery ? (
                  <p style={{ padding: '8px 10px', fontSize: 12, color: 'rgba(58,55,51,0.5)' }}>
                    {i18n.dialog.noContactsMatch}
                  </p>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          {/* Color pill */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pd-pill"
                data-active="true"
                aria-label={i18n.dialog.pillColor}
              >
                <span className="pd-pill__dot" style={{ ['--pd-pill-dot' as string]: color }} />
                <Palette className="pd-pill__icon" size={12} style={{ opacity: 0.55 }} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="pd-popover" align="start" sideOffset={6}>
              <div className="pd-popover__title">{i18n.dialog.pillColor}</div>
              <div className="pd-color-grid" role="radiogroup" aria-label={i18n.dialog.fieldColor}>
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    data-active={color === c}
                    className="pd-color-swatch"
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  >
                    <span className="sr-only">{c}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="pd-drawer" data-open={drawerOpen}>
          <button
            type="button"
            className="pd-drawer__toggle"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
          >
            <ChevronDown className="pd-drawer__chevron" size={14} />
            <span>{drawerOpen ? i18n.dialog.fewerOptions : i18n.dialog.moreOptions}</span>
          </button>
          <div className="pd-drawer__content">
            <div className="pd-drawer__inner">
              <div className="pd-drawer__row">
                <span className="pd-drawer__label">{i18n.dialog.pillStart}</span>
                <input
                  type="date"
                  className="pd-drawer__input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={dueDate || undefined}
                />
              </div>
              <div className="pd-drawer__row">
                <span className="pd-drawer__label">{i18n.dialog.fieldNextAction}</span>
                <input
                  type="text"
                  className="pd-drawer__input"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder={i18n.dialog.nextActionPlaceholder}
                  onKeyDown={handleSingleLineEnter}
                />
              </div>
              <div className="pd-drawer__row">
                <span className="pd-drawer__label">{i18n.dialog.fieldRiskSummary}</span>
                <textarea
                  className="pd-drawer__textarea"
                  value={riskSummary}
                  onChange={(e) => setRiskSummary(e.target.value)}
                  placeholder={i18n.dialog.riskPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pd-v2__footer">
          <div className="pd-v2__footer-meta">
            {isEditMode && savedLabel ? (
              <span className="pd-save-indicator">{savedLabel}</span>
            ) : (
              <span className="pd-v2__footer-hint">
                <kbd>⌘</kbd><kbd>↵</kbd> {isEditMode ? i18n.dialog.done : i18n.dialog.createProject}
              </span>
            )}
          </div>
          <div className="pd-v2__footer-actions">
            {isEditMode ? (
              <Button type="button" className="project-button project-button--primary" onClick={onClose}>
                {i18n.dialog.done}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
                  {i18n.dialog.cancel}
                </Button>
                <Button
                  type="button"
                  className="project-button project-button--primary"
                  onClick={handleCreate}
                >
                  {i18n.dialog.createProject}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export const PersonFormDialog = ({ open, person, onClose, onSubmit }: PersonFormDialogProps) => {
  const i18n = useProjectsI18n()
  const [name, setName] = useState('')
  const [roleType, setRoleType] = useState<ProjectPerson['roleType']>('collaborator')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  const [contacts, setContacts] = useState<LifePerson[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setRoleType(person?.roleType ?? 'collaborator')
    setPhone(person?.phone ?? '')
    setEmail(person?.email ?? '')
    setNote(person?.note ?? '')
    setContactQuery('')
    setSelectedContactId(null)
  }, [open, person])

  useEffect(() => {
    if (!open || person) return
    void peopleRepo.list().then(setContacts)
  }, [open, person])

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase()
    const list = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.role?.toLowerCase().includes(q)
        )
      : contacts
    return list.slice(0, 20)
  }, [contacts, contactQuery])

  const handleSelectContact = (contact: LifePerson) => {
    if (selectedContactId === contact.id) {
      setSelectedContactId(null)
      setName('')
      setPhone('')
      setEmail('')
      setNote('')
    } else {
      setSelectedContactId(contact.id)
      setName(contact.name)
      setPhone(contact.phone ?? '')
      setEmail(contact.email ?? '')
      setNote(contact.notes ?? '')
    }
  }

  const dialogTitle = useMemo(() => (person ? i18n.dialog.editPerson : i18n.dialog.addPerson), [person, i18n])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(560px,calc(100vw-32px))] rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="project-dialog">
        <div className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">{i18n.dialog.peopleEyebrow}</p>
            <h2 className="project-dialog__title">{dialogTitle}</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          {!person && contacts.length > 0 ? (
            <div className="pd-contact-picker">
              <p className="pd-contact-picker__label">{i18n.dialog.fromContacts}</p>
              <div className="pd-contact-picker__search-wrap">
                <Search className="pd-contact-picker__search-icon" size={14} />
                <input
                  className="pd-contact-picker__search"
                  placeholder={i18n.dialog.searchContacts}
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                />
              </div>
              <div className="pd-contact-picker__list">
                {filteredContacts.length === 0 ? (
                  <p className="pd-contact-picker__empty">{i18n.dialog.noContactsMatch}</p>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected = selectedContactId === contact.id
                    const color = GROUP_COLORS[contact.group] ?? '#9ca3af'
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className={`pd-contact-item${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handleSelectContact(contact)}
                      >
                        <span
                          className="pd-contact-item__avatar"
                          style={{ background: color + '22', color }}
                        >
                          {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="pd-contact-item__info">
                          <span className="pd-contact-item__name">{contact.name}</span>
                          {contact.role || contact.group ? (
                            <span className="pd-contact-item__meta">{contact.role || contact.group}</span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check className="pd-contact-item__check" size={14} />
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="pd-contact-picker__divider">
                <span>{i18n.dialog.orFillManually}</span>
              </div>
            </div>
          ) : null}
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldName}</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} placeholder={i18n.dialog.namePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldRole}</span>
              <Select value={roleType} onValueChange={(value: ProjectPerson['roleType']) => setRoleType(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{i18n.dialog.roleOwner}</SelectItem>
                  <SelectItem value="collaborator">{i18n.dialog.roleCollaborator}</SelectItem>
                  <SelectItem value="reviewer">{i18n.dialog.roleReviewer}</SelectItem>
                  <SelectItem value="external">{i18n.dialog.roleExternal}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldPhone}</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClassName} placeholder={i18n.dialog.phonePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldEmail}</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} placeholder={i18n.dialog.emailPlaceholder} />
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldNote}</span>
              <Input value={note} onChange={(event) => setNote(event.target.value)} className={inputClassName} placeholder={i18n.dialog.notePlaceholder} />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
            {i18n.dialog.cancel}
          </Button>
          <Button
            type="button"
            className="project-button project-button--primary"
            disabled={name.trim().length === 0}
            onClick={() => void onSubmit({ name, roleType, phone: phone || undefined, email: email || undefined, note: note || undefined })}
          >
            {person ? i18n.dialog.savePerson : i18n.dialog.addPerson}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

type ProjectTaskPayload = {
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  priority: 'high' | 'medium' | 'low'
  ownerId?: string
  dueDate?: string
  startDate?: string
}

type ProjectTaskDialogProps = {
  open: boolean
  task?: TaskItem | null
  people: ProjectPerson[]
  onClose: () => void
  onAutoSave?: (payload: ProjectTaskPayload) => Promise<void> | void
  onSubmit: (payload: ProjectTaskPayload) => Promise<void> | void
}

export const ProjectTaskDialog = ({ open, task, people, onClose, onAutoSave, onSubmit }: ProjectTaskDialogProps) => {
  const i18n = useProjectsI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'todo' | 'doing' | 'done'>('todo')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [ownerId, setOwnerId] = useState('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  const isInitializedRef = useRef(false)

  useEffect(() => {
    isInitializedRef.current = false
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStatus(task?.status ?? 'todo')
    setPriority(task?.priority ?? 'medium')
    setOwnerId(task?.ownerId ?? 'unassigned')
    setStartDate(task?.startDate ?? '')
    setDueDate(task?.dueDate ?? '')
  }, [open, task])

  useEffect(() => {
    if (!open || !onAutoSave || !task) return
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      void onAutoSave({
        title, description, status, priority,
        ownerId: ownerId === 'unassigned' ? undefined : ownerId,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      })
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, priority, ownerId, startDate, dueDate])

  const isEditMode = !!task && !!onAutoSave

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(620px,calc(100vw-32px))] rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="project-dialog">
        <div className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">{i18n.dialog.tasksEyebrow}</p>
            <h2 className="project-dialog__title">{task ? i18n.dialog.editTask : i18n.dialog.addTask}</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldTitle}</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClassName} placeholder={i18n.dialog.taskTitlePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldDescription}</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClassName} placeholder={i18n.dialog.taskDescPlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldStatus}</span>
              <Select value={status} onValueChange={(value: 'todo' | 'doing' | 'done') => setStatus(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{i18n.dialog.taskStatusTodo}</SelectItem>
                  <SelectItem value="doing">{i18n.dialog.taskStatusInProgress}</SelectItem>
                  <SelectItem value="done">{i18n.dialog.taskStatusDone}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldPriority}</span>
              <Select value={priority} onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{i18n.dialog.priorityHigh}</SelectItem>
                  <SelectItem value="medium">{i18n.dialog.priorityMedium}</SelectItem>
                  <SelectItem value="low">{i18n.dialog.priorityLow}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldOwner}</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{i18n.dialog.unassigned}</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldStartDate}</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldDueDate}</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          {isEditMode ? (
            <Button type="button" className="project-button project-button--primary" onClick={onClose}>
              {i18n.dialog.done}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
                {i18n.dialog.cancel}
              </Button>
              <Button
                type="button"
                className="project-button project-button--primary"
                disabled={title.trim().length === 0}
                onClick={() => void onSubmit({
                  title,
                  description,
                  status,
                  priority,
                  ownerId: ownerId === 'unassigned' ? undefined : ownerId,
                  startDate: startDate || undefined,
                  dueDate: dueDate || undefined,
                })}
              >
                {i18n.dialog.addTask}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
