// Ensure required env vars are set for all test suites
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'jest-test-secret-do-not-use-in-prod';
