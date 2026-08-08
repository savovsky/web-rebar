import eslint from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Adapted from doxeek's ESLint setup (2026-08-08). Dropped: Convex plugin (no backend here),
// MUI/@ocome import-order groups, dead 'react/*' rules (plugin never registered in doxeek).
// Prettier runs as an ESLint rule — formatting options live in 'prettier/prettier' below.
const MAX_CYCLOMATIC_COMPLEXITY = 15;
const MAX_LINES_PER_FUNCTION = 115;
export default defineConfig([
  globalIgnores(['dist']),
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      prettier,
    },
    extends: [reactRefresh.configs.vite],
    settings: {
      react: {
        version: 'detect', // Automatically detect React version for linting rules that depend on it
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      'max-statements-per-line': ['error', { max: 1 }],
      'no-nested-ternary': 'error', // Disallow nested ternary expressions for better readability
      'no-unneeded-ternary': 'error', // Disallow ternary operators when simpler alternatives exist
      'no-var': 'error', // Enforce let/const over var
      'block-spacing': ['error', 'always'],
      'operator-assignment': ['error', 'always'],
      'max-depth': ['error', 3], // Nested blocks
      complexity: ['error', MAX_CYCLOMATIC_COMPLEXITY], // Cyclomatic complexity
      'max-nested-callbacks': ['error', 2],
      'max-lines-per-function': ['error', MAX_LINES_PER_FUNCTION],
      'max-params': ['error', 2], // For more, use an options object (matches §N plain-params-object rule)
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-else-return': 'error',
      'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 1 }],
      'no-magic-numbers': [
        'error',
        {
          detectObjects: false, // Don't require named constants for object properties
          enforceConst: true,
          ignore: [-1, 0, 1, 2, 3, 4, 5, 10, 12, 24, 60, 100, 1000],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        // Enforce consistent handling of unused variables with exceptions for those prefixed with '_'
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'], // Allow PascalCase for component imports
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'], // PascalCase for components, UPPER_CASE for constants
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow', // Allow leading underscore for unused parameters
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'], // Allow PascalCase for React components
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          prefix: ['T', 'K', 'I'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['can', 'did', 'has', 'is', 'must', 'needs', 'should', 'will'],
        },
      ],
      'prettier/prettier': [
        // Prettier formatting + import ordering, enforced as a lint rule
        'error',
        {
          tabWidth: 2,
          singleQuote: true,
          jsxSingleQuote: true,
          semi: true,
          printWidth: 110,
          arrowParens: 'always',
          trailingComma: 'all',
          endOfLine: 'auto',
          importOrder: ['^react(.*)$', '<THIRD_PARTY_MODULES>', '^@/(.*)$', '^[./]'],
          importOrderSeparation: false,
          importOrderSortSpecifiers: true,
          plugins: ['@trivago/prettier-plugin-sort-imports'],
        },
      ],
    },
  },
  // Plain JS files (this config): no type-aware linting
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Stricter line limit for TypeScript files (utilities, types, etc.)
  {
    files: ['**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  // Stricter line limit for TSX files (React components with JSX markup)
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
]);
