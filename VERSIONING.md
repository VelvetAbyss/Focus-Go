# Focus&go Versioning

Focus&go uses one product version across the monorepo. Git tags are the release source of truth, and package versions mirror the tag without the leading `v`.

## Current Track

- Version format: `MAJOR.MINOR.PATCH[-prerelease.N]`
- Tag format: `vMAJOR.MINOR.PATCH[-prerelease.N]`
- Latest existing tag: `v0.1.0-beta.5`
- Next beta default: `v0.1.0-beta.6`

The project is still in the `0.x` phase. Treat `0.1.x` as the first public testing milestone, and reserve `1.0.0` for a stable core experience with clear data compatibility and reliable web/desktop release workflows.

## Version Plan

- `v0.1.0-beta.6+`: continue current beta fixes, small feature completion, installer/CI/release fixes, and blocking bug fixes.
- `v0.1.0-rc.1`: feature freeze candidate. Only blocking bugs, data safety fixes, install/startup issues, and sync issues should be accepted.
- `v0.1.0`: first stable public release. Requires `npm run verify`, web smoke validation, and downloadable unsigned desktop release assets.
- `v0.1.1`, `v0.1.2`: stable hotfixes only, including bug fixes, small UX fixes, copy fixes, and security dependency updates.
- `v0.2.0-beta.1`: next feature milestone for meaningful new functionality, information architecture changes, sync/membership/task expansion, or new release channels.
- `v1.0.0`: mature release after core modules are stable, data migrations are documented, and release/rollback documentation is complete.

## Update Rules

### MAJOR

- During `0.x`, do not advance to `1` unless the project is intentionally declaring a stable release.
- After `1.0.0`, increment `MAJOR` only for breaking changes to data structures, APIs, import/export formats, or sync protocols.

### MINOR

Increment `MINOR` for:

- New user-visible features.
- Product flow changes that do not break existing data.
- New major pages, modules, release channels, or substantial feature flags.

### PATCH

Increment `PATCH` for:

- Bug fixes.
- Visual fixes.
- Copy updates.
- Performance improvements.
- Small scoped refactors.

Patch releases must not change user expectations or require migration notes.

### Prereleases

- `beta.N` is for testing and early feedback. It may contain work that is not fully frozen. Increment the number on the same base version, for example `v0.2.0-beta.1` then `v0.2.0-beta.2`.
- `rc.N` is for release candidates. Do not add new features after the first `rc`; only fix issues that block stable release.
- Stable releases have no prerelease suffix, for example `v0.1.0`. Promote stable only from a verified `rc` or the final verified beta.

## Repository Rules

- Git tags are the release source of truth: `v0.1.0-beta.5`.
- `package.json` versions do not include `v`: `0.1.0-beta.5`.
- Keep these package versions aligned:
  - root `package.json`
  - `apps/web/package.json`
  - `packages/core/package.json`
  - `packages/db-contracts/package.json`
  - `apps/web/focus-go-api/package.json`
- Keep `package-lock.json` files aligned with the package versions.
- Internal data/schema versions are not product versions. Dexie, RxDB, backup metadata, and similar schema counters should only change when their own storage format changes.
- Release workflows continue to use the existing `v*` tag trigger. Since the Electron
  path was removed, `.github/workflows/desktop-release.yml` is the only one that fires.
- `apps/desktop/src-tauri/tauri.conf.json` carries its own `version` and must be bumped
  with the packages above, or the installers ship the previous version number.

## Release Checklist

1. Confirm the worktree is clean, or explicitly identify which changes belong to the release.
2. Update package versions and lockfiles.
3. Run `npm run verify`.
4. Create the release tag: `vX.Y.Z[-beta.N|-rc.N]`.
5. Push the tag to trigger the GitHub release workflow.
6. Mark `beta` and `rc` releases as prereleases. Stable releases should not be marked as prereleases.
7. Use `.github/release.yml` generated release notes, then add a short human summary covering additions, fixes, and known issues.
