export default [
  { ignores: ['dist/**', 'node_modules/**', 'evidence/**', 'test-results/**', 'playwright-report/**', '.impeccable/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', fetch: 'readonly', performance: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', URLSearchParams: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-undef': 'error', 'no-unreachable': 'error', 'no-constant-condition': 'error', 'no-duplicate-imports': 'error', 'eqeqeq': 'error', 'no-var': 'error', 'prefer-const': 'error' },
  },
  { files: ['src/**/*.js', 'tests/**/*.spec.js'], languageOptions: { globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', location: 'readonly', history: 'readonly', navigator: 'readonly', WebSocket: 'readonly', ResizeObserver: 'readonly', requestAnimationFrame: 'readonly' } } },
];
