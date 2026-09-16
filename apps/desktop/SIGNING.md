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
`https://github.com/VelvetAbyss/Focus-Go/releases/latest/download/latest.json`.

> **Auto-update is inert while releases are prereleases.** GitHub's `releases/latest`
> resolves only to the newest *non-prerelease, non-draft* release, so while
> `desktop-release.yml` publishes drafts with `prerelease: true`, that URL 404s and
> `checkForUpdates()` quietly returns false. This is harmless — the app just never
> finds an update. It starts working the first time you publish a release with
> `prerelease: false` (set `releaseDraft: false` / `prerelease: false` in the
> workflow, or flip the flags on the release in the GitHub UI).

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
   (universal) and Windows, and opens a **draft prerelease**.
3. Review the draft on GitHub, then publish it.
4. To make auto-update live, publish a release that is not a prerelease (see the note
   in section 1), then verify: install the older version, publish a higher one, relaunch.
