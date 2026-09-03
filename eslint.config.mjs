import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Plain apostrophes in copy (e.g. "Today's Jobs") are fine — not worth
      // forcing HTML entities everywhere.
      "react/no-unescaped-entities": "off",
      "jsx-a11y/alt-text": "off",
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
