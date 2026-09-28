# Full System Audit — Altus Connect

You are a senior engineer leading a full audit of a production multi-tenant SaaS application. Audit **the whole system**: backend, database, security, every business module, frontend architecture, UX and accessibility, Arabic/RTL, performance, AI features, email, privacy, testing, CI/CD, deployment, dependencies, and operations.

Your job is to find real defects and prove each one with evidence. Do not restate best practices, reproduce linter output, or list generic advice. A finding is only a finding if you can point at the exact code, object, or behavior and show why it is wrong.

Treat this codebase as partly AI-generated and iteratively patched. Expect code that looks correct but is architecturally wrong, fixes applied in one place but not its siblings, duplicated implementations of the same concept, and features that silently fail. The most valuable findings in past audits were things that "worked" in the UI but did nothing, or that the database quietly rejected.

---

## 1. Rules of engagement

1. **Read-only by default.** Do not modify production data, schema, auth settings, storage, secrets, DNS, or deployments. Write fixes up; do not apply them.
2. **Production is the source of truth, not the repo.** The repo and the live system have drifted before. Before reporting a bug from source, confirm the live object (function, policy, deployed edge function, Vercel env var) matches. Before recommending a migration, confirm it wasn't already applied under another version.
3. **Never print secret values.** Report secret names only.
4. **Evidence or it didn't happen.** Every finding needs the exact object (`file:line`, `table.policy`, function signature, URL), how you verified it, and the observed result. Label anything you could not verify **UNVERIFIED**.
5. **Non-destructive testing only.** Any test that writes must run in a transaction or subtransaction that is always rolled back (§6). Confirm nothing was left behind.
6. **The production database is shared.** Do not run the app's write flows (create org, invite user, send notifications, generate AI content) against production to "try them". Test through rolled-back SQL, code reading, or a local/staging environment.
7. **Don't re-report items in §5** unless they regressed.
8. **Cover every domain in §7.** If a domain yields nothing, say what you checked and that it came up clean. An empty section with no method is not acceptable.

---

## 2. Product

**Altus Connect** — a multi-tenant hospitality operations and training platform. Each tenant is a hotel group ("organization"). Hotel staff use it for training and compliance; tenant admins manage their people and content; Altus platform operators manage all tenants.

**Brand:** the product is **Altus**. Older names (Prime, PRIME Connect, prime-hotels-intranet, PHG) remain in infrastructure identifiers, historical migrations, and docs. User-visible occurrences are defects; infrastructure identifiers are not.

**Users and roles**
- Tenant roles (`membership_role`): organization_owner, organization_admin, brand_admin, department_manager, training_manager, knowledge_manager, author, instructor, learner.
- Platform roles: system_owner, platform_admin, platform_support (and others in `role_capabilities`).
- Staff use it on personal phones and on shared hotel devices (front desk, back office).

**Functional modules** (verify each exists as described; flag any that are partial or fake)
- **Learning / LMS:** courses, lessons, quizzes (unified question bank, attempts, randomization, power-ups), practical assessments and submissions, training paths, assignments with targeting rules, exemptions and overrides, recertification cycles, certificates (issued by DB trigger on completion, public verification by code), skills/competencies matrix, gamification.
- **Knowledge & documents:** documents with versions, folders, tags, categories, department access, approvals, acknowledgments, comments, bookmarks/favorites, bilingual full-text search, AI tagging, related articles, SOPs.
- **Notifications:** in-app notifications, preferences, email via `send-email` with per-tenant branding, bulk batches (`bulk-notification-processor`), scheduled reminders, training notifications (cron), push subscriptions.
- **AI:** course generation jobs and presets, course images, translation, document tagging, feedback analysis, ticket triage, model registry and verification, routing across multiple providers, per-tenant AI credits and quotas.
- **Reports & analytics:** analytics events, dashboards, report definitions/runs, scheduled compliance reports, exports.
- **People & organization:** user provisioning (invite/temporary password/bulk), departments, brands, profiles (including sensitive HR fields), sessions, MFA, onboarding wizards.
- **Platform console:** tenant provisioning (`provision_organization`), lifecycle (active/trial/suspended/archived → purge), entitlements and quotas, subscriptions/plans, feature flags and per-org overrides, platform access sessions ("enter tenant"), master content deployed to tenants, platform user directory, audit logs.
- **Integrations:** Slack (commands/events/interactive/training), Resend inbound email, webhooks (`webhook_endpoints`/`webhook_deliveries`), news fetch, weather proxy, image proxy, VirusTotal file scanning.

---

## 3. Architecture

**Frontend**
- React 19, TypeScript 5.9, Vite 7, React Router 7, TanStack Query 5, Zustand, React Hook Form + Zod, Tailwind + Radix UI, TipTap editor, Recharts, pdf.js/jsPDF, marked + DOMPurify, i18next (English/Arabic with RTL), Sentry, Vercel Analytics.
- Layout: `src/app` (providers), `src/routes` (`router.tsx`, `routes/modules/{Admin,Auth,Learn,Manage,Studio,Misc}Routes.tsx`, `legacyRedirects.tsx`), `src/pages/*`, `src/features/{access,account,knowledge,learn,manage,organization,platform,search,studio}`, `src/services` (data access), `src/contexts` (auth split into identity/user-data/security/actions), `src/stores`, `src/hooks`, `src/lib`, `src/components`, `src/ui`, `src/i18n/locales/{en,ar}`, `src/rtl.css`, `src/types/database.generated.ts`.
- Service worker: `public/sw.js` plus `public/boot/sw-cleanup.js` and `public/boot/host-redirect.js`; PWA is disabled via `VITE_ENABLE_PWA=false`. There is history of white-screen-on-update bugs.
- Security headers and CSP in `vercel.json` (and a CSP in `vite.config.ts`).

**Hosting / deployment**
- Vercel project `altus` (team `saifs-projects-dede158c`), production domain `https://phg-connect.com` (apex; `www` 301 to apex), DNS on Vercel. A second Vercel project, `prime-hotels-intranet`, still deploys.
- Pushing to `master` deploys to production. Vercel env vars include both Vite (`VITE_*`) and Supabase-integration variables (including service-role and Postgres credentials that the static SPA does not use).
- CI: `.github/workflows/ci.yml` (migration check, lint, typecheck, tests, build, npm audit; **database regression suites are skipped when `STAGING_DB_URL` is not set**) and `security.yml` (npm audit, secret detection, CodeQL, dependency review).

**Backend — Supabase project `dhbfaclkfysqwfppuxxa`** (`eu-west-1`, Postgres 17, **Free plan**)
- ~128 `public` tables, all with RLS. Tenant key is `organization_id`. `brands` also carries a legacy `company_id`.
- ~400 migrations in `supabase/migrations/`; `supabase/migrations/archive/` must never be applied.
- ~47 Edge Functions (`supabase/functions/`, shared code in `_shared/`). Some have `verify_jwt=false` and do their own auth.
- `pg_cron`: weekly VACUUM, hourly approval escalation, daily training notifications (edge function called with a service-role key from Vault), certificate expirations, monthly AI credit reset, **daily `purge_archived_organizations` (irreversible cascade delete)**, transient cleanup, daily quota evaluation, and a disabled AI model verifier.
- Storage buckets — public: `avatars`, `content-media`, `media`, `training-content`; private: `documents`, `employee-documents`, `announcement-attachments`, `sop-attachments`, `task-attachments`, `reports-exports`.
- Realtime on: `assignments`, `document_department_access`, `documents`, `learning_assignment_exemptions`, `learning_assignment_user_overrides`, `notifications`, `profiles`, `training_progress`.
- Data retention policies exist in `data_retention_policies` (30/90/2555 days).

**Auth**
- Supabase Auth: Google OAuth + email/password. Site URL `https://phg-connect.com`. Custom SMTP via Resend (DKIM, SPF on `send.` subdomain, DMARC `p=none`).
- Invite-only in practice: `create-user` provisions users; accounts without an active membership are signed out to `/login?error=not_registered`.
- Password reset and invitations bypass Supabase's native templates: links come from `auth.admin.generateLink` and mail goes through `send-email`, branded per recipient organization.
- MFA: Supabase TOTP (optional) plus a custom layer (`mfa_secrets`, `verify_mfa_code`).

**Third parties:** Supabase, Vercel, Resend, Sentry, Google OAuth, AI providers (OpenRouter, Groq, Google Gemini, Cloudflare Workers AI, Hugging Face, OpenAI, DeepSeek per CSP and code), Firecrawl/Serper/scraper APIs, LibreTranslate, VirusTotal, Slack, Unsplash, YouTube/Vimeo embeds.

---

## 4. Authorization model

Two planes. Understand this before auditing any access control.

**Tenant plane:** `organizations`, `organization_memberships`. Capabilities via `tenant_can(org_id, capability)` and wrappers (`is_tenant_admin`, `is_tenant_people_admin`, `is_tenant_content_editor`, `can_manage_learning_assignment`). Visibility via `current_user_organization_ids()`, `org_is_operational(org_id)`, and `org_visible(org_id)` = platform super admin OR active platform session OR (member AND operational).

**Platform plane:** `platform_users`, `platform_role_assignments`, `role_capabilities` (plane='platform'). Checks: `is_platform_operator`, `is_platform_super_admin`, `platform_operator_can(capability)`, `platform_operator_has_role(role)`. Operators enter a tenant through time-boxed platform access sessions (`start_platform_session`, `has_active_platform_session`).

**Legacy:** `public.user_roles` (10 rows) is still read by some paths, e.g. `create-user` uses it to limit which roles an inviter may assign, and `secure_search_documents` uses it for `visibility='role'`. Any authorization decision still based on `user_roles` is suspect.

Helpers are `SECURITY DEFINER`, `search_path` pinned, identity from `auth.uid()`. Over 160 definer functions are executable by `authenticated`. Base-table RLS is only half the picture: every definer function that accepts an `org_id` or `user_id` must authorize internally.

---

## 5. Already fixed or known (do not re-report unless regressed)

**Fixed 2026-09-27:**
- Auth Site URL / redirect allowlist corrected to `phg-connect.com`.
- `has_profile_access()` no longer honors legacy `user_roles.role='super_admin'`.
- Cross-tenant read on `notification_batches` closed.
- Duplicate permissive policies consolidated (10 tables); `search_path` pinned everywhere flagged; `lessons` FK indexes; `_legacy_platform_fallback` dropped; `role_permissions` write policies narrowed to `authenticated`.
- `organizations` had no INSERT policy (tenant creation failed for everyone). Replaced by `provision_organization(...)`, which also seeds 12 departments, a category, a default certificate template, and an audit entry; the create form can invite an owner.
- `platform_audit_logs` client inserts were always rejected by RLS; now via `log_platform_action(...)` with actor = `auth.uid()`.
- `bulk-notification-processor` CORS blocked `phg-connect.com`; fixed and deployed.
- Password min length 8; DMARC added; unused `SERVICE_ROLE_KEY` secret removed; new certificate numbers use `ALT-`; old Prime logo files removed.
- Migration history realigned (401 local = 401 remote).
- Verified live: an organization owner sees zero rows from other tenants across all org-scoped tables; `anon` sees zero rows in all public tables.

**Known open:**
- Free plan: **no backups, no PITR**; leaked-password protection unavailable.
- Sentry disabled in production (no `VITE_SENTRY_DSN` in Vercel).
- CORS cleanup committed but not deployed for `create-user`, `generate-course-image`, `process-ai-request`, and `_shared/cors.ts` importers.
- Decision pending on public buckets `content-media`, `media`, `training-content`.
- Pre-existing TypeScript errors in `src/components/common/EmptyState.tsx`, `src/hooks/usePerformanceMonitor.ts`, `src/lib/vercelMonitoring.ts` (CI typecheck will fail).
- Duplicate Vercel project `prime-hotels-intranet`.
- `generate_certificate_number()` uses `MAX()+1` without a lock (suspected race; confirm).

---

## 6. How to test safely

**Impersonate a user under RLS** (read-only):
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"<user-uuid>","role":"authenticated","aud":"authenticated"}', true);
select ... ;
```
Use `set local role anon` with `{"role":"anon"}` for logged-out tests.

**Probe a write without keeping it:**
```sql
create temp table probe(test text, outcome text) on commit drop;
do $$
begin
  begin
    perform set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.some_table (...) values (...);
    raise exception 'PROBE_OK';
  exception when others then
    execute 'reset role';
    insert into probe values ('description',
      case when sqlerrm = 'PROBE_OK' then 'ALLOWED' else 'DENIED: ' || sqlerrm end);
  end;
end $$;
select * from probe;
```

**Edge functions:** `OPTIONS` preflight with an `Origin` header to read `Access-Control-Allow-Origin`; unauthenticated request should return 401. Download the deployed version and diff it against the repo before claiming a code bug is live.

**Frontend:** run it locally (`npm ci`, `npm run dev`) against a non-production Supabase project or with network writes blocked. Use a browser for UX, accessibility, RTL, and performance checks. Lighthouse and axe are acceptable evidence when you cite the exact element or metric.

---

## 7. Audit domains

For each domain: what to check, then the specific places this system is likely to be wrong.

### 7.1 Security and tenant isolation
- **Per-command RLS coverage.** For every table, which commands have a policy for `authenticated`, cross-referenced with every client-side write in `src/`. A client write with no matching policy is a broken feature (this has happened twice). An over-broad INSERT/UPDATE is an escalation risk.
- **Definer functions with caller-supplied IDs.** For each definer function callable by `authenticated`/`anon`: does it authorize the `org_id`/`user_id` it receives against `auth.uid()`? Does it return columns the caller couldn't read directly?
- **Column privileges vs function security mode.** `authenticated` cannot read some `profiles` columns. Invoker functions reading them will error; definer functions may leak them. Realtime on `profiles` broadcasts whole rows — does it bypass the column restriction?
- **Edge functions with the service-role key.** For each: caller authentication, tenant authorization, and whether changing `organizationId`/`userId`/`documentId` in the body reaches another tenant. Include `send-email` (`can_send_tenant_email`), `create-user`, `delete-user`, `bulk-create-users`, `admin-account-actions`, `scan-file`, `encrypt-field`, AI functions, Resend inbound, Slack (is signature verification from `_shared/slack-utils.ts` actually called?).
- **Storage.** Per bucket: `storage.objects` policies per command, path convention, whether paths embed `organization_id`, cross-tenant upload/delete, guessable URLs in public buckets.
- **CORS.** Allowlists are duplicated per function; some also allow any `*.vercel.app` origin. Find missing production origins and over-broad rules.
- **Web security headers.** Evaluate the CSP in `vercel.json` (and whether it matches `vite.config.ts`), `unsafe-inline`, allowed script hosts, `frame-ancestors`, HSTS, and what the app actually loads.
- **XSS.** Every `dangerouslySetInnerHTML`, `marked`, TipTap output, SVG upload, email template, and PDF generation path: is DOMPurify applied, with what config, and before storage or before render?
- **Auth flows.** Route guards vs server enforcement, the post-OAuth `not_registered` sign-out, `user_metadata` trusted for authorization, redirects built from `window.location.origin`, session handling on shared devices, MFA enforcement for privileged roles, the custom MFA layer's bypass history.

### 7.2 Data integrity and business logic (audit each module)
For each module in §2, find rules enforced only in the frontend and verify the database enforces them. Examples:
- **Learning:** completion without passing, progress over 100% or negative scores, quiz attempt limits, grading done client-side, certificates issued without completion or twice, recertification cycles resetting correctly, assignment targeting when users change department/role, exemptions honored in compliance stats.
- **Documents:** approval self-approval, version history integrity, acknowledgments for superseded versions, department-restricted documents leaking through search or related-articles.
- **People:** duplicate memberships, role assignment above one's own level, owner removal leaving an org ownerless, suspended users or suspended tenants still writing.
- **Platform:** lifecycle transitions (can archived come back? what sets `purge_scheduled_at`?), quota enforcement actually blocking, entitlements matching plans, master-content deployment overwriting tenant edits.
- **Cross-cutting:** orphaned rows after deletes, missing FKs, nullable columns that should be required, numbering races (`generate_certificate_number`), duplicated concepts (`user_roles` vs memberships; `brands.company_id` vs `organization_id`; two onboarding systems).

### 7.3 Error handling and silent failures
supabase-js returns `{ data, error }` and does not throw. Find every `await supabase...` whose `error` is ignored, every `try/catch` that swallows, every fallback that hides a real failure (e.g. branding defaults, "non-fatal" email sends). Identify which of these are **currently failing in production**.

### 7.4 Frontend architecture and code quality
- State: overlap and conflicts between TanStack Query, Zustand stores, and contexts; stale-cache bugs after mutations; cache keys missing `organization_id` (data leaking across a tenant switch in one session).
- Data access: queries in components vs `src/services`; duplicated services; unbounded selects; missing pagination.
- Routing: `legacyRedirects.tsx` and route modules — dead routes, routes with no guard, guards that check the wrong role.
- TypeScript: `any` density in critical paths, casts hiding schema mismatches, `database.generated.ts` out of sync with the live schema (regenerate and diff).
- Dead code: unused pages, components, hooks, services, feature flags.

### 7.5 UX and accessibility
- WCAG 2.1 AA on the core journeys (login, learner home, taking a course and quiz, document reading and acknowledgment, admin user management, platform org management): keyboard access, focus order and visibility, labels, contrast, screen-reader names on icon buttons, dialog focus trapping.
- Loading, empty, and error states on every data view; destructive actions confirmed; form validation messages.
- Responsive behavior at phone and tablet widths (staff use phones).

### 7.6 Internationalization and RTL
- Keys present in `en` but missing in `ar` (and vice versa); hardcoded English strings in components (the platform console has many, including the organization create dialog).
- RTL layout: mirrored icons, margins/padding using physical instead of logical properties, charts, tables, the editor, PDFs and certificates in Arabic.
- Dates, numbers, and names formatting; Arabic search quality.

### 7.7 Performance
- Bundle: the build warns about chunks over 1000 kB; identify what is in them and what should be lazy-loaded (editor, pdf.js, charts, AI features).
- Core Web Vitals on the main pages; request waterfalls on first load.
- Database: queries filtering by `organization_id` plus status/date/user without a composite index; RLS helper functions evaluated per row; expensive dashboard RPCs; N+1 from the client.
- Media: video and large files served from Supabase Storage (egress cost and no adaptive streaming).
- Caching headers in `vercel.json` vs actual asset hashing; `index.html` and service worker caching.

### 7.8 Service worker and app updates
How new versions reach users: `public/sw.js`, `sw-cleanup.js`, `host-redirect.js`, the update-available flow in `App.tsx`. Look for stale bundles, white screens after deploy, chunk-load errors, and cache keys that never clear.

### 7.9 Privacy and compliance
- `profiles` stores iqama number, national ID, date of birth, salary grade, blood group, nationality, and emergency contacts. Who can read each field (tenant roles, operators, Realtime, exports, search functions)? Are they encrypted at rest (`encrypt-field`, `FIELD_ENCRYPTION_KEY`) or plaintext? Are they sent to AI providers, Sentry, logs, or analytics?
- Are `data_retention_policies` actually enforced by a job, or only stored?
- Data subject rights: export and deletion of a user's data; what `delete-user` actually removes.
- What personal data goes to each third party (§3), and whether that is disclosed.
- Assess against Saudi PDPL expectations where relevant (data minimization, purpose, cross-border transfer — note the database region is `eu-west-1`).

### 7.10 AI subsystem
- Provider routing and fallbacks: missing keys (some provider keys referenced in code are not configured as secrets), how failures surface to users.
- Cost control: are per-tenant credits and quotas enforced before the provider call, server-side, and race-safe?
- Prompt injection: uploaded documents and user text flowing into prompts; can a tenant's content make the model reveal another tenant's data or system prompts?
- Output handling: model output rendered as HTML/markdown (XSS), written into courses or documents without review.
- Data sent to providers: which tenant data, and whether any sensitive profile fields are included.

### 7.11 Email and notifications
Branding resolution (recipient's org), sender/reply-to, deliverability (SPF/DKIM/DMARC alignment for the sending domain), bulk sending limits and batching, retries and duplicate sends, unsubscribe/preferences honored, cron-driven notifications running per tenant correctly, email content escaping.

### 7.12 Testing and quality gates
- What the tests actually cover vs the critical paths above. Map each critical journey to a test or mark it untested.
- CI: does `ci.yml` currently pass on `master`? The typecheck step should fail (known errors). Database regression suites never run without `STAGING_DB_URL`. Security tests in `src/test/security` — do they test the real database or mocks?

### 7.13 CI/CD, environments, and deployment
- Do Vercel preview deployments use the **production** Supabase project? If so, previews can write production data.
- Env var inventory across Vercel (Production/Preview/Development) and Supabase secrets: missing, unused, duplicated, or wrongly scoped values.
- Migration workflow (`check:migrations`, `db:push`) and whether it can re-run or skip migrations; edge function deploy process and rollback; the duplicate `prime-hotels-intranet` Vercel project.

### 7.14 Dependencies and supply chain
`npm audit`, outdated majors with known issues, abandoned packages, duplicate libraries doing the same job, CDN/external scripts allowed by CSP, lockfile integrity.

### 7.15 Observability and operations
Error tracking (Sentry currently off), logs available for Postgres/Auth/Edge Functions on the Free plan, alerting (none known), audit trail completeness (platform actions now logged; check tenant-level admin actions), backups and restore (none), runbooks and incident docs in `docs/` — are they accurate?

### 7.16 Scalability and cost
Free-plan limits vs expected load (database size, egress, edge function invocations, Realtime connections, auth emails); AI spend exposure; storage growth from video.

### 7.17 Documentation
`docs/` is large and much of it is stale (e.g. references to old names and architectures). Identify docs that are wrong in ways that would mislead an engineer or an on-call responder.

---

## 8. Severity

- **CRITICAL** — cross-tenant data access, privilege escalation, auth bypass, secret or sensitive-PII exposure, or irreversible data loss reachable today.
- **HIGH** — a production feature broken or silently failing; a security weakness with a realistic precondition; a compliance gap involving sensitive personal data.
- **MEDIUM** — correctness or integrity gap without current impact; accessibility blocker on a core journey; performance issue that will bite at 10× data.
- **LOW** — hardening, cleanup, consistency, polish.

Current data volume is small (2 organizations, ~9 members). Do not treat "0 rows affected today" as "not a bug".

---

## 9. Output

1. **Executive summary** — overall status, top 10 risks in plain language, and a one-line verdict per domain in §7 (clean / issues / not checked).
2. **Findings table**, ordered by severity:

   | ID | Severity | Domain | Finding | Evidence (object + how verified) | Impact | Recommended fix | Verified live? |

3. **Detail for every CRITICAL and HIGH:** safe reproduction, root cause, exact fix (SQL or code diff), risk of applying it, and what else must change with it.
4. **RLS coverage matrix** — table × command × roles, flagging missing and over-broad policies, cross-referenced to client writes.
5. **Definer-function register** — callable definer functions, parameters, verdict (safe / needs check / unsafe).
6. **Edge-function register** — auth method, tenant validation, service-role use, CORS verdict, deployed-matches-repo.
7. **Module integrity table** — each module in §2 with rules enforced in the DB vs only in the UI.
8. **Frontend report** — accessibility, RTL/i18n gaps (with key names), performance measurements, dead code list.
9. **Privacy map** — each sensitive field → who can read it → where it flows.
10. **Test coverage map** — critical journeys → covering test or "untested".
11. **Unverified list** — what you couldn't check and why.
12. **Fix plan** — ordered, grouping changes that can ship independently vs changes that need schema, client, and edge functions to ship together.

Do not apply any fix. Stop after the report.
