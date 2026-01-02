import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // config with just ignores is the replacement for `.eslintignore`
    ignores: ["**/build/**", "**/dist/**", "migrations/**", "**.mjs", "**.js"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // turns a rule on with no configuration (i.e. uses the default configuration)
      "@typescript-eslint/array-type": "error",
      // turns on a rule with configuration
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-lonely-if": "error", // Запрещает одиночные if внутри else
      "max-depth": ["error", 2], // Ограничивает вложенность if
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);
