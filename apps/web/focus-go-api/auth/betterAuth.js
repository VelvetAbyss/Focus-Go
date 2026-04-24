import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'
import db from '../db/init.js'

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5174'
const devSecret = 'focus-go-dev-better-auth-secret-change-me'
const TRUSTED_ORIGINS = [
  APP_BASE_URL,
  'https://app.nestflow.art',
  'https://nestflow.art',
  'https://www.nestflow.art',
  'http://localhost:5173',
  'http://localhost:5174',
]

const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
  : {}

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
