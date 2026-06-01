import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // React Compiler strict rules (react-hooks v5) — not yet adopted codebase-wide
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      // Web ⇄ Desktop one-way rule: apps/web must never depend on desktop/Tauri.
      // Desktop frontend code lives in apps/desktop/src/tauriPlatform.ts and is
      // reached only through the platform seam (src/platform). See AGENTS.md.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@tauri-apps', '@tauri-apps/*'],
            message: 'apps/web must stay desktop-agnostic — never import @tauri-apps here. Use the platform seam (src/platform); desktop code lives in apps/desktop/src/tauriPlatform.ts.',
          },
          {
            group: ['virtual:platform'],
            message: "Only src/platform/index.ts may import 'virtual:platform'.",
          },
        ],
      }],
    },
  },
  {
    // The platform seam is the single allowed bridge point: it may import the
    // injected desktop impl via 'virtual:platform' (but still never @tauri-apps).
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@tauri-apps', '@tauri-apps/*'],
            message: 'Even the platform seam must not import @tauri-apps — that belongs in apps/desktop/src/tauriPlatform.ts.',
          },
        ],
      }],
    },
  },
])
