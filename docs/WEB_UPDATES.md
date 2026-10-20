# Web release updates

Production web builds publish `release.json` with the CI commit SHA and a matching
`focusgo-release` HTML meta tag. `VITE_RELEASE_SHA` (or `GITHUB_SHA`) identifies a
release; local production builds get a timestamp identifier. Desktop builds omit
this web coordinator and continue using their existing native update mechanism.

Visible, online tabs check every two minutes, and on focus or reconnection. The
manifest request uses `cache: no-store` and a unique query parameter. A different
release registers `/sw.js?v=<release>` with `updateViaCache: none`. The current tab
waits for that worker to take control before considering a reload.

Updates reload the current URL after 30 seconds without interaction, provided no
input/editor is focused, no IME composition is active, and no dialog or busy region
is present. Before reloading, the coordinator broadcasts a preparation event and
awaits local saves. The note editor flushes its last keystrokes synchronously; the
note page waits for its local save queue. Offline requests, unfinished/failed saves,
and resumed interaction defer the reload. A session guard prevents repeated
reloads to the same target release. Cookies and local databases are not cleared.

Features that debounce local edits should register `onPrepareAppUpdate` from
`src/shared/runtime/updateLifecycle.ts` and return their local-save promise. The
hook must not wait for cloud synchronization. The update coordinator waits at most
five seconds for preparation before retrying later.

Already-open pages from before this coordinator was introduced need a reload to
receive it. Normal releases after that are detected without manually clearing
cookies, browser storage, or service-worker caches.

## Verification

Build the web app, then run:

```sh
npm exec --workspace=@focus-go/web -- vitest run src/shared/runtime/webUpdates.test.ts
npm exec --workspace=@focus-go/web -- playwright test e2e/web-updates.pwa.ts --config playwright.offline.config.ts
```

The browser test serves two release variants from an isolated local origin. It
checks that editing delays activation of the new page and that an HttpOnly cookie,
a local draft, and an IndexedDB record survive. After deployment, also confirm the
public HTML marker and `release.json` match the deployed commit, and that the worker
is served without stale CDN caching.
