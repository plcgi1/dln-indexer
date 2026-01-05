import nextPlugin from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    // Указываем, какие файлы проверять
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@next/next': nextPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Здесь можно добавить свои правила или отключить мешающие:
      '@next/next/no-html-link-for-pages': 'error',
    },
  },
  {
    // Игнорируем лишнее
    ignores: ['.next/*', 'node_modules/*', 'dist/*'],
  },
];
