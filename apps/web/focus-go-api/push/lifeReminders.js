import { listPushSubscriptions, listUsersWithPushSubscriptions, wasReminderDelivered } from './store.js'

/**
 * Life reminders by push: a subscription that renews in three days (when its reminder is on) and
 * a birthday tomorrow. They go out in each device's morning (09:00–22:00 in its own time zone), once
 * per renewal or per birthday; devices that never sent a time zone are skipped.
 */

export const MORNING_FROM_MINUTES = 9 * 60
export const MORNING_TO_MINUTES = 22 * 60
const RENEWAL_DAYS_AHEAD = 3
const BIRTHDAY_DAYS_AHEAD = 1

const formatterCache = new Map()
const partsIn = (now, timeZone) => {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    formatterCache.set(timeZone, formatter)
  }
  const get = (type) => Number(formatter.formatToParts(now).find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), minutes: get('hour') * 60 + get('minute') }
}

const dayNumber = ({ year, month, day }) => Math.round(Date.UTC(year, month - 1, day) / 86_400_000)
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const clampDay = (year, month, day) => ({ year, month, day: Math.min(day, daysInMonth(year, month)) })

/** A subscription's next billing date on or after `today` (local), or null without a billing day. */
export const nextBillingDate = (sub, today) => {
  const day = Number(sub?.billingDay)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  if (sub.cycle === 'yearly') {
    const month = Number(sub.billingMonth)
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    let due = clampDay(today.year, month, day)
    if (dayNumber(due) < dayNumber(today)) due = clampDay(today.year + 1, month, day)
    return due
  }
  let due = clampDay(today.year, today.month, day)
  if (dayNumber(due) < dayNumber(today)) {
    const next = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 }
    due = clampDay(next.year, next.month, day)
  }
  return due
}

/** The next birthday on or after `today` from "YYYY-MM-DD" or "MM-DD" (29 Feb → 28 Feb off leap years). */
export const nextBirthday = (birthday, today) => {
  const match = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(birthday ?? '').trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  let next = clampDay(today.year, month, day)
  if (dayNumber(next) < dayNumber(today)) next = clampDay(today.year + 1, month, day)
  return next
}

const symbolOf = (currency) => (currency === 'USD' ? '$' : '¥')

const renewalPayload = (sub, due, language) => {
  const amount = Number(sub.amount)
  const price = Number.isFinite(amount) && amount > 0 ? `${symbolOf(sub.currency)}${amount}` : ''
  const name = String(sub.name ?? '').trim().slice(0, 60) || (language === 'en' ? 'A subscription' : '订阅')
  return language === 'en'
    ? { title: `${name} renews in ${RENEWAL_DAYS_AHEAD} days`, body: [price && `${price}/${sub.cycle === 'yearly' ? 'yr' : 'mo'}`, `${due.month}/${due.day}`].filter(Boolean).join(' · ') }
    : { title: `${name} ${RENEWAL_DAYS_AHEAD} 天后续费`, body: [price && `${price} · ${sub.cycle === 'yearly' ? '年付' : '月付'}`, `${due.month}月${due.day}日`].filter(Boolean).join(' · ') }
}

const birthdayPayload = (person, due, language) => {
  const name = String(person.name ?? '').trim().slice(0, 60)
  return language === 'en'
    ? { title: `${name}'s birthday is tomorrow`, body: `${due.month}/${due.day}` }
    : { title: `明天是${name}的生日`, body: `${due.month}月${due.day}日` }
}

const parse = (row) => {
  try {
    return JSON.parse(row.payload)
  } catch {
    return null
  }
}

/** Every (device, reminder) due now, not yet delivered. */
export const collectDueLifeReminders = (db, { now = Date.now() } = {}) => {
  const due = []
  const selectSubs = db.prepare('SELECT id, payload FROM sync_life_subscriptions WHERE user_id = ? AND deleted_at IS NULL')
  const selectPeople = db.prepare('SELECT id, payload FROM sync_life_people WHERE user_id = ? AND deleted_at IS NULL')
  for (const userId of listUsersWithPushSubscriptions(db)) {
    const devices = listPushSubscriptions(db, userId).filter((device) => device.timeZone)
    if (devices.length === 0) continue
    const subs = selectSubs.all(userId).map((row) => ({ id: row.id, item: parse(row) })).filter(({ item }) => item?.reminder === true)
    const people = selectPeople.all(userId).map((row) => ({ id: row.id, item: parse(row) })).filter(({ item }) => item?.birthday)
    if (subs.length === 0 && people.length === 0) continue
    for (const device of devices) {
      const local = partsIn(new Date(now), device.timeZone)
      if (local.minutes < MORNING_FROM_MINUTES || local.minutes >= MORNING_TO_MINUTES) continue
      const candidates = []
      for (const { id, item } of subs) {
        const date = nextBillingDate(item, local)
        if (date && dayNumber(date) - dayNumber(local) === RENEWAL_DAYS_AHEAD) {
          candidates.push({ key: `life-sub:${id}`, date, ...renewalPayload(item, date, device.language) })
        }
      }
      for (const { id, item } of people) {
        const date = nextBirthday(item.birthday, local)
        if (date && dayNumber(date) - dayNumber(local) === BIRTHDAY_DAYS_AHEAD) {
          candidates.push({ key: `life-bday:${id}`, date, ...birthdayPayload(item, date, device.language) })
        }
      }
      for (const candidate of candidates) {
        // One delivery per occurrence: the occurrence date is part of the key.
        const at = dayNumber(candidate.date) * 86_400_000
        if (wasReminderDelivered(db, device.id, candidate.key, at)) continue
        due.push({
          subscription: device,
          key: candidate.key,
          at,
          payload: { kind: 'life-reminder', title: candidate.title, body: candidate.body, language: device.language, tag: candidate.key, url: '/' },
        })
      }
    }
  }
  return due
}
