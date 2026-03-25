import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import userRouter from './routes/user.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/user', userRouter)

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
