import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'
import { ensureSyncTables } from '../sync/store.js'
import { ensurePaymentTables } from '../services/payments.js'
import { ensureNeteasePodcastTables } from '../services/podcasts.js'

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
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id)')

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

export default db
