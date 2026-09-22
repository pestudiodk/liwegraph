import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["build/**", "node_modules/**", ".liwe/**", "npm-package-preview/**"],
  },
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { "@typescript-eslint": tseslint.plugin, sonarjs },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["eslint.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  prettier,
];
