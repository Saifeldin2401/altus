# Altus Connect - Handover Guide

Last updated: 2026-10-03. This is the entry point for anyone taking over the
codebase. It describes how the system is put together, the rules that keep it
safe, how to ship changes, and what is still open.

---

## 1. What the product is

A multi-tenant SaaS for hospitality organizations. Each **organization** (tenant)
has members with a **membership role**; the platform team (**platform operators**)
manage tenants from a separate Platform workspace.

Five workspaces, each gated by capabilities (`src/config/navigation.ts`):

| Workspace | For | Main routes |
| --- | --- | --- |
| Learn | every member | `/learn` (My day), `/learn/my`, `/learn/courses`, `/learn/paths`, `/knowledge`, `/learn/certificates`, `/learn/achievements` |
| Studio | authors | course builder, AI course generator, knowledge editor + AI article studio |
| Manage | managers | assignments, progress, analytics |
| Organization | tenant admins | people, departments, brands, settings, subscription |
| Platform | platform operators | tenants, master content library, AI configuration, audit |

## 2. Code layout

```
src/
  app/            providers, query runtime, application shell (sidebar, top bar)
  features/       feature modules (learn, knowledge, manage, organization, platform, studio, ...)
  pages/          route-level pages not yet moved into features/
  routes/         router + one module per workspace (lazy-loaded)
  ui/             the design system (@/ui) - tokens, primitives, components
  components/     shared/legacy components (components/ui = shadcn primitives)
  services/       data access (Supabase queries/RPCs)
  hooks/          React Query hooks over services
  lib/            utilities, AI agents (lib/ai), security helpers
  i18n/locales/   en + ar JSON per namespace
supabase/
  migrations/     every schema change, in order (source of truth)
  functions/      Edge Functions (Deno)
  tests/          SQL integrity tests (run against a database)
public/assets/    photos (public/assets/photos, Unsplash License) and hero images
scripts/          guardrails, migration checker, type generation
```

### Design system
- Colours are CSS custom properties in `src/index.css` (`--ds-ink`, `--ds-brass`, ...)
  exposed as Tailwind classes (`bg-ds-ink`, `text-ds-muted`). ESLint warns on
  hard-coded hex colours; legitimate exceptions are listed in `eslint.config.js`.
- Use logical properties (`ms-`, `pe-`, `start-`, `text-start`), never `ml-`/`left-`
  for direction. The document sets `dir="rtl"` for Arabic, so do **not** add manual
  `isRTL ? 'flex-row-reverse' : ''` flips - they double-flip.
- Course/article covers are chosen by `src/features/learn/gamification/covers.ts`
  (topic keywords in English and Arabic -> photo pools). Add photos to
  `public/assets/photos` and list them there and in `src/lib/altusAssetRegistry.ts`.

### Translations
- Every user-facing string goes through `t('ns:key', 'English default')` with the key
  present in both `en` and `ar`.
- **Locale JSON files contain a few duplicate keys and mixed indentation. Never
  load-and-dump them with a JSON library** - insert text instead and check that
  `git diff` shows additions only.

## 3. Security model (read before touching data access)

- **Row-level security everywhere.** The browser uses the anon key; what a member can
  read or write is decided by RLS policies and SECURITY DEFINER helpers
  (`org_visible`, `current_user_organization_ids`, `learning_manager_org_ids`,
  `tenant_can`, `is_platform_super_admin`, ...).
- **Tenant isolation.** Queries are additionally filtered by organization in the
  client, but RLS is the real boundary. SECURITY DEFINER functions bypass RLS, so
  each one must check the caller itself (reviewed 2026-09-27: all pin
  `search_path`; unscoped ones were fixed in migration `20260927091100`).
- **Training completion is server-only.** The trigger
  `enforce_training_progress_integrity` rejects client writes to completion fields
  (`status='completed'`, `passed`, `score_percentage`, `quiz_score`, `completed_at`).
  Complete through `complete_training_module` / `submit_quiz_attempt`; reset through
  `reset_training_progress` or `reset_training_progress_for_module`.
- **Personal data.** Sensitive `profiles` columns (phone, date of birth, national
  ID, iqama, salary grade, emergency contacts, nationality, blood group, contract end,
  suspension reason) are not selectable by API roles. Read them with
  `get_profiles_private(user_ids)` (self, org owner/admin, platform super admin) via
  `src/lib/profilePrivate.ts`. Never `select('*')` from `profiles` - use
  `PUBLIC_PROFILE_COLUMNS`.
- **Storage.** Every bucket except `avatars` is private: use signed URLs
  (`src/lib/secureFileAccess.ts`). ESLint blocks `getPublicUrl`.
- **CSP.** Defined identically in `index.html`, `vercel.json` and `netlify.toml`.
  Scripts allow no `unsafe-inline` / `unsafe-eval` (only `wasm-unsafe-eval` for
  ffmpeg.wasm video compression). Page boot scripts live in `public/boot/`. The
  Vite dev server relaxes the meta policy for React Fast Refresh only.
- **AI features** call the `process-ai-request` Edge Function; provider keys live in
  Supabase secrets, never in the frontend. AI output is never presented as fact
  without its source: the article studio shows only what the model returned, and
  "Ask the knowledge base" answers only from cited, published passages.

## 4. Database changes

1. Write a new file in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`).
2. Test it inside a transaction that you roll back, impersonating real roles
   (`set local role authenticated; select set_config('request.jwt.claims', ...)`).
3. Apply it, then run `npm run check:migrations` and `npm run db:types`.
4. After any migration that drops and recreates views or functions, re-check
   `security_invoker` on views and that `anon` has no EXECUTE on privileged RPCs.

Live project: Supabase project ref `dhbfaclkfysqwfppuxxa`.

## 5. Deploying

- Frontend: static build (`npm run build` -> `dist/`). Vercel (`vercel.json`) and
  Netlify (`netlify.toml`, site `primehotels-connect`) are both connected to the
  repository and build every push; `render.yaml` is a third, unconfirmed config.
  Confirm which host serves the production domain before removing any of them.
  The CSP must stay identical across `index.html` and the host configs.
- Edge Functions: the **Deploy Edge Functions** workflow deploys every function
  from `master` (with the `verify_jwt` each one declares in `supabase/config.toml`)
  whenever they change, once the `SUPABASE_ACCESS_TOKEN` repository secret is set.
  Deploy by hand only in an emergency, and from `master`: hand deploys are how
  production drifted to 50 functions against 27 in git. Every function must be
  declared in `config.toml`, and `npm run check:functions` type-checks them all.
- Migrations: apply with the Supabase CLI (`supabase db push`) so the version in
  `supabase_migrations.schema_migrations` matches the file name. Tools that assign
  their own version number recreate the drift fixed on 2026-10-03.
- **Order matters** when a migration removes access the old frontend used (for
  example the personal-data column lockdown, `20260927091000`): deploy the matching
  frontend at the same time.

### Environment variables (frontend)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | yes | Supabase project |
| `VITE_APP_URL` | yes | canonical app URL (links in emails, certificates) |
| `VITE_CERTIFICATE_VERIFY_URL` | no | public certificate verification base URL |
| `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_RELEASE` | no | error reporting |
| `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`, `VITE_SENTRY_SEND_DEFAULT_PII` | no | Sentry tuning |
| `VITE_VAPID_PUBLIC_KEY` | no | web push |
| `VITE_MAX_SESSION_AGE_MS`, `VITE_ALLOWED_ORIGINS` | no | session / origin hardening |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | build only | source-map upload |

## 6. Quality gates

`npm run verify` must pass before merging. It runs ESLint (errors fail; there are
about 1,200 legacy warnings to burn down), project guardrails, the TypeScript check
and the test suite. Also run `npm run build` and `npm run check:migrations` for
changes that touch the build or the database.

## 7. Open items at handover

Operations (Supabase dashboard - cannot be done from code):
- Upgrade to a plan with point-in-time recovery and confirm backups.
- Enable leaked-password protection, confirm MFA (TOTP) and auth rate limits.
  Sign-in throttling is Supabase Auth's job: the app has no client-side lockout.
- Delete the 23 orphan Edge Functions that exist only in production
  (`debug-secrets-tmp`, `apply-migrations`, `dummy-func`, `slack-*`, ...).
- Add the `SUPABASE_ACCESS_TOKEN` repository secret so functions deploy from
  `master`, and apply migration `20261003200100` (purge_course audit attribution).

Engineering:
- Verify the stricter CSP in a browser on the deployed build (login, video upload in
  the article editor, PDF viewing) - it passed the build but was not browser-tested.
- Adopt the typed Supabase client (`createClient<Database>`) incrementally.
- Burn down ESLint warnings; decide which of the deploy configs is live.
- `scheduled-reports` calls `enqueue_due_reports`, which no longer exists, so due
  reports never queue automatically. Restore the function or remove the option.
- Knowledge base roadmap (not built yet): step-by-step mode for SOPs, side-by-side
  English/Arabic, "what changed since you last read", server-side reading progress,
  understanding checks on required reading, per-article "who hasn't read it",
  QR codes for on-site SOPs.
- The platform-role helper predicates (`has_role`, `is_platform_operator`,
  `platform_operator_can`) accept any user id, so a member can learn whether another
  user is a platform operator. They are used inside RLS policies, so tightening them
  needs care.
