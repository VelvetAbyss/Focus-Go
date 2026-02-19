# Focus&Go AI Screenshot Tool

Tauri v2 + React desktop app for screenshot capture, annotation, and AI analysis.

## Local Development

From repository root:

```bash
npm install
npm run dev:screenshot
```

## Workspace Commands

```bash
# frontend-only dev server
npm run dev --workspace @focus-go/ai-screenshot-tool

# tauri desktop runtime
npm run dev:tauri --workspace @focus-go/ai-screenshot-tool

# tests
npm run test --workspace @focus-go/ai-screenshot-tool

# debug build artifact
npm run build:screenshot
```

## Environment

Copy `.env.example` to `.env` and fill required endpoints:

- `VITE_AUTH_API_BASE_URL`
- `VITE_STORAGE_API_BASE_URL`
- `VITE_THEME_API_BASE_URL`
- `VITE_AI_API_BASE_URL`

If required environment variables are missing, ecosystem adapter initialization fails with explicit runtime errors.
