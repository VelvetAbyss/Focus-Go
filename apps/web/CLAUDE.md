## gstack

For all web browsing, use the `/browse` skill from gstack. Never use `mcp__claude-in-chrome__*` tools.

If gstack skills aren't working, run the following to build the binary and register skills:
```
cd .claude/skills/gstack && ./setup
```

Available gstack skills:
- `/office-hours` — structured Q&A / decision sessions
- `/plan-ceo-review` — prepare plans for CEO review
- `/plan-eng-review` — prepare plans for engineering review
- `/plan-design-review` — prepare plans for design review
- `/design-consultation` — get design feedback and recommendations
- `/review` — code review
- `/ship` — ship a feature end-to-end
- `/land-and-deploy` — land and deploy changes
- `/canary` — canary deploy and monitor
- `/benchmark` — run performance benchmarks
- `/browse` — headless browser for web browsing, QA, and testing
- `/qa` — full QA pass
- `/qa-only` — QA without shipping
- `/design-review` — review designs
- `/setup-browser-cookies` — configure browser cookies for authenticated testing
- `/setup-deploy` — set up deployment configuration
- `/retro` — run a retrospective
- `/investigate` — investigate a bug or issue
- `/document-release` — document a release
- `/codex` — codex-style agentic coding
- `/cso` — chief of staff operations
- `/careful` — careful/conservative mode for risky changes
- `/freeze` — freeze a branch or deployment
- `/guard` — guard against regressions
- `/unfreeze` — unfreeze a branch or deployment
- `/gstack-upgrade` — upgrade gstack to the latest version
