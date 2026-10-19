# Labs symbolic modules — Web V2

Rebuilt 2026-10-12 from the completed user interview. The three optional Labs modules keep independent routes and page themes. Dashboard widgets remain opt-in and use the shared Card and application theme tokens. Web is the shared source of truth; no desktop-specific behavior was added.

## Product flows

- **BaZi:** shared multi-person profiles; today-first four theme scores, explanation and personal action suggestions; four-pillar chart and natal interpretation (balance, personality, career, money and relationships); month/year/decade text reports with actual period boundaries.
- **Astrology:** two explicit sources, twelve Sun-sign overviews without a birth profile and personal charts. Both have day/week/month/year reports. Only daily reports carry scores. Source/sign selection is account-scoped on the current browser and shared by page and widget. Personal charts share BaZi birth profiles.
- **Tarot:** daily card and question readings. Choose a theme, write the question and its focus, review the recommended daily/three-card/two-option/relationship spread, shuffle all 78 cards, manually select backs and reveal in order. Save the original bilingual report and later reflections. Unfinished question sessions can be resumed from history.
- **Widgets:** today’s report from the same content functions and account clock; Tarot never draws during render and uses the same saved daily reading. Removing a module preserves data and unmounts its widget content.
- Interpretation is deterministic rule composition. `InterpretationProvider` reserves a future interface; this version makes no AI service calls.

## Calculation and content contracts

Supported birth and selected forecast dates: 1901–2100 (including converted lunar dates). Civil input uses an IANA time zone or explicit offset. Invalid lunar dates, DST gaps/repeated hours and skipped civil dates are rejected. Repeated hours require a verified explicit offset. The city picker contains 23 approximate city-center presets, with manual coordinates and zone correction.

**BaZi:** `lunar-typescript@1.8.6`; birth instants converted to fixed UTC+08, Li Chun year and Jie month boundaries, explicit midnight/23:00 day boundary, library-compatible late-Zi hour rules, Yun sect 2 and traditional direction parameter. Missing time/direction does not invent luck cycles. Daily page/widget use the same Ganzhi-day key. Actual Yun transition instants segment month/year backgrounds.

Balance interpretation considers seasonal weights, roots, exposed/hidden stems and ten-god roles. The published numeric weights are product rules, not a universal traditional formula. It implements a limited ordinary support/restraint assessment, not complete pattern classification, climate adjustment, following/special structures or daily hidden-stem command. Special/uncertain structures do not force a useful-element conclusion. Branch combinations/clashes are conditional relationships, not automatic lucky/unlucky events or element conversion.

**Astrology:** `astronomy-engine@2.1.19`, geocentric apparent positions, tropical zodiac and equal houses; MC remains independently calculated. At absolute latitude ≥66° axes/houses are unavailable. Unknown birth time uses day-wide sampling for stable natal themes and does not invent axes/houses or exact personal transits. Period reports aggregate samples across the actual calendar interval in the account time zone. Transit windows are sampled intervals, not root-solved exact ingress/egress times. Sun-sign reports use whole-sign solar houses from actual sky positions, not an invented midpoint natal longitude.

**Tarot:** 78 unique cards, original Chinese upright/reversed editorial meanings and original symbolic SVG scenes; English semantic reference adapted from the MIT Tarotoo dataset. Topic, intention, position, repeated themes, suit balance and pacing feed synthesis. Free-form questions use only limited focus words, not unrestricted language understanding. Cryptographic rejection sampling + Fisher–Yates prevents modulo bias and repeats within a spread. Optional reversals are independent 50% draws. V2 reports freeze both languages; V1 records retain their original concise meanings without a retroactively invented full report.

Scores express relative tendencies within the specified rules, not probabilities or empirically established predictions. Daily themes are overall, career, money and relationships. Missing necessary evidence yields null rather than a random or default score. Computed facts, interpretive evidence, method version and limits are separately exposed.

## Persistence, synchronization and privacy

`local_symbolic` remains a dedicated Dexie table keyed by `[ownerId+id]`, separate from the generic sync entity list. Shared profiles have stable IDs and immutable revisions. Owner switches immediately mask previous-owner records and clock snapshots. V48 preserves the V46 task trash and V47 durable sync queue. Account cleanup reopens the connection closed by the account menu, removes only the outgoing account partition and clears its astrology view preference. Account/session transitions invalidate in-flight responses and resume account-cleanup pauses; explicit app resets stay paused until their matching recovery or reload. Legacy migration completes before subscribing to read-only live queries; a fresh installation never performs a write inside a live-query transaction.

Authenticated accounts use a dedicated `/symbolic/pull`, `/symbolic/push` and `/symbolic/daily-claim` channel; API ownership is derived from authenticated business user IDs. Cursor/revision CAS, idempotent operation IDs, frozen pending requests, retained conflicts and reset generations prevent silent overwrites and stale replay. The account’s fixed calendar zone and server clock define the daily card. Global cloud-sync preference is respected.

With cloud sync enabled, a daily selection is server-confirmed before reveal. Simultaneous devices receive the same accepted daily reading; another local draw is retained as history during reconciliation. Guests/cloud-off users can work locally, with a visible local-only status. Logging in does not silently transfer another owner’s guest data. Backend endpoints must be deployed before cross-device sync can operate.

Card identity, question/context and original reports are immutable; reveal state is monotonic. Reflections use compare-and-swap checks. Conflicting unfinished sessions can fork into retained separate sessions. Account-scoped astrology view preferences are excluded from backups and preserved during restore. Full manual backups include only the current owner’s valid records, exclude sync metadata, merge in a Dexie transaction and sanitize remote ACK metadata. Restored daily readings are archived rather than bypassing today’s server claim.

Dedicated records count toward the existing cloud quota. Account reset/deletion purges their server rows and invalidates stale generations; deletion previews include their record count. Auth/bootstrap files are untouched.

## Scope and remaining limits

This version implements the interview scope. It does not add synastry, electional dates, multiple selectable schools/house systems, extra spreads/clarifiers, public sharing, PDF export, paid reports, reminders, task/calendar links or runtime AI.

Content has computational and workflow regression coverage, not independent expert certification. Bazi special-pattern interpretation and exact astrological transit timing remain the explicit algorithm limits above. Account sync has isolated API/concurrency tests; deployment and a real signed-in two-device smoke test remain separate release checks.

## Sources and verification

- [lunar-typescript](https://github.com/6tail/lunar-typescript) — MIT.
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — MIT.
- [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill) — ISC, 0.5.1; JSBI 4.3.0 — Apache-2.0.
- [Tarotoo Tarot Dataset](https://github.com/Tarotoo-com/tarotoo-tarot-dataset) — MIT. See `../tarot/THIRD_PARTY_NOTICES.md` for provenance.
- Distributed licenses: `apps/web/public/licenses/symbolic-modules.txt`.
- Integration on main `4fcc3cb` (2026-10-19): Web full suite 1,076 passed / 4 skipped; final account compatibility regression 30 passed; API 109 passed; final lint, TypeScript, production build and diff checks passed. Browser acceptance covered Labs installation, shared profile, daily draw and page/widget consistency, including 390px widgets. The local-only receipt is `docs/releases/labs-v1-2026-10-19.md`; screenshots and logs are under the local `artifacts/labs-submit-2026-10-19/` directory. No deployment or real two-device acceptance is claimed.
- Earlier domain samples and browser evidence remain in the source snapshot `f16aa8862df806a4f37c66d592998d343e9b11ef`, under `artifacts/labs-rebuild-2026-10-12/`, `artifacts/labs-rebuild-v2-2026-10-12/` and `artifacts/labs-web-v1-2026-10-10/`. Those historical results are not deployment evidence.
