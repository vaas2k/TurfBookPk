const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'web-build/'],
    rules: {
      // Existing screens intentionally use async loading effects. Migrate them
      // incrementally before enabling React Compiler-only enforcement.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]);
