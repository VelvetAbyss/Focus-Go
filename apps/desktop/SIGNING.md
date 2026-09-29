# Signing, notarization & auto-update (Phases 6–8)

Everything is wired and validated: a local `tauri build` already produces a working
`.app`, `.dmg`, and a **signed** updater artifact.

Because `bundle.createUpdaterArtifacts` is `true`, **every** build signs the updater
artifact and therefore needs the updater key in the environment:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat apps/desktop/.tauri-keys/focusgo-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""   # generated with no password
npm run build:desktop   # from repo root
```

(macOS/Windows *code signing* is optional locally — without an Apple/Windows identity
the app is ad-hoc/unsigned but still runs on your machine.)

## 1. Updater keys (Phase 7) — DONE

A signing keypair lives at `apps/desktop/.tauri-keys/` (gitignored — never commit it):
- The public key is in `tauri.conf.json` → `plugins.updater.pubkey`.
- The private key is already uploaded to this repo's Actions secrets as
  `TAURI_SIGNING_PRIVATE_KEY`, with an empty `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
  Keep a copy in a password manager: losing it means no existing install can ever
  auto-update again, because the public key is baked into shipped binaries.

The update feed is `plugins.updater.endpoints` →
`https://github.com/VelvetAbyss/Focus-Go/releases/download/updater/latest.json`.

That is a **fixed tag**, not `releases/latest`. GitHub resolves `releases/latest`
only to a non-prerelease release, so while the project ships `-beta.N` prereleases
every build would be invisible to the updater. Instead the `updater-feed` job in
`desktop-release.yml` republishes each build's `latest.json` under the permanent
`updater` tag, which installed apps poll. Direct `releases/download/<tag>/<asset>`
URLs work for prereleases, so betas update normally.

Two consequences worth knowing:

- Versioned releases are published with `releaseDraft: false`. They have to be —
  `latest.json` links straight at their assets, and a draft release's assets are
  not downloadable. Review happens before the tag, not after.
- **The repository must be public**, or the feed and the installers both 404 for
  everyone but collaborators. There is no token in a shipped app to authenticate
  with.

## 2. macOS signing + notarization (Phase 6)

Requires an **Apple Developer ID Application** certificate.
- Export it as a `.p12`, base64-encode it, and add GitHub secrets:
  - `APPLE_CERTIFICATE` = `base64 -i cert.p12`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY` = e.g. `Developer ID Application: Your Co (TEAMID)`
- Notarization (app-specific password from appleid.apple.com):
  - `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID`
- Hardened-runtime entitlements are in `src-tauri/entitlements.plist` (JIT for WebKit).
- Output: universal `.dmg`/`.app` (arm64 + x64), notarized + stapled.

Local signed build: export the same vars and run `npm run build:desktop`.

## 3. Windows signing (Phase 6)

Tauri builds `.msi` + NSIS `.exe` on Windows. Signing options:
- **EV / OV Authenticode cert:** set `bundle.windows.certificateThumbprint` in
  `tauri.conf.json` (cert installed on the runner), or
- **Azure Trusted Signing / signtool:** add a `bundle.windows.signCommand`.
- An **EV cert** avoids the SmartScreen reputation warning.
Windows installers must be built on a Windows runner (the CI matrix does this).
Add `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD` secrets and a sign step if
using a `.pfx`. Until configured, Windows builds are unsigned (SmartScreen warning).

## 4. CI (Phase 8)

`.github/workflows/desktop-release.yml` builds the matrix (macOS universal + Windows)
on a `v*` tag via `tauri-apps/tauri-action`, signs/notarizes (when secrets are set),
creates a **draft** GitHub release with installers + `latest.json`, and the updater
plugin reads that `latest.json`. Flip `releaseDraft: false` when ready to auto-publish.

### Release checklist
1. Bump `version` in `tauri.conf.json` and keep `apps/desktop/package.json` in sync.
   The bundle targets are `app`, `dmg`, `nsis` — deliberately not `msi`, because WiX
   rejects prerelease versions like `0.1.0-beta.5`. Add `msi` back only if you also
   drop the prerelease suffix.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` → CI runs `npm run verify`, builds macOS
   (universal) and Windows, publishes the prerelease, then refreshes the `updater`
   feed tag. The release is published immediately, not as a draft, so review before
   tagging rather than after.
3. Verify auto-update: install the previous version, tag a higher one, relaunch and
   wait ~5s (App.tsx checks on a timer).
