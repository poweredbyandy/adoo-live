const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/main/mode-manager.js', 'src/main/ipc/printer.js'],
    },
  },
});
