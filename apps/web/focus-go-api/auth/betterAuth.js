import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import db from '../db/init.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env') })

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5174'

const isProd = process.env.NODE_ENV === 'production'
if (isProd && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('[auth] BETTER_AUTH_SECRET is required in production')
}
const devSecret = 'focus-go-dev-better-auth-secret-change-me'
if (!process.env.BETTER_AUTH_SECRET) {
  console.warn('[auth] BETTER_AUTH_SECRET not set — using dev-only fallback. DO NOT use in production.')
}
const TRUSTED_ORIGINS = [
  APP_BASE_URL,
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

const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
  : {}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('[auth] Google OAuth is disabled: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.')
}

export const auth = betterAuth({
  appName: 'Focus & Go',
  database: db,
  secret: process.env.BETTER_AUTH_SECRET || devSecret,
  baseURL: process.env.BETTER_AUTH_URL || `${API_BASE_URL}/api/auth`,
  basePath: '/api/auth',
  trustedOrigins: TRUSTED_ORIGINS,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: googleProvider,
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
})
