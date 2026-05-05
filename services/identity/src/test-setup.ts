// Ensure required env vars are set for all test suites
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'jest-test-secret-do-not-use-in-prod';
process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] ?? 'test-key-ci-do-not-use-in-prod';
