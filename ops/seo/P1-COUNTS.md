# Anonymous segmented counts

Prepared on codex/seo-p1-anonymous-counts after P2 release a83d9d8. This source is not a production release.

The owner selected self-hosted anonymous segmented counts on 2026-10-22. GitHub options Umami (https://github.com/umami-software/umami) and Plausible (https://github.com/plausible/analytics) were reviewed. The three fixed counters reuse existing Express/SQLite; no dependency or additional database service is added.

## Events and interpretation

- website_view: one initial browser load of one of the twelve public website URLs.
- app_open: a website click that opens the application's root entry, excluding historical-policy links.
- first_success: the first successful task save or positive-duration focus completion observed after this counter is installed in a browser profile. A boolean stored on the application origin deduplicates this; it is not an ID and is not sent. Existing users can contribute. Clearing storage can count again; browser profiles without Web Locks may race across tabs. This is not new-user acquisition or a joined conversion funnel.

Payload keys are exactly event, page, language. Website paths come from a fixed twelve-route allowlist; app use sends only page=app. No cookies, credentials, user/account/task/session IDs, free text, full URL, query or referrer are sent by the client. Fetch uses credentials=omit, referrerPolicy=no-referrer and a three-second timeout. Failed requests never block local saves. A later actual success may retry the first-use count if the previous attempt failed; no private outbox is created.

Counts default on with a separate bilingual disclosure and an off switch. Choices apply to the current origin; they are not account preferences and do not propagate between website and app. DNT/GPC override the choice. Disabled/unavailable storage fails closed; an in-page opt-out stays effective if writing preferences fails. These controls govern this self-hosted counter; existing Cloudflare/infrastructure processing remains separate.

## Storage, access and limits

POST /api/public-counts accepts only the two official origins, JSON up to 512 bytes, fixed events and languages. Credential-bearing requests, query parameters and unknown fields are rejected. A global 600/minute budget bounds abuse without per-IP or session identifiers. The endpoint is public and counts can be spoofed; they are best-effort events, not verified human visits.

The anonymous_daily_counts table has only day,event,page,language,count; the primary key merges each UTC daily bucket. Expired rows are pruned on the first write each day and by existing daily backend maintenance; maximum reporting window is 90 days. This table does not change existing server/CDN access-log behavior.

GET /api/admin/anonymous-counts?days=28 returns the aggregate rows behind the existing admin guard; no new public reporting surface. Start the baseline at release time and annotate acceptance/owner traffic instead of calling all launch counts organic users. Do not infer AI referrals from these anonymous counts: AI answers, referrer reports, GSC and actual use remain separate evidence.

## Acceptance

Run npm run verify; node --test apps/web/focus-go-api/routes/anonymousCounts.test.js; web Vitest anonymousCounts, repoSuccessCounts and existing tasksRepo tests. Check static bilingual disclosure and switch, no requests on localhost/disabled/privacy signals, no content or IDs in payload, successful writes only, aggregation/retention/limits, and unauthenticated admin access denied. After deployment verify the exact SHA, HTTP contracts, twelve-page static answer parity, opt-out and actual aggregate reporting. Record synthetic launch checks separately.

The existing legal paragraphs and policy version remain verbatim; the separate disclosure explains the newly introduced optional counts and gives controls. Protected auth/bootstrap files and desktop platform code are untouched.
