import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import userRouter from './routes/user.js'
import syncRouter from './routes/sync.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: [
    'https://app.nestflow.art',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

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

app.use('/auth', authRouter)
app.use('/user', userRouter)
app.use('/sync', syncRouter)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
