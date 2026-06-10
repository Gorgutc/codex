import js from '@eslint/js';

const browserGlobals = {
  AbortController: 'readonly',
  Blob: 'readonly',
  CARDS_DATA: 'readonly',
  CustomEvent: 'readonly',
  DOMParser: 'readonly',
  Element: 'readonly',
  FA_DATA: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  HTMLAnchorElement: 'readonly',
  HTMLElement: 'readonly',
  HTMLImageElement: 'readonly',
  I18N: 'readonly',
  I18N_DATA: 'readonly',
  Image: 'readonly',
  IntersectionObserver: 'readonly',
  Lenis: 'readonly',
  MouseEvent: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  ScrollTrigger: 'readonly',
  SplitText: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  XMLSerializer: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  customElements: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  getComputedStyle: 'readonly',
  gsap: 'readonly',
  history: 'readonly',
  location: 'readonly',
  matchMedia: 'readonly',
  navigator: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly'
};

// admin/js — classic-скрипты админ-панели: те же browser-глобалы, что и js/**,
// плюс storage/кодеки и общие неймспейсы admin-скриптов (api → state → ui).
const adminBrowserGlobals = {
  ...browserGlobals,
  AdminAPI: 'readonly',
  AdminState: 'readonly',
  AdminUI: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  crypto: 'readonly',
  sessionStorage: 'readonly'
};

const nodeGlobals = {
  Buffer: 'readonly',
  URL: 'readonly',
  __dirname: 'readonly',
  console: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
  setTimeout: 'readonly'
};

export default [
  {
    ignores: [
      'node_modules/**',
      'js/vendor/**',
      'admin/js/vendor/**',
      'assets/**',
      'downloads/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'plugins/**/references/claude-original/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-redeclare': 'off',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['js/*-data.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['admin/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: adminBrowserGlobals
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-redeclare': 'off',
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['netlify/functions/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...nodeGlobals,
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URLSearchParams: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'warn'
    }
  },
  {
    files: [
      'verify-frozen.js',
      'scripts/**/*.js',
      'scripts/**/*.mjs',
      '*.config.cjs',
      '*.config.mjs',
      'eslint.config.mjs'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        ...nodeGlobals
      }
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['verify-frozen.js', '*.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    }
  }
];
