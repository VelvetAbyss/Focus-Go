import { APIError, createAuthMiddleware, addOAuthServerContext, getOAuthState } from 'better-auth/api'
import { POLICY_VERSION } from './policyManifest.js'

export const ensurePolicyConsentTable = db => db.exec(`CREATE TABLE IF NOT EXISTS policy_acceptances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL, privacy_version TEXT NOT NULL,
  locale TEXT NOT NULL, accepted_at INTEGER NOT NULL, source TEXT NOT NULL,
  UNIQUE(auth_user_id, terms_version, privacy_version)
)`)
export const validatePolicyConfirmation = value => {
  if (!value || value.termsAccepted !== true || value.privacyAcknowledged !== true || value.termsVersion !== POLICY_VERSION || value.privacyVersion !== POLICY_VERSION || !['en', 'zh'].includes(value.locale)) {
    throw new APIError('BAD_REQUEST', { code: 'POLICY_CONFIRMATION_REQUIRED', message: 'Please read and confirm the current Terms of Service and Privacy Notice.' })
  }
  return { termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale: value.locale, termsAccepted: true, privacyAcknowledged: true }
}
export const recordPolicyConfirmation = (db, userId, confirmation, source) => {
  const value = validatePolicyConfirmation(confirmation)
  // Append only: retries must not rewrite the original server timestamp or language.
  db.prepare('INSERT OR IGNORE INTO policy_acceptances(auth_user_id,terms_version,privacy_version,locale,accepted_at,source) VALUES(?,?,?,?,?,?)')
    .run(userId, value.termsVersion, value.privacyVersion, value.locale, Date.now(), source)
  return db.prepare('SELECT terms_version AS termsVersion,privacy_version AS privacyVersion,locale,accepted_at AS acceptedAt,source FROM policy_acceptances WHERE auth_user_id=? AND terms_version=? AND privacy_version=?').get(userId, POLICY_VERSION, POLICY_VERSION)
}
export const getPolicyStatus = (db, userId) => ({
  termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION,
  acceptance: db.prepare('SELECT terms_version AS termsVersion,privacy_version AS privacyVersion,locale,accepted_at AS acceptedAt,source FROM policy_acceptances WHERE auth_user_id=? AND terms_version=? AND privacy_version=?').get(userId, POLICY_VERSION, POLICY_VERSION) ?? null,
})

export const createPolicyAuthOptions = db => {
  ensurePolicyConsentTable(db)
  const confirmationFor = async ctx => {
    if (ctx?.context?.focusgoPolicyConfirmation) return ctx.context.focusgoPolicyConfirmation
    if (ctx?.path?.startsWith('/callback/')) return (await getOAuthState())?.serverContext?.focusgoPolicyConfirmation
    return null
  }
  return {
    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (ctx.path === '/sign-up/email') ctx.context.focusgoPolicyConfirmation = validatePolicyConfirmation(ctx.body?.policyAcceptance)
        if (ctx.path === '/sign-in/social' && ctx.body?.additionalData?.policyAcceptance) {
          const value = validatePolicyConfirmation(ctx.body.additionalData.policyAcceptance)
          ctx.context.focusgoPolicyConfirmation = value
          // BetterAuth seals this server context into its existing OAuth state.
          // Never read client additionalData as trusted callback confirmation.
          await addOAuthServerContext({ focusgoPolicyConfirmation: value })
        }
      }),
      after: createAuthMiddleware(async ctx => {
        if (ctx.path !== '/sign-in/social' && !ctx.path.startsWith('/callback/')) return
        const value = await confirmationFor(ctx), user = ctx.context.newSession?.user
        if (value && user) recordPolicyConfirmation(db, user.id, value, 'google-sign-in')
      }),
    },
    databaseHooks: { user: { create: {
      before: async (_user, ctx) => { validatePolicyConfirmation(await confirmationFor(ctx)) },
      after: async (user, ctx) => { recordPolicyConfirmation(db, user.id, await confirmationFor(ctx), ctx?.path === '/sign-up/email' ? 'email-registration' : 'google-registration') },
    } } },
  }
}
