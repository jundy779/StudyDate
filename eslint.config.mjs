import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/opengraph-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["components/onboarding/onboarding-form.tsx"],
    rules: {
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "audit-artifacts/**",
    "scripts/live-auth-audit.mjs",
    "scripts/live-role-matrix.mjs",
    "scripts/live-intro-audit.mjs",
    "scripts/intro-responsive-audit.mjs",
  ]),
]);
