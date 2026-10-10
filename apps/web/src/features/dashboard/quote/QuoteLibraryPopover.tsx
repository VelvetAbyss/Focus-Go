import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import ActiveIndicator from '../../../shared/motion/ActiveIndicator'
import { QUOTE_COUNT } from './quoteService'
import { cleanOwnQuote, MAX_OWN_QUOTE_LENGTH, MAX_OWN_QUOTES, type OwnQuote, type QuoteLibrary, type QuoteState } from './quoteStorage'
import { newQuoteId, updateQuoteState } from './useQuoteState'

type QuoteLibraryPopoverProps = {
  state: QuoteState
  /** A line was just written at `index` of `count`; the header brings it up. */
  onAdded: (index: number, count: number) => void
}

/**
 * The "+" beside "another quote": one popover that picks the library the
 * header draws from, takes a new line to yourself, and lists the ones you
 * wrote (DESIGN.md › Dashboard header).
 */
const QuoteLibraryPopover = ({ state, onAdded }: QuoteLibraryPopoverProps) => {
  const { language, t } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const line = cleanOwnQuote(draft)
  const full = state.mine.length >= MAX_OWN_QUOTES

  const setLibrary = (library: QuoteLibrary) => updateQuoteState((current) => ({ ...current, library }))

  const add = (event?: FormEvent) => {
    event?.preventDefault()
    if (!line || full) return
    const entry: OwnQuote = { id: newQuoteId(), text: line, addedAt: Date.now() }
    const count = state.mine.length + 1
    // Writing a line is asking to see it: switch to your lines and show it today.
    updateQuoteState((current) => ({ library: 'mine', mine: [...current.mine, entry] }))
    onAdded(count - 1, count)
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // A line is one line, so Enter adds; while an IME is composing it confirms
    // the candidate instead.
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    add()
  }

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const saveEdit = () => {
    if (!editing) return
    const text = cleanOwnQuote(editing.text)
    setEditing(null)
    // Emptied out is not a delete; the × is right there for that.
    if (!text) return
    updateQuoteState((current) => ({
      ...current,
      mine: current.mine.map((item) => (item.id === editing.id ? { ...item, text } : item)),
    }))
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      saveEdit()
    } else if (event.key === 'Escape') {
      // Esc leaves the edit, not the popover.
      event.preventDefault()
      event.stopPropagation()
      setEditing(null)
    }
  }

  const remove = (entry: OwnQuote) => {
    const index = state.mine.findIndex((item) => item.id === entry.id)
    updateQuoteState((current) => ({ ...current, mine: current.mine.filter((item) => item.id !== entry.id) }))
    toast.push({
      message: t('dashboard.quote.removed'),
      actionLabel: t('dashboard.quote.undo'),
      onAction: () =>
        updateQuoteState((current) => {
          if (current.mine.some((item) => item.id === entry.id)) return current
          const mine = [...current.mine]
          mine.splice(Math.min(index, mine.length), 0, entry)
          return { ...current, mine }
        }),
    })
  }

  const newestFirst = [...state.mine].reverse()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="dash-hero__quote-next dash-hero__quote-own"
          aria-label={t('dashboard.quote.open')}
          title={t('dashboard.quote.open')}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="quote-library"
        // Undoing a delete from the toast is still working in here.
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest('.toast-viewport')) event.preventDefault()
        }}
      >
        <div className="quote-library__switch" role="group" aria-label={t('dashboard.quote.library')}>
          <ActiveIndicator selector=':scope > [aria-pressed="true"]' />
          <button
            type="button"
            className="quote-library__tab"
            aria-pressed={state.library === 'default'}
            onClick={() => setLibrary('default')}
          >
            {t('dashboard.quote.library.default', { count: QUOTE_COUNT })}
          </button>
          <button
            type="button"
            className="quote-library__tab"
            aria-pressed={state.library === 'mine'}
            onClick={() => setLibrary('mine')}
          >
            {t('dashboard.quote.library.mine', { count: state.mine.length })}
          </button>
        </div>

        <form className="quote-library__compose" onSubmit={add}>
          <textarea
            className="quote-library__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('dashboard.quote.compose')}
            aria-label={t('dashboard.quote.compose')}
            maxLength={MAX_OWN_QUOTE_LENGTH}
            rows={2}
            disabled={full}
          />
          <div className="quote-library__compose-row">
            <span className="quote-library__hint">{state.mine.length === 0 ? t('dashboard.quote.hint') : null}</span>
            <button type="submit" className="quote-library__add" disabled={!line || full}>
              {t('dashboard.quote.add')}
            </button>
          </div>
        </form>

        {newestFirst.length > 0 ? (
          <ul className="quote-library__list">
            {newestFirst.map((entry) => (
              <li key={entry.id} className="quote-library__item">
                {editing?.id === entry.id ? (
                  // Two lines, so a long line is seen whole while it's edited.
                  <textarea
                    className="quote-library__edit"
                    rows={2}
                    value={editing.text}
                    onChange={(event) => setEditing({ id: entry.id, text: event.target.value })}
                    onKeyDown={handleEditKeyDown}
                    onBlur={saveEdit}
                    maxLength={MAX_OWN_QUOTE_LENGTH}
                    aria-label={t('dashboard.quote.edit')}
                    autoFocus
                    onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)}
                  />
                ) : (
                  <button
                    type="button"
                    className="quote-library__text"
                    onClick={() => setEditing({ id: entry.id, text: entry.text })}
                    title={t('dashboard.quote.edit')}
                  >
                    {entry.text}
                    {entry.author ? (
                      <span className="quote-library__author">{language === 'zh' ? `——${entry.author}` : `— ${entry.author}`}</span>
                    ) : null}
                  </button>
                )}
                <button
                  type="button"
                  className="quote-library__remove"
                  onClick={() => remove(entry)}
                  aria-label={t('dashboard.quote.remove')}
                  title={t('dashboard.quote.remove')}
                >
                  <X size={12} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export default QuoteLibraryPopover
