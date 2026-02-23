module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    testTimeout: 30000,
};
