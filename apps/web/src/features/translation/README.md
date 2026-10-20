# Translation

Translation is a free, opt-in Labs feature. Install it in Labs to enable the
sidebar entry and `/translation`. Add its Dashboard card separately from Manage
widgets; it starts hidden. Removing the feature retains downloaded language packs.

The page and Dashboard card share the same editor, providers and offline engine.
Source text and results stay in component memory. Navigating away discards them.
Only language/mode choices and an online quota-stop date are saved in localStorage.

## Online

MyMemory's anonymous GET endpoint receives the text after an explicit Translate
action. No account, email, key, paid fallback or automatic retry is used. The
provider retains submitted text; choose offline for sensitive content. Its
anonymous service has a 5,000-character daily quota and may be unavailable. A
quota response stops further chunks and remembers the stop for the UTC day.
HTTP cache storage is disabled for online requests.

## Offline

The user explicitly downloads each required direction (about 112–120 MB per pack)
and a shared local WASM runtime. Supported languages: Chinese, English, German,
French and Spanish. Some pairs pivot through English. CacheStorage holds fixed
model revisions from `models.json`; clearing site storage removes packs. Model
weights are not shipped in Git or the app shell.

Each translation creates a module Worker. Inference fetches models only from its
cache and loads the cached runtime through local Blob URLs. Cancellation terminates
the Worker. Downloads and inference never silently fall back to an online service.

Inputs are limited to 20,000 characters, split into sentences, and retain paragraph
separators. Auto-detection is explicitly limited to Chinese/English. Business
expressions are fixed bilingual templates plus optional local English style rules.

See [ATTRIBUTION.md](./ATTRIBUTION.md) for model/runtime authors, revisions and
licenses. Real offline samples cover English/Chinese/German and pivot translation;
French/Spanish have not received an exhaustive quality evaluation. Signed desktop
packages require their own runtime acceptance after a desktop release.

## Verification

Run `npm run test --workspace @focus-go/web -- src/features/translation
src/features/labs src/features/dashboard` and `npm run verify` from the repository
root. The release is also checked through the browser for Labs installation,
route/sidebar access, manual Dashboard addition, offline reload/inference, removal
and restoration with language packs retained.
