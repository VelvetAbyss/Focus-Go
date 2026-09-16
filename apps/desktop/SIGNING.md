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

## 1. Updater keys (Phase 7) — DONE, one action left

A signing keypair was generated at `apps/desktop/.tauri-keys/` (gitignored):
- Public key is already in `tauri.conf.json` → `plugins.updater.pubkey`.
- **Move the private key out of the repo** into a password manager / CI secret, then
  delete the local copy. Add to GitHub secrets:
  - `TAURI_SIGNING_PRIVATE_KEY` = contents of `.tauri-keys/focusgo-updater.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = `` (empty — generated with no password)

Set the real update feed URL in `tauri.conf.json` → `plugins.updater.endpoints`
(replace `REPLACE_OWNER/REPLACE_REPO`). With the CI below it points at the GitHub
release's `latest.json`. To use your existing OSS infra instead, host `latest.json`
there and point the endpoint at it.

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
1. Add all secrets above to the GitHub repo.
2. Set `plugins.updater.endpoints` to your real `REPLACE_OWNER/REPLACE_REPO`.
3. Bump `version` in `tauri.conf.json` (and keep `apps/desktop/package.json` in sync).
   NOTE: Windows MSI needs a plain `major.minor.patch` — drop any `-beta.N` suffix for
   the bundle version or the MSI build will fail.
4. `git tag v0.1.0 && git push --tags` → CI builds, signs, publishes the draft release.
5. Verify auto-update: install the prior version, publish a higher one, relaunch.
