# Security remediation rollout requirements

This working-tree change addresses the 2026-10-03 scan. It has not been deployed.

## Finding coverage

| CSV row | Local remediation |
| --- | --- |
| 1, 3, 15 | Verified identity required for legacy binding/admin authority; inactive accounts denied on protected requests. |
| 2, 16 | Replace downloaded ossutil execution with signed-package rclone; scope OSS credentials to storage steps and subprocess environments. |
| 4, 14 | Pin all workflow Actions to full commits, scope signing secrets, replace staging SSH Action, and require trusted SSH host keys. |
| 5, 17 | Tenant-scoped immutable blobs, actual retained-byte/record quota, orphan/tombstone accounting, transactional rollback and one-time ownership migration. |
| 6 | Rate-limit feedback using the configured trusted proxy identity, with bounded limiter storage. |
| 7 | Revoke the exact bearer session at server sign-out. |
| 8 | Validate release pointer identity, enforce restore-root containment and reject restore-path symlinks before removal. |
| 9 | Canonicalize mapped IPv6, validate every redirect and pin each network connection to its validated DNS address. |
| 10 | Reject password deployment before installation/build; require key authentication and trusted host keys. |
| 11 | Bound podcast request rate, concurrent streams, bytes and duration; propagate cancellation and validate redirects. |
| 12 | Bind desktop callbacks to pending state/PKCE; guard local account ownership and scope replication checkpoints by account. |
| 13 | Already removed in the current checkout before this repair; no additional implementation. |
| 18 | Escape imported fields at PDF HTML output and normalize numeric trip fields during migration. |

These are local code changes for 17 applicable findings, not a production remediation claim. Conditional findings remain conditional on the deployment configuration described below.

## Deployment prerequisites

- CI requires `SSH_KNOWN_HOSTS`, containing the production/staging SSH host keys verified through an independent trusted channel. Missing or mismatched keys fail closed. Do not populate this from an unauthenticated `ssh-keyscan` during deployment.
- Direct deployment requires `SSH_KEY_PATH` and `SSH_KNOWN_HOSTS_FILE`. Password deployment is disabled before dependency installation or build. Replace any existing password-based action configuration locally; never paste its password into logs or chat.
- OSS jobs install distribution-signed rclone packages instead of executing a downloaded ossutil binary. Local OSS operations now require rclone. Storage credentials are supplied only to the specific upload/download steps, through subprocess environment variables.
- Action references are pinned to the complete commits returned by their upstream tag refs during remediation. Updating a pin requires reviewing the upstream change.

## Authentication compatibility

- Unverified email/password signup remains usable for a new account. It cannot automatically claim an existing legacy account or receive email-allowlisted administrator authority.
- Legacy migration and admin access require a verified identity. Google verified identities remain supported. The existing password flow has no configured verification sender; implement/configure that deliberately before relying on email/password for legacy migration or admin access. Do not mark a claimed email verified based only on its registration.
- Historical account bindings that may already have been compromised are not automatically undone; review them against trusted account evidence before production rollout.
- Suspended/deletion-pending business users are denied at every protected request. Unsuspension restores access; this change does not delete account data.

## Synchronization migration

- New blobs are scoped by `(user_id, hash)`, counted by actual retained base64/metadata bytes plus a conservative record allowance, and immutable in content within an account. Empty files also consume quota.
- A one-time transaction copies legacy blobs only to the users whose existing documents reference them. It preserves the legacy table, and never performs a global fallback during a later request/restart.
- Back up the database before rollout. An attachment already overwritten before this migration cannot be reconstructed from this migration; use trusted backups if an incident is established. Pre-existing malicious references need a separate historical review.
- Tombstoned payloads and orphan uploads consume quota until normal cleanup. Owners with previously understated usage may now exceed quota legitimately.

## Desktop compatibility

- Client and API changes for desktop state/PKCE must roll out together. Old desktop callbacks without a binding are rejected.
- Pending login lives in sessionStorage with a ten-minute lifetime. Closing the app during login requires starting login again.
- Account switches require successful local-data reset. Account ownership hints are protected from backup import; RxDB checkpoints use separate account namespaces. Legacy RxDB cache files are retained but no longer used as the new namespace.
- Bearer sign-out explicitly revokes the exact server session. Offline exit can still only clear the local token; server revocation requires a successful request.

## Verification boundary

Local verification on 2026-10-04:

- API: 54/54 tests passed using the API directory's Node 22 runtime (matching the installed SQLite native module).
- Web: 122 test files passed, 545 tests passed and 4 skipped, with `vitest run --maxWorkers=2`; lint and production build passed.
- The preceding full web run had one intermittent existing NotePage tag-filter failure. Its isolated 17-test rerun and the subsequent complete reduced-concurrency run passed; no unrelated NotePage implementation was changed.
- OSS security tests: 2/2 passed. Workflow YAML/full-commit pin checks, shell/Node syntax checks and `git diff --check` passed.
- Evidence logs are retained locally in `.artifacts/security-remediation/`. No commit, push or deployment was performed.

Local regression tests and static workflow/shell checks do not prove production secrets, host keys, API version, CSP, native keychain/deep-link integration, or OSS access. Production rollout and end-to-end acceptance remain separate steps.

Feedback/audio IP limits use Express's configured one-hop proxy model. Production must restrict direct API access or configure the actual trusted proxy addresses; a client-controlled forwarding header is not an independent identity proof.
