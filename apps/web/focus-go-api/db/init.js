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
    email       TEXT,
    plan        TEXT    NOT NULL DEFAULT 'free',
    status      TEXT    NOT NULL DEFAULT 'active',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

ensureSyncTables(db)
ensurePaymentTables(db)
ensureNeteasePodcastTables(db)

export default db
