---
name: focus-go-project-router
description: Use when working on Focus&go product, UI, interaction, feature, page-structure, state-flow, or data-logic requests that should hit the right files quickly instead of searching the whole repo.
---

# Focus&go Project Router

## Overview

This skill is the default router for Focus&go changes. It trades broad repo search for a small, maintained project index so the first response can jump to the most likely files with low token cost.

Use it for Focus&go requests that touch product behavior, UI, interaction, routing, state flow, persistence, contracts, or feature wiring.

## Core Rules

1. Start with `references/routing-dictionary.md` and map the request to one or more feature domains.
2. Read only the mapped domain sections in `references/feature-map.md`.
3. Check `references/change-hotspots.md` only if the request looks cross-cutting or the first candidates are insufficient.
4. Do not default to full-repo search. Expand only after opening the top candidates and finding a real gap.
5. If the index disagrees with the code, trust the code and update the index after the task if the change is large enough.

## Output Protocol

Always answer in this order before implementation details:

1. Most likely change files
2. Why these files were chosen
3. Whether more reading is needed
4. Implementation suggestion

Keep the first pass narrow. Prefer 3-5 files over long lists.

## Routing Workflow

### Step 1: Match the request

Use `references/routing-dictionary.md` to classify:

- feature domain: dashboard, tasks, focus, diary, calendar, rss, weather, spend, notes, labs
- change bias: UI, interaction, data, routing, persistence

If the request matches multiple domains, keep the primary domain first and add only the most likely bridge domain.

### Step 2: Read the minimum path

For the matched domain, open only:

1. route or page entry
2. primary UI entry
3. repository or runtime
4. contract/schema only when data shape or persistence is involved

Do not read all files in the domain up front.

### Step 3: Promote hotspots only when needed

Use `references/change-hotspots.md` when the request involves:

- sidebar or route entry changes
- widget visibility or dashboard registration
- shared preferences, theme, or i18n
- labs gating or premium access
- repo/contract alignment

### Step 4: Expand carefully

Expand search only when:

- the top candidates do not contain the behavior
- the request introduces a new cross-feature dependency
- the request clearly touches desktop or release flows outside this skill's first-pass coverage

When expanding, search within the already matched domain or hotspot area first.

## Reference Files

- `references/routing-dictionary.md`: request words -> domain -> candidate file groups
- `references/feature-map.md`: domain map with page, UI, repo, contract, bridges, and top files
- `references/change-hotspots.md`: shared entry points and cross-feature bridges

## Maintenance

Update this skill manually after large changes, especially when:

- a new feature domain is added
- a page entry or route changes
- a repository, schema, or contract is renamed or moved
- a request category now lands in different top files than before
- a new cross-module bridge becomes common
