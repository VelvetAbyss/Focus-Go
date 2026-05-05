import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'
import { ensureSyncTables } from '../sync/store.js'
import { ensurePaymentTables } from '../services/payments.js'
import { ensureNeteasePodcastTables } from '../services/podcasts.js'
import { ensureNewsTables } from '../services/news.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const DB_PATH = join(DATA_DIR, 'focusgo.db')

mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    authing_id  TEXT    UNIQUE NOT NULL,
    auth_user_id TEXT UNIQUE,
    email       TEXT,
    plan        TEXT    NOT NULL DEFAULT 'free',
    status      TEXT    NOT NULL DEFAULT 'active',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const userColumns = db.prepare("PRAGMA table_info('users')").all().map((column) => column.name)
if (!userColumns.includes('auth_user_id')) {
  db.exec('ALTER TABLE users ADD COLUMN auth_user_id TEXT')
}
if (!userColumns.includes('initial_seeded_at')) {
  db.exec('ALTER TABLE users ADD COLUMN initial_seeded_at DATETIME')
}
if (!userColumns.includes('premium_expires_at')) {
  db.exec('ALTER TABLE users ADD COLUMN premium_expires_at INTEGER')
}
if (!userColumns.includes('suspension_reason')) {
  db.exec('ALTER TABLE users ADD COLUMN suspension_reason TEXT')
}
if (!userColumns.includes('deletion_requested_at')) {
  db.exec('ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER')
}
if (!userColumns.includes('deletion_pending_at')) {
  db.exec('ALTER TABLE users ADD COLUMN deletion_pending_at INTEGER')
}
if (!userColumns.includes('tags')) {
  db.exec("ALTER TABLE users ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
}
// ISO 3166-1 alpha-2 country code detected from IP on first authenticated request.
// 'CN' = China region (Alipay); all others = global region (PayPal).
// NULL means not yet detected — frontend falls back to lang/timezone heuristic.
if (!userColumns.includes('country_code')) {
  db.exec('ALTER TABLE users ADD COLUMN country_code TEXT')
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id)')

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id           TEXT PRIMARY KEY,
    admin_email  TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    action       TEXT NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    reason       TEXT,
    ip           TEXT,
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON admin_audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON admin_audit_logs(created_at DESC);

  CREATE TABLE IF NOT EXISTS admin_user_notes (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    admin_email  TEXT NOT NULL,
    body         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS user_notes_user_idx ON admin_user_notes(user_id);

  CREATE TABLE IF NOT EXISTS user_feedback (
    id           TEXT PRIMARY KEY,
    user_id      TEXT,
    email        TEXT,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    page_context TEXT,
    user_agent   TEXT,
    status       TEXT NOT NULL DEFAULT 'new',
    admin_reply  TEXT,
    priority     TEXT NOT NULL DEFAULT 'normal',
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS feedback_status_idx ON user_feedback(status);
  CREATE INDEX IF NOT EXISTS feedback_user_idx ON user_feedback(user_id);
  CREATE INDEX IF NOT EXISTS feedback_created_idx ON user_feedback(created_at DESC);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    emailVerified   INTEGER NOT NULL DEFAULT 0,
    image           TEXT,
    createdAt       TEXT NOT NULL,
    updatedAt       TEXT NOT NULL,
    username        TEXT UNIQUE,
    displayUsername TEXT
  );

  CREATE TABLE IF NOT EXISTS session (
    id        TEXT PRIMARY KEY,
    expiresAt TEXT NOT NULL,
    token     TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS session_userId_idx ON session(userId);

  CREATE TABLE IF NOT EXISTS account (
    id                    TEXT PRIMARY KEY,
    accountId             TEXT NOT NULL,
    providerId            TEXT NOT NULL,
    userId                TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken           TEXT,
    refreshToken          TEXT,
    idToken               TEXT,
    accessTokenExpiresAt  TEXT,
    refreshTokenExpiresAt TEXT,
    scope                 TEXT,
    password              TEXT,
    createdAt             TEXT NOT NULL,
    updatedAt             TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_userId_idx ON account(userId);

  CREATE TABLE IF NOT EXISTS verification (
    id         TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value      TEXT NOT NULL,
    expiresAt  TEXT NOT NULL,
    createdAt  TEXT,
    updatedAt  TEXT
  );
`)

ensureSyncTables(db)
ensurePaymentTables(db)
ensureNeteasePodcastTables(db)
ensureNewsTables(db)

export default db
