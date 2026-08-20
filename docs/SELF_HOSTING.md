# Self-hosting and credentials

Focus & Go never needs a secret committed to Git. Copy the example files to
local `.env` files, or set the same values in your hosting provider's encrypted
environment-variable dashboard. Do not use `VITE_` variables for secrets: every
`VITE_*` value is included in the browser build.

## 1. Deploy the API

Copy `apps/web/focus-go-api/.env.example` to `apps/web/focus-go-api/.env` for a
local run. In production, configure these values in the API host instead.

| Variable | Required | Where to get it | Notes |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes, in production | Run `openssl rand -base64 32` | Keep this server-only. Rotating it signs users out. |
| `BETTER_AUTH_URL` | Yes | Your public API URL | Example: `https://api.example.com/api/auth`. |
| `API_BASE_URL` | Yes | Your public API URL | Example: `https://api.example.com`. |
| `APP_BASE_URL` | Yes | Your public Web URL | Used for authentication redirects. |
| `ALLOWED_ORIGINS` | Optional | Your permitted Web origins | Comma-separated CORS allow-list; do not use `*` for a public deployment. |
| `GOOGLE_CLIENT_ID` | Only for Google sign-in | [Google Cloud Console credentials](https://console.cloud.google.com/apis/credentials) | Add `https://your-api.example.com/api/auth/callback/google` as an authorized redirect URI. |
| `GOOGLE_CLIENT_SECRET` | Only for Google sign-in | Same Google OAuth client | Keep this server-only. Do not put it in the Web app. |
| `ADMIN_EMAILS` | Optional | Your own administrator email list | Comma-separated; this is configuration, not a secret. |
| `FREE_SYNC_QUOTA_BYTES`, `SYNC_PUSHES_PER_MINUTE`, `SYNC_PULLS_PER_MINUTE` | Optional | Your operational policy | Non-secret cloud-sync limits. |

If you do not configure Google credentials, passwordless/local use still works;
the API disables Google sign-in rather than exposing a placeholder key.

## 2. Deploy the Web app

Set only public build configuration in `apps/web/.env.local` or in the Web host:

```dotenv
VITE_API_BASE=https://your-api.example.com
VITE_SUPPORT_GITHUB_URL=https://github.com/sponsors/your-account
VITE_SUPPORT_PAYPAL_URL=https://www.paypal.com/paypalme/your-account
VITE_SUPPORT_ZPAY_URL=https://your-provider.example/support
```

The support URLs are optional, public links; they are not payment credentials and
do not grant product access.

## 3. Optional user integrations

End users add optional browser-compatible keys in **Settings → Integrations**.
They stay in that browser only and are deliberately excluded from Focus & Go
cloud sync and local backup exports.

| Integration | What it enables | Where the user gets a key |
| --- | --- | --- |
| TMDb | Movie and TV search in the Media card | [TMDb API settings](https://www.themoviedb.org/settings/api) — create an account and use the v3 API Key. |
| Twelve Data | Live stock-symbol search and quotes | [Twelve Data API keys](https://twelvedata.com/account/api-keys) — create an account and copy an API key. |

These are client-side integrations: the user’s browser sends the key directly to
the selected provider. Do not add a provider key to a public build or commit one
to this repository.

## 4. Optional release backups

`OSS_ACCESS_KEY_ID` and `OSS_ACCESS_KEY_SECRET` are only needed for the backup
scripts and GitHub Actions release/restore workflows. Create a least-privilege
credential in your storage provider’s IAM console (for Alibaba Cloud OSS, use
[RAM AccessKey management](https://ram.console.aliyun.com/manage/ak)), then add
it only to:

- a local untracked `.env` used by the backup script, or
- GitHub repository **Settings → Secrets and variables → Actions** as
  `OSS_ACCESS_KEY_ID` and `OSS_ACCESS_KEY_SECRET`.

Do not use personal root-account access keys. Restrict the key to the intended
bucket and prefix whenever the provider supports it.

The optional Web deployment workflow (`.github/workflows/deploy.yml`) uses the
following GitHub Actions settings. They are deployment-operator values, not
application settings and never belong in the browser:

| GitHub Actions setting | Purpose |
| --- | --- |
| `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET` | Least-privilege credential that uploads and reads the deploy archive. |
| `OSS_BUCKET`, `OSS_ENDPOINT` | Target storage location. These are configuration values but are supported as Actions Secrets for one consistent deployment setup. |
| `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER` | Access to the server that receives the deploy archive. Use a dedicated, restricted deploy account and SSH key. |
| `GITHUB_TOKEN` | Supplied automatically by GitHub Actions; do not create or paste a replacement token. |

Focus & Go's public Web/API release does not include desktop release workflows.
Desktop signing, notarization, and distribution credentials must remain in a
separate private repository if desktop distribution is resumed.

## 5. Before making a fork public

1. Rotate any credential that was ever present in a local `.env`, Git history,
   build artifact, Actions log, or deployment dashboard.
2. Search the full reachable history for credential files and generic secret
   patterns; remove leaked files with a history rewrite before publishing.
3. Add current values only to encrypted deployment settings or GitHub Actions
   Secrets, never to repository files.
4. Build from a clean clone and verify that no user integration works until its
   owner enters their own key in Settings.
