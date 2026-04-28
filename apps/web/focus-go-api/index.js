import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { toNodeHandler } from 'better-auth/node'
import { auth } from './auth/betterAuth.js'
import userRouter from './routes/user.js'
import syncRouter from './routes/sync.js'
import paymentsRouter from './routes/payments.js'
import membershipRouter from './routes/membership.js'
import podcastsRouter from './routes/podcasts.js'
import adminRouter from './routes/admin.js'
import { createNewsRouter } from './routes/news.js'
import { createNewsService } from './services/news.js'
import db from './db/init.js'
import { startNeteasePodcastSyncJob } from './services/podcasts.js'

const ALLOWED_ORIGINS = [
  'https://app.nestflow.art',
  'http://app.nestflow.art',
  'https://api.nestflow.art',
  'http://api.nestflow.art',
  'https://nestflow.art',
  'http://nestflow.art',
  'https://www.nestflow.art',
  'http://www.nestflow.art',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]

export const createApp = () => {
  const app = express()

  app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  const authHandler = toNodeHandler(auth)
  app.all('/api/auth/*', authHandler)
  app.all('/auth/*', (req, res) => {
    req.url = `/api${req.url}`
    authHandler(req, res)
  })
  app.use(express.json({ limit: '10mb' }))

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
  app.use('/payments', paymentsRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/membership', membershipRouter)
  app.use('/api/membership', membershipRouter)
  app.use('/podcasts', podcastsRouter)
  app.use('/api/podcasts', podcastsRouter)
  const newsRouter = createNewsRouter({ service: createNewsService({ db }) })
  app.use('/news', newsRouter)
  app.use('/api/news', newsRouter)
  app.use('/admin', adminRouter)
  app.use('/api/admin', adminRouter)

  return app
}

const PORT = process.env.PORT || 3000
const app = createApp()
startNeteasePodcastSyncJob(db)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
