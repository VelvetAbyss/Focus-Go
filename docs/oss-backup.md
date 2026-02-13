# OSS Release Backup

This project stores immutable release artifacts in Alibaba Cloud OSS under this structure:

```text
releases/{app}/{yyyy-mm-dd}/{git-sha}/...
```

Example:

```text
oss://my-bucket/releases/focus-go/2026-02-13/abc123def456/
```

## What gets backed up

By default, the release bundle includes:

- `dist/`
- `public/`
- `manifest.json` with file hashes and metadata

Override include paths with `RELEASE_INCLUDE_PATHS` (comma-separated).

## Required CI secrets

Configure in GitHub repository secrets:

- `OSS_BUCKET`
- `OSS_ENDPOINT`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`

Use a dedicated CI credential with least privilege to write only:

```text
oss://{bucket}/releases/focus-go/*
```

## NPM commands

- `npm run release:bundle` builds a local versioned release bundle and manifest.
- `npm run release:oss:upload` uploads the bundle to OSS and updates `LATEST.json`.
- `npm run release:oss:verify` downloads the uploaded release and verifies SHA256.
- `npm run release:oss:publish` runs bundle + upload + verify in sequence.
- `npm run release:oss:latest` resolves `RELEASE_DATE` and `GIT_SHA` from `LATEST.json`.
- `npm run release:oss:restore` restores a specific release locally.

## Workflows

- `.github/workflows/oss-release-backup.yml`
  - Triggers on `main` pushes and manual dispatch.
  - Builds app, bundles assets, uploads to OSS, verifies integrity.

- `.github/workflows/oss-restore-drill.yml`
  - Runs monthly and on manual dispatch.
  - Restores latest release from OSS and validates key files.

## Local usage

```bash
cp .env.example .env.local
# set OSS variables
npm run build
source .env.local
npm run release:oss:publish
```

## Lifecycle policy recommendation (set in OSS console)

Apply an OSS lifecycle rule for `releases/focus-go/`:

1. Standard storage for first 30 days.
2. Transition to IA around day 90.
3. Archive or delete after day 180.

The lifecycle rule is configured in OSS Console and is not managed by repository code.
