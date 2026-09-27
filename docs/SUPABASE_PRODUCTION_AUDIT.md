# Supabase Production Readiness Audit — Altus / PHG Connect

**Project:** `dhbfaclkfysqwfppuxxa` ("connect v2"), region `eu-west-1`, Postgres 17.6, status `ACTIVE_HEALTHY`
**Audit date:** 2026-09-27
**Method:** Live inspection via Supabase Management API + Postgres introspection (`pg_policies`, `pg_proc`, `pg_class`, `information_schema`, `storage.buckets`, `cron.job`, `vault` grants) and a codebase pass (edge functions, CORS config, client bundle). No changes were made — this is Phase 1 (read-only), per your rules.

> **Update, end of day 2026-09-27:** most findings below have since been fixed, and a few were wrong (SPF, the Sentry DSN location, backups). See "Status after fixes" at the top of [SUPABASE_DASHBOARD_CONFIG_AUDIT.md](SUPABASE_DASHBOARD_CONFIG_AUDIT.md) for the current state.

---

## A. Executive Summary

**Overall status: closer to production-ready than the average Supabase project at this stage.** RLS is enabled on all 128 public tables, tenant-isolation logic is centralized in a small set of well-designed `SECURITY DEFINER` helper functions that derive identity server-side from `auth.uid()` (never from client-supplied IDs), and the migration history shows 300+ iterative, security-driven migrations (`fix_*_idor`, `fix_*_privilege_escalation`, `fix_*_cross_tenant_*`) — this team has been actively hunting and closing real vulnerabilities, not just building features.

**No CRITICAL blockers were found in the database/RLS layer itself.** The real gaps are: (1) a handful of Auth-platform settings that were never hardened (leaked-password protection, CAPTCHA, password length), (2) one dormant-but-dangerous legacy privilege-escalation path, (3) unverifiable-via-CLI operational items (backups, compute sizing) that need a manual dashboard check before you'd call this "production-grade," and (4) a broken production monitoring config (placeholder Sentry DSN).

**Major risks:**
- Legacy `user_roles.role = 'super_admin'` bypass still live in `has_profile_access()` — currently 0 rows, but if anything ever inserts one, that user gets cross-tenant profile access outside the platform-operator system.
- 4 of 10 storage buckets are `public` (bypasses RLS entirely on read) and hold tenant training/media content.
- Backups/PITR/compute sizing cannot be confirmed from the CLI/API — must be checked in the Dashboard before launch.
- Production error tracking (Sentry) is wired to a placeholder DSN in the committed `.env.production`.

---

## B. Critical Blockers

| Priority | Area | Finding | Risk | Required Action |
|---|---|---|---|---|
| P1 | Monitoring | `VITE_SENTRY_DSN` in [.env.production](../.env.production:23) is the literal Sentry docs placeholder (`examplePublicKey@o0.ingest.sentry.io/0`) | Production errors are silently not reported unless Vercel env vars override this | Confirm real DSN is set in Vercel project settings; fix the committed file so it's not misleading |
| P1 | Disaster recovery | Backups / PITR status cannot be verified via API | Unknown RPO/RTO — you may not have a real recovery path if the DB is corrupted or `purge_archived_organizations` misfires | Check Dashboard → Database → Backups before launch; confirm PITR is on and retention matches your RPO needs |
| P2 | Auth | Leaked-password protection disabled; password minimum length is 6 | Weak/breached passwords accepted | Enable `password_hibp_enabled`, raise `password_min_length` to ≥8 |
| P2 | Legacy code | `has_profile_access()` still honors `public.user_roles.role = 'super_admin'` as an admin bypass, independent of the `platform_users`/`platform_role_assignments` system this app has otherwise migrated to | Currently inert (0 rows), but any future insert into `user_roles` with that role instantly grants cross-org profile read access | Remove the legacy branch or migrate it fully into `platform_operator_can()`, then confirm via test |

---

## C. Supabase Dashboard Manual Tasks (cannot be verified/changed via CLI here)

- **Backups & PITR**: confirm automated backups are on, check retention window, confirm point-in-time recovery is enabled if your plan supports it.
- **Compute size / connection pooler**: confirm the instance size and pooler (pgbouncer) settings match expected concurrent load for a multi-tenant SaaS launch.
- **Billing plan tier**: Free vs Pro vs Team changes backup retention, log retention window, and support SLA — confirm this matches launch expectations.
- **Custom SMTP sender reputation**: `smtp_host: smtp.resend.com` is configured (good — not using Supabase's shared/rate-limited SMTP), but domain/DKIM/SPF verification for `phg-connect.com` on Resend's side isn't checkable from here.
- **Google OAuth consent screen status** (testing vs published, verification status) — affects whether all Google accounts can sign in or only allow-listed test users.
- **Log retention window** for Postgres/Auth/Edge Function logs (affects how far back you can investigate an incident).

---

## D. Database Changes Recommended

| Priority | Table/Object | Current Problem | Recommended Change | Risk of Change |
|---|---|---|---|---|
| High | `public.has_profile_access()` | Legacy `user_roles.role='super_admin'` bypass, disconnected from the platform_users admin system | Drop that branch (or replace with `is_platform_super_admin()`) | Low — 0 rows currently depend on it; test after |
| Medium | 5 functions: `update_document_search_vector`, `_legacy_platform_fallback`, `search_knowledge_articles`, `secure_search_documents`, `secure_search_users` | Mutable `search_path` (not pinned) | Add `SET search_path = public, pg_temp` (matches pattern already used everywhere else in this project) | Very low — mechanical, same pattern as your existing `pin_search_path_*` migrations |
| Medium | `public.lessons` | 2 foreign keys (`lessons_created_by_fkey`, `lessons_source_document_id_fkey`) lack a covering index | Add indexes on `created_by`, `source_document_id` | Very low |
| Low | 10 tables (`brands`, `document_acknowledgments`, `document_comments`, `learning_assignment_exemptions`, `learning_assignment_user_overrides`, `notification_batches`, `notification_delivery_events`, `notification_queue`, and 2 more) | Duplicate permissive RLS policies for the same role+action (e.g. two separate SELECT policies both apply, planner runs both) | Merge into one policy per role/action with an `OR` condition | Low — logic-preserving if merged carefully; verify with a test query per table |
| Low | `public.role_permissions` | Write policies (`INSERT`/`UPDATE`/`DELETE`) target role `public` instead of `authenticated` | Narrow to `authenticated` (the `USING`/`CHECK` clause already blocks anon via `platform_operator_can()`, so this is defense-in-depth, not a live hole) | None |
| Info only | `brands` | Has both `organization_id` and `company_id` columns | Confirm which is the real tenant key; if `company_id` is legacy, plan removal | Needs investigation before changing |
| Info only | 27 tables in `archive`/`hotel_archive` schemas | No primary key | Not a concern — these are dated snapshot/archive tables (`_20260925` suffix), not live app tables. Add PKs only if you plan to query them regularly. | N/A |

**Not recommended:** don't blanket-add indexes for the "365 unused indexes" advisor finding. Row counts across this project are mostly in the tens/hundreds — this is a low-traffic system right now, so `idx_scan=0` is expected, not a signal. Revisit after real production traffic.

---

## E. Security Findings

| Severity | Finding | Impact | Evidence | Recommendation |
|---|---|---|---|---|
| HIGH | Legacy `super_admin` role bypass in `has_profile_access()` | Cross-tenant profile read/write if `user_roles` ever gets a `super_admin` row outside the sanctioned platform_users flow | Function definition inspected directly; 0 current rows | Remove legacy branch (see D) |
| MEDIUM | 4 storage buckets (`avatars`, `content-media`, `media`, `training-content`) are `public` | Public buckets bypass Storage RLS entirely on **read** — anyone with an object URL can fetch it regardless of tenant, if the URL ever leaks (referrer headers, browser history, screenshots, a misconfigured share) | `storage.buckets.public = true` confirmed via SQL | Since your DB-side RLS already prevents other tenants' object paths from being *returned* by the API, exposure is limited to true URL-guessing/leak scenarios. Confirm storage paths use non-sequential/UUID keys (not `org-1/lesson-2.mp4`). For genuinely sensitive per-tenant training content, consider signed URLs instead of a public bucket. |
| MEDIUM | Auth: leaked-password protection off, CAPTCHA off, `disable_signup=false` | Weak/breached passwords accepted; open Google-OAuth signup lets any Google account create an `auth.users` row (blocked from real access by org-membership checks, but adds noise/abuse surface) | Auth config pulled via Management API | Enable HIBP check; add CAPTCHA if bot signups become a problem; consider `disable_signup=true` if the product is meant to be fully invite-only |
| LOW | 2 `SECURITY DEFINER` functions callable by `anon`: `verify_certificate`, `log_security_audit_event_v2` | Public endpoints via `/rest/v1/rpc/...` | Advisor finding | Both look intentionally public (public cert verification page; pre-auth security event logging). Confirm intent, no action needed if so. |
| LOW | 163 `SECURITY DEFINER` functions callable by `authenticated` | Normal shape for an RPC-heavy Supabase app | Advisor finding | Not something to chase function-by-function; the RLS policies gating the underlying tables are the real control here, and those were spot-checked as sound. |
| INFO | Two separate CORS allow-lists exist in the codebase: [supabase/functions/_shared/cors.ts](../supabase/functions/_shared/cors.ts) and [vite.config.ts](../vite.config.ts:102)'s `VITE_ALLOWED_ORIGINS` default — they don't list the same domains (e.g. `altus-advisory.com` is in one, not the other) | Drift risk — a domain trusted in one layer but not the other | Code inspection | Consolidate into one source of truth, or document why they differ |
| INFO | No frontend exposure of service-role key found | — | Grepped `src/` for `SERVICE_ROLE`/`service_role_key` — no matches | Good, no action needed |
| INFO | `vault.decrypted_secrets` / `vault.secrets` grants are restricted to `postgres`/`service_role` only | — | `information_schema.role_table_grants` | Good — the service-role key stored in Vault for cron→edge-function calls can't leak via the API |

---

## F. Performance Findings

| Priority | Area | Finding | Recommendation |
|---|---|---|---|
| Low | `public.lessons` | 2 missing FK-covering indexes | Add indexes (see D) |
| Low | 10 tables | Duplicate permissive RLS policies double policy-evaluation cost per query | Consolidate (see D) |
| Info | 365 indexes show `idx_scan=0` | Misleading at current traffic levels (most tables have <100 rows) | Don't act on this now; re-run `get_advisors(type=performance)` after real production traffic accumulates, then prune truly unused indexes |
| Info | `pg_stat_monitor` extension available but not installed | You have `pg_stat_statements` installed, which covers query-level stats already | Only add `pg_stat_monitor` if you need per-client/per-plan histogram detail later |

---

## G. Multi-Tenant Isolation Findings

| Area | Isolated? | Mechanism | Notes |
|---|---|---|---|
| Organizations/tenants | ✅ Yes | `organizations` RLS: `is_platform_super_admin() OR id IN current_user_organization_ids() OR has_active_platform_session(id)` | Sound |
| Memberships | ✅ Yes | `organization_memberships` scoped by `current_user_organization_ids()` + `org_is_operational()` | Sound; correctly blocks self-promotion to `organization_owner` on insert |
| Roles/permissions | ✅ Yes (platform-level tables are intentionally global, not tenant-scoped) | `role_permissions`, `role_capabilities` are shared reference data, gated by `platform_operator_can('config.manage')` for writes | Correct design — these aren't tenant data |
| Profiles | ✅ Yes, with one caveat | `profiles_select`/`profiles_update` use `has_profile_access()` / `users_share_active_org()` | See legacy `super_admin` bypass (Finding B/E) |
| Training/courses/lessons/quizzes | ✅ Yes | All confirmed `organization_id`-scoped with RLS enabled and policy counts 4–6 per table | Not individually re-verified row-by-row beyond the schema pass, but pattern is consistent project-wide |
| Certificates | ✅ Yes | `org_visible(organization_id)` + owner-or-editor check | Sound |
| Documents | ✅ Yes | `multitenant_documents_*` policies check `current_user_organization_ids()` or active platform session, plus a master-template escape hatch gated by `is_platform_super_admin()` | Sound |
| Storage | ⚠️ Partial | DB-side (`storage.objects` RLS) not fully re-audited per-bucket; 4 buckets are `public` (bypasses RLS on read entirely) | See Finding E (medium) |
| Edge Functions | ⚠️ Mostly, spot-checked only | `process-ai-request` does its own auth despite `verify_jwt=false`; Slack functions have a shared signature-verification utility | Not every one of the 47 edge functions was individually read line-by-line — recommend a follow-up pass if you want per-function sign-off |
| Platform operator/admin access | ✅ Yes | Fully separate `platform_users`/`platform_role_assignments`/`role_capabilities` system, all `SECURITY DEFINER` + pinned `search_path`, identity always from `auth.uid()` | This is the "real" admin system — well isolated from tenant data |

---

## H. Cleanup Candidates

- **`ai-model-verifier-nightly` cron job is `active=false`** — either re-enable with a note on why it was disabled, or drop it; a disabled-but-present cron job is confusing during incident response.
- **`_legacy_platform_fallback` function** — name plus its presence in the "mutable search_path" list suggests this is a leftover from the pre-`platform_users` admin model (see migration `disable_legacy_platform_fallback`, `remove_legacy_platform_operator_altus_memberships`). Confirm it's actually unreferenced and drop it, or pin its search_path if still needed.
- **`user_roles.role='super_admin'` code path** — see Finding B.
- **`brands.company_id`** — duplicate tenant-key column alongside `organization_id`; confirm and consolidate.
- **Two CORS allow-lists** (`cors.ts` vs `vite.config.ts`) — consolidate to one source of truth.

Nothing above was deleted or modified — these are candidates for your review, per your rule #5.

---

## I. Production Launch Checklist

### MUST FIX BEFORE PRODUCTION
- [ ] Confirm/replace the placeholder Sentry DSN so error tracking actually works
- [ ] Verify backups + PITR are enabled in the Supabase Dashboard (cannot verify from here)
- [ ] Remove or neutralize the legacy `user_roles.role='super_admin'` bypass in `has_profile_access()`
- [ ] Enable leaked-password protection (`password_hibp_enabled`)

### SHOULD FIX BEFORE PRODUCTION
- [ ] Raise `password_min_length` from 6 to ≥8
- [ ] Decide on `disable_signup` given the invite-only product model
- [ ] Add covering indexes on `lessons.created_by`, `lessons.source_document_id`
- [ ] Pin `search_path` on the 5 remaining mutable functions
- [ ] Confirm storage object paths for public buckets are non-guessable (random keys, not sequential/predictable)
- [ ] Consolidate the two CORS allow-lists

### CAN FIX AFTER LAUNCH
- [ ] Consolidate duplicate permissive RLS policies on the 10 flagged tables (perf only)
- [ ] Narrow `role_permissions` write policies from `public` to `authenticated`
- [ ] Investigate/remove `brands.company_id` vs `organization_id` duplication
- [ ] Re-run the performance advisor after real traffic to find genuinely unused indexes
- [ ] Re-enable or remove the disabled `ai-model-verifier-nightly` cron job

### MANUAL SUPABASE DASHBOARD TASKS
- [ ] Backups/PITR retention window
- [ ] Compute size / connection pooler sizing
- [ ] Billing plan tier confirmation
- [ ] Google OAuth consent screen publish status
- [ ] Resend/SMTP domain verification (DKIM/SPF) for `phg-connect.com`

### OPERATIONAL TASKS
- [ ] Document the `purge_archived_organizations` grace-period/reversal window for whoever's on call — it's a well-built irreversible-delete job (audit-logged, gated by `purge_scheduled_at`), but only as safe as your backups
- [ ] Set up alerting on: Auth failures spike, Edge Function error rate, Postgres connection saturation, storage growth rate
- [ ] Decide who owns responding to future `get_advisors` runs (recommended: run after every significant schema change, per Supabase's own guidance)

---

## What was *not* independently re-verified

In the interest of giving you an honest audit rather than a padded one:
- Not all 47 Edge Functions were read line-by-line for input validation/idempotency — `process-ai-request` and the Slack functions were spot-checked because `verify_jwt=false` made them the highest-risk candidates.
- Not all 128 tables' individual RLS policies were read in full (only the tenant/admin/security-sensitive ones: profiles, organizations, memberships, platform_*, certificates, documents, sessions, mfa_secrets, password_history, role_permissions). The schema-wide pass (RLS enabled + policy count + tenant-column presence) covers all 128 tables, but per-policy logic was only manually read for the ones above.
- Storage `storage.objects` per-bucket write/delete policies were not individually enumerated — only bucket-level `public` flags were checked.
- No live cross-tenant penetration test was run (e.g., attempting an actual authenticated request as Tenant A against Tenant B's data) — findings are based on reading the policy/function definitions, not runtime exploitation.
