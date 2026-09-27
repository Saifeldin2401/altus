import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'node_modules',
    '.agent',
    '.claude',
    '.agents',
    '.cursor',
    '.codex',
    '.kilo',
    'supabase/functions',
    'supabase/migrations',
    // Local-only vendored UI templates (already git-ignored). Not application
    // code -- linting it produced 74 parse errors and drowned real findings.
    'scratch',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ---------------------------------------------------------------------
      // REGRESSION GUARDRAILS (severity: error, on purpose)
      //
      // These encode bug classes that have each recurred many times in this
      // codebase. They are errors, not warnings, because there are ~1090
      // existing warnings -- a new warning is invisible in that noise and
      // would not stop the bug from shipping again.
      // ---------------------------------------------------------------------

      // Every storage bucket in this project is PRIVATE except 'avatars'
      // (verified against storage.buckets). getPublicUrl() on a private bucket
      // returns a URL that always 404s, and the failure is silent -- the string
      // looks like a valid URL and often gets persisted to the database, so the
      // breakage surfaces later and far from the cause. This exact bug has been
      // found and fixed in documents, media, images, audio, document links,
      // avatars, maintenance attachments, and announcement attachments.
      // Use a signed URL instead (see resolveStorageUrl / the resolve*Url
      // helpers in src/lib/secureFileAccess.ts). If you are genuinely targeting
      // the public 'avatars' bucket, disable this rule on the line with a
      // comment saying so.
      'no-restricted-properties': ['error', {
        property: 'getPublicUrl',
        message:
          'All storage buckets except "avatars" are private -- getPublicUrl() will return a URL that 404s. Use a signed URL (resolveStorageUrl / resolve*Url in src/lib/secureFileAccess.ts). For the avatars bucket only, add an eslint-disable-next-line with a justification.',
      }],

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-control-regex': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-refresh/only-export-components': 'warn',
      // Design-system guardrail: keep color out of source. Use tokens from src/index.css
      // (bg-primary, text-foreground, hsl(var(--hotel-gold)), etc.) so theming + dark mode work.
      'no-restricted-syntax': ['warn',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{6}\\b/]',
          message: 'Avoid hardcoded hex colors. Use a design token (bg-primary, text-foreground, hsl(var(--...))) — see src/index.css.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{6}\\b/]',
          message: 'Avoid hardcoded hex colors in template strings. Use a design token — see src/index.css.',
        },
      ],
    },
  },
  {
    // Allow hardcoded colors where they are legitimately data, not UI chrome:
    // decorative confetti, chart series palettes, and theme-token definitions.
    files: [
      'src/components/ui/HolidayCelebration.tsx',
      'src/lib/theme.ts',
      'src/**/*chart*.{ts,tsx}',
      'src/**/*Chart*.{ts,tsx}',
      'src/ui/tokens/**/*.{ts,tsx}',
      'src/ui/primitives/**/*.{ts,tsx}',
      // A fixed picker palette (tag colors), not app chrome — forcing it onto
      // the design tokens would remove the distinguishable swatches it exists for.
      'src/components/documents/DocumentTagManager.tsx',
      // Tenant brand-theme presets: a curated palette a tenant picks *as* their
      // own branding, so it can never be the app's own design tokens.
      'src/pages/platform/OrganizationsHub.tsx',
      'src/pages/platform/OrganizationProfile.tsx',
      'src/components/admin/AITenantEmailBrandCopilotModal.tsx',
      // The printable certificate's own token definitions (mirrors src/ui/tokens),
      // plus html2canvas/QRCode color config that must be a resolved literal —
      // neither can consume a CSS custom property.
      'src/lib/certificateTemplate.ts',
      'src/services/certificateService.ts',
      // Browser DevTools console.log('%c...', 'color: #...') styling — never
      // rendered as app UI, so it can't use the app's design tokens.
      'src/services/aiCourseEngineService.ts',
      'src/lib/ai/providers/multiProviderRouter.ts',
      'src/components/training/ai-engine/VisualAssetEditorModal.tsx',
      // Same tenant brand-color default as OrganizationsHub/OrganizationProfile.
      'src/services/platformService.ts',
      'src/pages/admin/components/OrganizationProfileSettings.tsx',
      // Decorative confetti particle colors (mirrors HolidayCelebration.tsx above).
      'src/components/training/player/PlayerCelebrationModal.tsx',
      // Inline styles for an HTML email template preview - email clients strip
      // <style> and CSS custom properties, so these must be literal.
      'src/pages/admin/EmailTemplateEditor.tsx',
      // Google's own "G" logo colors on the sign-in button (mirrors the
      // LinkedIn brand-blue exception on the certificate share button).
      'src/components/auth/LoginView.tsx',
      // Contrast-ratio color math, not app UI (mirrors src/lib/theme.ts).
      'src/lib/colorContrast.ts',
      // Browser DevTools console styling (imageDebugLogger) and a generated SVG
      // placeholder image baked as a data URI (imageAgent) — neither is live DOM.
      'src/lib/ai/imageDebugLogger.ts',
      'src/lib/ai/agents/imageAgent.ts',
      // The last-resort fallback rendered via raw innerHTML when React itself
      // fails to mount, so it cannot depend on the app's CSS bundle having loaded.
      'src/main.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tests capture hook values from throwaway consumer components on purpose.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/globals': 'off',
    },
  },
])
