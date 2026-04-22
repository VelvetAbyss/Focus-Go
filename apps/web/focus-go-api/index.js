import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import userRouter from './routes/user.js'
import syncRouter from './routes/sync.js'
import paymentsRouter from './routes/payments.js'
import podcastsRouter from './routes/podcasts.js'
import adminRouter from './routes/admin.js'
import db from './db/init.js'
import { startNeteasePodcastSyncJob } from './services/podcasts.js'

export const createApp = () => {
  const app = express()

  app.use(cors({
    origin: [
      'https://app.nestflow.art',
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
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

  app.use('/auth', authRouter)
  app.use('/api/auth', authRouter)
  app.use('/user', userRouter)
  app.use('/api/user', userRouter)
  app.use('/sync', syncRouter)
  app.use('/api/sync', syncRouter)
  app.use('/payments', paymentsRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/podcasts', podcastsRouter)
  app.use('/api/podcasts', podcastsRouter)
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
