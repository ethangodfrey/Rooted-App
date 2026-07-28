/** @type {import('vitest/config').UserConfig} */
module.exports = {
  test: {
    environment: 'node',
    include: ['lib/**/*.spec.ts'],
    root: __dirname,
    clearMocks: true,
  },
};
