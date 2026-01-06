/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Используем require.resolve, чтобы Jest нашел ts-jest в node_modules корня
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  moduleNameMapper: {
    // Мапим @config на конкретный файл конфига
    '^@config$': '<rootDir>/src/config', 
  },
};