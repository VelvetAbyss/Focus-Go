import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth/betterAuth.js'
import { ensureDesktopAuthTable, registerDesktopAuthRoutes } from './auth/desktopAuth.js'
import { ensureIntegrationTokenTable } from './auth/integrationTokens.js'
import userRouter from './routes/user.js'
import syncRouter from './routes/sync.js'
import integrationsRouter from './routes/integrations.js'
import podcastsRouter from './routes/podcasts.js'
import adminRouter from './routes/admin.js'
import feedbackRouter from './routes/feedback.js'
import seedRouter from './routes/seed.js'
import { createNewsRouter } from './routes/news.js'
import { createNewsService } from './services/news.js'
import db from './db/init.js'
import { startNeteasePodcastSyncJob } from './services/podcasts.js'
import { pruneSyncStorage } from './sync/store.js'

const PROD_ORIGINS = [
  'https://app.nestflow.art',
  'https://api.nestflow.art',
  'https://nestflow.art',
  'https://www.nestflow.art',
]
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5180',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5180',
]
// Tauri desktop webview origins. macOS/Linux use the custom `tauri://` scheme;
// Windows (WebView2) uses `http(s)://tauri.localhost`. Allowed in all envs
// because the packaged desktop app talks to the production API.
const DESKTOP_ORIGINS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
const ALLOWED_ORIGINS = [
  ...PROD_ORIGINS,
  ...DESKTOP_ORIGINS,
  ...(process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
  ...EXTRA_ORIGINS,
]

export const createApp = () => {
  const app = express()

  // Trust the first hop (Alibaba Cloud SLB) so that req.ip and X-Forwarded-For
  // reflect the real client IP rather than the internal load-balancer address.
  // Required for accurate geoip-lite lookups in services/region.js.
  app.set('trust proxy', 1)

  app.use(helmet({
    contentSecurityPolicy: false, // SPA is served separately; CSP belongs on the static host
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // server-to-server / curl
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
      return cb(new Error(`Origin not allowed by CORS: ${origin}`))
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // Desktop (Tauri) Google sign-in routes. MUST be registered before the
  // better-auth catch-all below, or they'd be swallowed by it.
  ensureDesktopAuthTable(db)
  ensureIntegrationTokenTable(db)
  registerDesktopAuthRoutes(app, db)

  const authHandler = toNodeHandler(auth)
  app.all('/api/auth/*', authHandler)
  app.all('/auth/*', (req, res) => {
    req.url = `/api${req.url}`
    authHandler(req, res)
  })
  app.use(express.json({ limit: '8mb' }))

  app.get('/', (req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    })
  })
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    })
  })

  app.use('/user', userRouter)
  app.use('/api/user', userRouter)
  app.use('/sync', syncRouter)
  app.use('/api/sync', syncRouter)
  app.use('/integrations', integrationsRouter)
  app.use('/api/integrations', integrationsRouter)
  app.use('/podcasts', podcastsRouter)
  app.use('/api/podcasts', podcastsRouter)
  const newsRouter = createNewsRouter({ service: createNewsService({ db }) })
  app.use('/news', newsRouter)
  app.use('/api/news', newsRouter)
  app.use('/admin', adminRouter)
  app.use('/api/admin', adminRouter)
  app.use('/feedback', feedbackRouter)
  app.use('/api/feedback', feedbackRouter)
  app.use('/seed', seedRouter)
  app.use('/api/seed', seedRouter)

  return app
}

const PORT = process.env.PORT || 3000
const app = createApp()
startNeteasePodcastSyncJob(db)
// Keep deletion tombstones long enough for lagging devices, then reclaim their
// rows and unreachable blobs without doing maintenance in a user request.
const syncCleanupTimer = setInterval(() => {
  try {
    pruneSyncStorage(db)
  } catch (error) {
    console.error('[sync] scheduled storage cleanup failed', error)
  }
}, 24 * 60 * 60 * 1000)
syncCleanupTimer.unref?.()

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
