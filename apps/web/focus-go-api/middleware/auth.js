import db from '../db/init.js'
import { auth } from '../auth/betterAuth.js'
import { createRequireAuth } from './authPolicy.js'

export const requireAuth = createRequireAuth({ database: db, auth })
