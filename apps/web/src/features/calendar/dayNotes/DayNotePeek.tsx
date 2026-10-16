import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import type { DayNote, DayNoteTone } from './dayNotesStorage'
import './dayNotes.css'

export type DayNotePeekAnchor = {
  dateKey: string
  /** The cell's box when the peek opened (viewport coordinates). */
  rect: { top: number; right: number; bottom: number }
}

type DayNotePeekProps = {
  anchor: DayNotePeekAnchor
  heading: string
  notes: DayNote[]
  tone: DayNoteTone
}

// Room the peek needs under its day's date line before it opens upward instead.
const ROOM_BELOW = 180

/**
 * A day's notes on paper, under the folded corner of its month cell. It lives
 * on <body> because the month grid clips what overflows its cells.
 */
const DayNotePeek = ({ anchor, heading, notes, tone }: DayNotePeekProps) => {
  if (typeof document === 'undefined' || notes.length === 0) return null
  const { rect } = anchor
  const right = Math.max(8, window.innerWidth - rect.right + 4)
  const style: CSSProperties =
    window.innerHeight - rect.top < ROOM_BELOW
      ? { right, bottom: window.innerHeight - rect.top + 4 }
      : { right, top: rect.top + 34 }

  return createPortal(
    <div className="day-note-peek" role="tooltip" style={style} data-note-tone={tone}>
      <p className="day-note-peek__head">
        <span className="day-note-fold" aria-hidden="true" />
        {heading}
      </p>
      <ul className="day-note-peek__list">
        {notes.map((note) => (
          <li key={note.id} className="day-note-peek__item">
            {note.text}
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  )
}

export default DayNotePeek
