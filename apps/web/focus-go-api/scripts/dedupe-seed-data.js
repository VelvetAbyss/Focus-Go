// One-shot cleanup for accounts that accumulated duplicate initial-seed
// records before the server-authoritative seed claim landed. For every user,
// keep the earliest copy of each canonical seed item (matched by the literal
// strings written by src/data/seed.ts) and soft-delete the rest. After the
// pass, stamp users.initial_seeded_at so the new claim endpoint short-circuits.
//
// Usage:
//   node scripts/dedupe-seed-data.js                          # dry run: dedupe + stamp summary
//   node scripts/dedupe-seed-data.js --apply                  # apply dedupe + stamp
//   node scripts/dedupe-seed-data.js --stamp-only             # dry run: stamp only (skip dedupe)
//   node scripts/dedupe-seed-data.js --stamp-only --apply     # apply stamp only — touches zero user content
//
// Soft delete = set deleted_at = now and bump updated_at so RxDB pulls the
// tombstone on the next sync. Payload is kept intact for forensics.
//
// --stamp-only is the safe option for live production with real users: it only
// writes users.initial_seeded_at (metadata column, never read by the client as
// content). Use it to stop the "re-seed on every login" loop without risking
// any change to user-facing rows.

import db from '../db/init.js'

const APPLY = process.argv.includes('--apply')
const STAMP_ONLY = process.argv.includes('--stamp-only')
const NOW = Date.now()

const TARGETS = [
  {
    table: 'sync_tasks',
    label: 'task',
    match: (payload) => payload?.title === 'Plan today around one meaningful task',
  },
  {
    table: 'sync_widget_todos',
    label: 'widgetTodo',
    match: (payload) =>
      payload?.title === 'Keep the dashboard light: one task, one session, one review.',
  },
  {
    table: 'sync_diary_entries',
    label: 'diaryEntry',
    match: (payload) => typeof payload?.contentMd === 'string'
      && payload.contentMd.startsWith('## Today\n- Chose one thing worth finishing'),
  },
  {
    table: 'sync_spend_categories',
    label: 'spendCategory(Life)',
    match: (payload) => payload?.name === 'Life' && payload?.icon === 'WalletCards',
  },
  {
    table: 'sync_spends',
    label: 'spendEntry(lunch)',
    match: (payload) => payload?.amount === 32 && payload?.note === 'Quick lunch between tasks',
  },
  {
    table: 'sync_trips',
    label: 'trip(Tokyo demo)',
    match: (payload) =>
      payload?.title === 'Tokyo Trip'
      && payload?.destination === 'Tokyo, Japan'
      && payload?.startDate === '2026-05-08'
      && payload?.endDate === '2026-05-14',
  },
]

const dedupePerUser = ({ table, label, match }) => {
  const rows = db.prepare(`SELECT id, user_id, payload, updated_at, deleted_at FROM ${table}`).all()
  const groups = new Map()
  for (const row of rows) {
    if (row.deleted_at) continue
    let payload
    try { payload = JSON.parse(row.payload) } catch { continue }
    if (!match(payload)) continue
    const list = groups.get(row.user_id) ?? []
    list.push({ id: row.id, updatedAt: row.updated_at })
    groups.set(row.user_id, list)
  }

  let usersAffected = 0
  let toDelete = 0
  const update = db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ?`)

  for (const [userId, items] of groups) {
    if (items.length <= 1) continue
    usersAffected += 1
    items.sort((a, b) => a.updatedAt - b.updatedAt)
    const [, ...redundant] = items
    toDelete += redundant.length
    if (APPLY) {
      const tx = db.transaction(() => {
        for (const dup of redundant) update.run(NOW, NOW, userId, dup.id)
      })
      tx()
    }
  }

  console.log(`[${label}] users with duplicates=${usersAffected}, rows ${APPLY ? 'soft-deleted' : 'would soft-delete'}=${toDelete}`)
  return { usersAffected, toDelete }
}

const stampUsersAsSeeded = () => {
  // Only stamp users that currently have any seed-surface row (anyone whose
  // local DB ever ran seedDatabase). Untouched users keep NULL so a real
  // first-time seed can still fire.
  // sync_*.user_id stores String(users.id) (see routes/sync.js and admin/purge),
  // NOT users.auth_user_id. The earlier auth_user_id join silently matched zero
  // rows on every account, so this stamp pass was a no-op in production.
  const candidates = db.prepare(`
    SELECT u.id
    FROM users u
    WHERE u.initial_seeded_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM sync_tasks t WHERE t.user_id = CAST(u.id AS TEXT))
        OR EXISTS (SELECT 1 FROM sync_widget_todos w WHERE w.user_id = CAST(u.id AS TEXT))
        OR EXISTS (SELECT 1 FROM sync_diary_entries d WHERE d.user_id = CAST(u.id AS TEXT))
        OR EXISTS (SELECT 1 FROM sync_spends s WHERE s.user_id = CAST(u.id AS TEXT))
        OR EXISTS (SELECT 1 FROM sync_spend_categories c WHERE c.user_id = CAST(u.id AS TEXT))
        OR EXISTS (SELECT 1 FROM sync_trips tr WHERE tr.user_id = CAST(u.id AS TEXT))
      )
  `).all()
  console.log(`Users to stamp as seeded: ${candidates.length}`)
  if (!APPLY) return
  const stamp = db.prepare('UPDATE users SET initial_seeded_at = CURRENT_TIMESTAMP WHERE id = ? AND initial_seeded_at IS NULL')
  const tx = db.transaction(() => {
    for (const row of candidates) stamp.run(row.id)
  })
  tx()
}

console.log(APPLY ? '== APPLY MODE ==' : '== DRY RUN ==')
if (STAMP_ONLY) console.log('== STAMP ONLY (dedupe skipped — no sync rows will be touched) ==')
let totalDeleted = 0
if (!STAMP_ONLY) {
  for (const target of TARGETS) {
    const { toDelete } = dedupePerUser(target)
    totalDeleted += toDelete
  }
}
stampUsersAsSeeded()
if (!STAMP_ONLY) console.log(`Total redundant rows ${APPLY ? 'soft-deleted' : 'would soft-delete'}: ${totalDeleted}`)
console.log(APPLY ? 'Done.' : 'Re-run with --apply to commit.')
