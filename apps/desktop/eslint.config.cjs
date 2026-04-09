const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const reactHooks = require('eslint-plugin-react-hooks')
const reactRefresh = require('eslint-plugin-react-refresh')

module.exports = [
  {
    ignores: ['dist', 'dist-electron', 'eslint.config.cjs'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
