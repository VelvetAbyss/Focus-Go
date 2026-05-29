import type { TripRecord, TripItineraryDay } from '../../../data/models/types'

/**
 * Journal-style PDF export for a trip. Builds a paper-textured HTML document,
 * rasterizes it with html2canvas and paginates into A4 via jsPDF — the same
 * proven pipeline as note export, which renders CJK text reliably.
 */

const PAGE_BG = '#F5F3F0'
const CARD_BG = '#FDFAF7'
const TEXT_COLOR = '#3A3733'
const MUTED = 'rgba(58,55,51,0.55)'
const BORDER = 'rgba(58,55,51,0.12)'
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const SERIF = '"Songti SC", "Noto Serif CJK SC", "Iowan Old Style", "Palatino Linotype", Georgia, serif'
const SANS = '"PingFang SC", "Noto Sans CJK SC", -apple-system, "Segoe UI", Arial, sans-serif'

const esc = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const fileName = (title: string) =>
  `${(title.trim() || 'trip').replace(/[^\w一-龥-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'trip'}.pdf`

const dayRow = (day: TripItineraryDay) => {
  const items = day.items
    .map((item) => {
      const time = item.startTime
        ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
        : item.time || ''
      const loc = item.location || item.geo?.address || ''
      return `
        <div class="trip-pdf__item">
          <div class="trip-pdf__item-time">${esc(time)}</div>
          <div class="trip-pdf__item-body">
            <div class="trip-pdf__item-title">${esc(item.title || '—')}</div>
            ${loc ? `<div class="trip-pdf__item-loc">📍 ${esc(loc)}</div>` : ''}
            ${item.notes ? `<div class="trip-pdf__item-note">${esc(item.notes)}</div>` : ''}
          </div>
        </div>`
    })
    .join('')
  return `
    <section class="trip-pdf__day">
      <div class="trip-pdf__day-head">
        <span class="trip-pdf__day-num">Day ${day.day}</span>
        <span class="trip-pdf__day-label">${esc(day.label || '')}</span>
        <span class="trip-pdf__day-date">${esc(day.date || '')}</span>
      </div>
      ${items || '<div class="trip-pdf__empty">No activities</div>'}
    </section>`
}

const transportBlock = (trip: TripRecord) => {
  if (!trip.transport.length) return ''
  const rows = trip.transport
    .map(
      (leg) => `
      <div class="trip-pdf__ticket">
        <div class="trip-pdf__ticket-method">${esc(leg.method)}</div>
        <div class="trip-pdf__ticket-route">${esc(leg.from || '?')} → ${esc(leg.to || '?')}</div>
        <div class="trip-pdf__ticket-meta">${esc(leg.date || '')} · ${esc(leg.departTime || '')}–${esc(leg.arriveTime || '')} · ${esc(leg.status)}</div>
        ${leg.bookingRef ? `<div class="trip-pdf__ticket-ref">Ref: ${esc(leg.bookingRef)}</div>` : ''}
      </div>`,
    )
    .join('')
  return `<section class="trip-pdf__section"><h2 class="trip-pdf__h2">Transport</h2><div class="trip-pdf__tickets">${rows}</div></section>`
}

const staysBlock = (trip: TripRecord) => {
  if (!trip.stays.length) return ''
  const rows = trip.stays
    .map(
      (stay) => `
      <div class="trip-pdf__stay">
        <div class="trip-pdf__stay-name">🏨 ${esc(stay.name)}</div>
        <div class="trip-pdf__stay-meta">${esc(stay.checkIn || '')} → ${esc(stay.checkOut || '')} · ${stay.nights} night(s) · ${esc(stay.status)}</div>
        ${stay.address ? `<div class="trip-pdf__stay-addr">${esc(stay.address)}</div>` : ''}
      </div>`,
    )
    .join('')
  return `<section class="trip-pdf__section"><h2 class="trip-pdf__h2">Stays</h2>${rows}</section>`
}

const notesBlock = (trip: TripRecord) => {
  if (!trip.notes.trim()) return ''
  return `<section class="trip-pdf__section"><h2 class="trip-pdf__h2">Notes</h2><div class="trip-pdf__notes">${esc(trip.notes).replace(/\n/g, '<br/>')}</div></section>`
}

export const buildTripPdfHtml = (trip: TripRecord) => {
  const days = trip.itinerary.map(dayRow).join('')
  const totalActivities = trip.itinerary.reduce((sum, d) => sum + d.items.length, 0)
  return `
    <style>
      .trip-pdf { box-sizing: border-box; width: 794px; padding: 56px 60px 72px; background: ${PAGE_BG}; color: ${TEXT_COLOR}; font-family: ${SANS}; }
      .trip-pdf *, .trip-pdf *::before, .trip-pdf *::after { box-sizing: border-box; }
      .trip-pdf__cover { text-align: center; padding: 40px 0 48px; border-bottom: 1px solid ${BORDER}; margin-bottom: 36px; }
      .trip-pdf__emoji { font-size: 64px; line-height: 1; }
      .trip-pdf__title { font-family: ${SERIF}; font-size: 40px; font-weight: 600; margin: 18px 0 8px; }
      .trip-pdf__dest { font-size: 16px; color: ${MUTED}; }
      .trip-pdf__dates { font-size: 14px; color: ${MUTED}; margin-top: 6px; }
      .trip-pdf__stats { display: flex; justify-content: center; gap: 36px; margin-top: 24px; }
      .trip-pdf__stat-num { font-family: ${SERIF}; font-size: 26px; font-weight: 600; }
      .trip-pdf__stat-lbl { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: ${MUTED}; }
      .trip-pdf__h2 { font-family: ${SERIF}; font-size: 22px; font-weight: 600; margin: 0 0 16px; }
      .trip-pdf__section { margin-top: 32px; }
      .trip-pdf__day { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; break-inside: avoid; }
      .trip-pdf__day-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
      .trip-pdf__day-num { font-family: ${SERIF}; font-size: 18px; font-weight: 600; }
      .trip-pdf__day-label { font-size: 14px; flex: 1; }
      .trip-pdf__day-date { font-size: 12px; color: ${MUTED}; }
      .trip-pdf__item { display: flex; gap: 14px; padding: 8px 0; border-top: 1px dashed ${BORDER}; }
      .trip-pdf__item-time { width: 96px; flex-shrink: 0; font-size: 12px; color: ${MUTED}; font-variant-numeric: tabular-nums; }
      .trip-pdf__item-title { font-size: 14px; font-weight: 500; }
      .trip-pdf__item-loc { font-size: 12px; color: ${MUTED}; margin-top: 2px; }
      .trip-pdf__item-note { font-size: 12px; color: ${MUTED}; margin-top: 2px; font-style: italic; }
      .trip-pdf__empty { font-size: 12px; color: ${MUTED}; padding: 6px 0; }
      .trip-pdf__tickets { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .trip-pdf__ticket { background: ${CARD_BG}; border: 1px dashed ${BORDER}; border-radius: 10px; padding: 12px 14px; break-inside: avoid; }
      .trip-pdf__ticket-method { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; }
      .trip-pdf__ticket-route { font-family: ${SERIF}; font-size: 16px; font-weight: 600; margin: 4px 0; }
      .trip-pdf__ticket-meta { font-size: 11px; color: ${MUTED}; }
      .trip-pdf__ticket-ref { font-size: 11px; color: ${MUTED}; margin-top: 4px; }
      .trip-pdf__stay { background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; break-inside: avoid; }
      .trip-pdf__stay-name { font-size: 15px; font-weight: 500; }
      .trip-pdf__stay-meta { font-size: 12px; color: ${MUTED}; margin-top: 3px; }
      .trip-pdf__stay-addr { font-size: 12px; color: ${MUTED}; margin-top: 2px; }
      .trip-pdf__notes { font-size: 13px; line-height: 1.7; background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 16px 18px; }
    </style>
    <article class="trip-pdf">
      <header class="trip-pdf__cover">
        <div class="trip-pdf__emoji">${esc(trip.coverEmoji || '✈️')}</div>
        <div class="trip-pdf__title">${esc(trip.title || 'Trip')}</div>
        <div class="trip-pdf__dest">${esc(trip.destination || '')}</div>
        <div class="trip-pdf__dates">${esc(trip.startDate || '')} — ${esc(trip.endDate || '')}</div>
        <div class="trip-pdf__stats">
          <div><div class="trip-pdf__stat-num">${trip.itinerary.length}</div><div class="trip-pdf__stat-lbl">Days</div></div>
          <div><div class="trip-pdf__stat-num">${totalActivities}</div><div class="trip-pdf__stat-lbl">Activities</div></div>
          <div><div class="trip-pdf__stat-num">${trip.travelers}</div><div class="trip-pdf__stat-lbl">Travelers</div></div>
        </div>
      </header>
      <section class="trip-pdf__section"><h2 class="trip-pdf__h2">Itinerary</h2>${days || '<div class="trip-pdf__empty">No days planned yet.</div>'}</section>
      ${transportBlock(trip)}
      ${staysBlock(trip)}
      ${notesBlock(trip)}
    </article>`
}

export const exportTripAsPdf = async (trip: TripRecord) => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = buildTripPdfHtml(trip)
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.width = '794px'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.zIndex = '2147483647'
  wrapper.style.background = PAGE_BG
  document.body.appendChild(wrapper)

  try {
    const node = wrapper.querySelector<HTMLElement>('.trip-pdf') ?? wrapper
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    const canvas = await html2canvas(node, {
      backgroundColor: PAGE_BG,
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false,
      width: node.scrollWidth,
      height: node.scrollHeight,
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
    })

    if (canvas.width === 0 || canvas.height === 0) throw new Error('Failed to render trip PDF: empty canvas')

    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const imageHeightMm = (canvas.height * A4_WIDTH_MM) / canvas.width
    let remainingHeightMm = imageHeightMm
    let yOffsetMm = 0

    pdf.addImage(imageData, 'JPEG', 0, yOffsetMm, A4_WIDTH_MM, imageHeightMm)
    remainingHeightMm -= A4_HEIGHT_MM
    while (remainingHeightMm > 0) {
      yOffsetMm = remainingHeightMm - imageHeightMm
      pdf.addPage()
      pdf.addImage(imageData, 'JPEG', 0, yOffsetMm, A4_WIDTH_MM, imageHeightMm)
      remainingHeightMm -= A4_HEIGHT_MM
    }

    pdf.save(fileName(trip.title))
  } finally {
    wrapper.remove()
  }
}
