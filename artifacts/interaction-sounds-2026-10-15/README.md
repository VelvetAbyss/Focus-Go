# Interaction sounds verification

Local preview: http://127.0.0.1:5187/workspace/settings#sounds

See verification.json for results and limits. Browser reports observe actual AudioBufferSourceNode.start calls, not a fake audio backend. Settings screenshots cover desktop and 390px layouts. The 2 skipped tests predate this change in TaskDrawer.test.tsx. Build retains the existing large-chunk warning. All three hashed WAV assets are present in the generated service-worker precache.

Implementation and regeneration: ../../apps/web/src/shared/sound/README.md

## Ordinary interaction extension

The `ordinary-*` logs supersede the earlier checks for this extension: 9 test files / 72 tests passed, lint passed, TypeScript and production web build passed (existing large-chunk warning remains). No deployment or packaged desktop test was performed.

`ordinary-browser.json` retains the raw attempts and the latest result for each scenario: all 26 latest checks passed. They cover shared settings tabs, task view/status tabs, navigation, disclosure, selectors, switches, repeat selections and master mute. Actual Web Audio source starts record a gain of 0.55 for routine cues. Initial cold audio readiness and expired test selectors were investigated; valid selector reruns supersede those attempts. A deferred-resume regression test now verifies the first cue waits for audio activation.

`ordinary-browser-cold-start.json` records a fresh document after the fix: initialization was silent, the first tab change played once, and the second tab change played once. The test uses a full page load rather than a hash-only navigation to avoid reinstalling the probe on the same document.

## Approved warm wood V2 integration

The user approved the wood expression A/B candidate on 2026-10-15. The product wood WAV is byte-identical to the approved raw sprite (`05b0302cff57a830e88ed52fbc45bf7ae79dd2cd505d0b64c9b0f4b9a960b7ae`). Grain, soft, and their original sprite manifest retain their previous hashes. See `wood-v2-provenance.json` and `wood-v2-baseline-hashes.json`.

Wood now uses its own offsets/durations and six shuffled tap variations without immediate repeats across bag boundaries. Default wood, volume, ordinary-feedback gain, and existing interaction bindings are retained. The generator reconstructs the quantized V1 reference in memory before normalizing V2; the standalone study archives V1 separately so its A/B remains reproducible after integration.

Verification: 9 related test files / 76 tests passed; lint, TypeScript, production web build, and `git diff --check` passed. The build retains its existing large-chunk warning. `wood-v2-production-assets.json` confirms all three built WAVs equal their source files and appear in service-worker precache. `wood-v2-clip-validation.json` checks all 48 slices.

`wood-v2-browser.json` observes 39 preview source starts and natural endings, with correct theme-specific offsets and full durations. Eighteen wood taps use all six variants equally and never repeat immediately. The latest actual pointer switches of both settings tabs each play once at 0.55 voice gain. Probe limitations are retained: programmatic `HTMLElement.click` did not switch Radix tabs; the first actual appearance-tab switch captured no sound, while subsequent experience/appearance switches passed. Its first omission was not instrumented; the player intentionally discards cues delayed over 300 ms, so this run does not establish the exact cause.

At the time of this validation, integration was local only; no commit, push, deployment, or packaged desktop verification had been performed.

## Sidebar global interaction-sound switch

The sound switch sits above Settings in the fixed system section. It reuses the sidebar item spacing, typography, rounded corners, colors, hover and focus states. Expanded desktop shows a label and small switch track; collapsed desktop shows the speaker icon. Mobile follows the existing navigation grid without the extra track. It is a native keyboard-operable button with `role="switch"` and a stable accessible name, and is excluded from the active-route indicator.

It subscribes to the existing sound preference store, so the sidebar and settings panel update immediately in both directions. Muting stops active interaction voices without playing an extra cue; enabling uses the existing quiet acknowledgement. Theme and volume are preserved. Ambient audio keeps its existing separate controls.

Validation: 21 existing player/control tests passed, lint and the TypeScript/production web build passed. `sidebar-toggle-browser.json` records six actual audio/synchronization checks. Space toggles off, Enter toggles on, and mute survives reload. `sidebar-toggle-layout-final.json` validates stable expanded/collapsed layouts at 1440px and 390px, equal styling to an unselected system navigation item, and no horizontal viewport overflow. Chinese/English and dark/light screenshots were visually reviewed. The earlier `sidebar-toggle-layout.json` captures transition frames and compares weight against the selected Settings item; final measurements supersede it.

These records describe local pre-release verification; production deployment is verified separately by the release workflow.
