// Like jusers.js -> using JS as a DB language

import globals from "globals";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

delete globals.browser['AudioWorkletGlobalScope ']; // bug in eslint 9.15.0
export default [...compat.extends("eslint:recommended"), {
  plugins: {},
  languageOptions: {
    globals: {
      ...globals.browser,
    },
    ecmaVersion: 12,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  files: ["**/*.jsx", "**/*.js", "**/*.jsm"],
  rules: {
    "no-cond-assign": 'off',
    "no-unused-vars": 'warn',
    "no-constant-condition": 'off',
  },
}];
