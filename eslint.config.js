import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
    "**/.netlify/**",
    "**/generated/**",
    "**/gen-*.js",
    "**/*.min.js",
    "**/*.backup",
  ]),
  {
    files: ["**/*.{js,jsx,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      react,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-vars": "error",
      "no-redeclare": "error",
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^[A-Z_]",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Node and Deno runtime files (server, scripts, runtime) should be linted with their respective globals
  {
    files: [
      "packages/**/src/**",
      "packages/**/scripts/**",
      "packages/**/scripts/**/*.js",
      "scripts/**",
      "**/runtime/**",
      "**/__tests__/**",
      "**/*.test.js",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.deno,
      },
    },
  },
  // Keep existing overrides for edge and functions etc.
  {
    files: [
      "apps/**/netlify/edge-functions/*.js",
      "packages/**/edge/**",
      "packages/**/edge/**/*.js",
    ],
    languageOptions: {
      globals: {
        ...globals.deno,
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    files: ["apps/**/netlify/functions/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/scripts/*.js", "scripts/*.js", "**/playwright.config.js", "**/tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);
