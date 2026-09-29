# Active remote branch integration — 2026-09-29

The existing production `main` is the baseline. These remote branches have
unrelated Git roots after the repository snapshot rewrite. Their heads were
reviewed for product behavior; older code is not copied over current
implementations solely to make Git report a merge.

| Remote branch | Head reviewed | Disposition |
| --- | --- | --- |
| `chore/architecture-cleanup` | `1c85061` | Integrated desktop source and release workflow, Obsidian plugin, storage mode, sync and task improvements; resolved conflicts against current web and API code. |
| `feat/paper-ink-ux-2026-09` | `22dde37` | The paper and ink implementation was transplanted as `7ee7e59`; the later agent guide edit is included in this integration. |
| `claude/condescending-raman` | `b4ded2f` | Diary font preferences and editor presentation, plus note heading controls, are already in the current web tree. |
| `claude/jovial-antonelli-5ae91d` | `5e8b097` | Current web uses `cmdk`, `chrono-node`, `ical.js`, and virtualized task lists; no older implementation copied. |
| `codex/oss-public-release-clean` | `ad1461f` | Current product retains the free public release path and personal API key settings; membership navigation remains removed. |
| `feat/region-payment-routing` | `6bdb0d5` | Route loading and news skeleton accessibility are present. Regional payment routing targeted the retired membership flow, so it is not restored. |
| `polish/error-boundary-404-meta` | `92e60e0` | Current app has error boundaries and a localized 404. Missing social meta tags and smooth page scrolling were transplanted into the current web shell. |
| `security/auth-headers-ssrf-token-storage` | `57241a1` | Current app has in-memory access tokens, API helmet/CORS hardening, podcast host checks, and sanitized note PDF HTML. |

Release verification must include web lint/build/tests, API tests, core tests,
desktop typecheck and Rust check, Obsidian plugin tests, and a browser smoke
test. Production deployment is gated on the successful main-branch Verify
workflow. The API becomes healthy before the new web release is exposed.
