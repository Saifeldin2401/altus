# Supabase Production Configuration Audit — Dashboard/Platform Focus

**Project:** `dhbfaclkfysqwfppuxxa` ("connect v2"), `eu-west-1`, Postgres 17.6
**Audit date:** 2026-09-27
**Scope:** Platform/Dashboard-level configuration (Auth, Storage, Edge Functions, Email, Secrets, Realtime, API, Domains, Backups) — a companion to [SUPABASE_PRODUCTION_AUDIT.md](SUPABASE_PRODUCTION_AUDIT.md), which covers the database/RLS/code side. Read-only. Nothing in this document was changed automatically.

**Note on the code-side fix applied earlier today:** the `has_profile_access()` legacy `user_roles.role='super_admin'` bypass flagged in the previous audit has been removed (replaced with `is_platform_operator()`, the sanctioned platform-admin check) — this was explicitly approved before applying.

---

## Status after fixes (2026-09-27, end of day)

This supersedes anything below that conflicts with it.

**Fixed:**
- Auth Site URL → `https://phg-connect.com`; redirect allowlist includes `phg-connect.com`, `www`, `altus-connect.com`, and the Vercel aliases.
- `has_profile_access()` legacy `super_admin` bypass removed.
- `notification_batches` cross-tenant read closed (the "Authenticated can view all batches" policy).
- All 10 duplicate-permissive-policy tables consolidated; `search_path` pinned on the remaining functions; `lessons` FK indexes added; `_legacy_platform_fallback` dropped. Performance advisor: no WARN-level findings left.
- `password_min_length` 6 → 8; `smtp_admin_email` typo fixed.
- DMARC record added (`_dmarc.phg-connect.com`, `p=none`).
- Unused `SERVICE_ROLE_KEY` edge function secret deleted.
- Local `supabase/migrations` realigned with production history (401 = 401). Two superseded files moved to `archive/` — `20260927090700_tenant_scoped_search_and_arabic_fts.sql` must never be applied: production already has newer versions, and it reads `profiles.phone`, which `authenticated` can no longer select.

**Verified:**
- Tenant isolation, live test: impersonating Diyafh's organization owner under RLS returned 0 rows belonging to any other tenant (only platform-global rows and their own). Impersonating `anon` returned 0 rows across all 131 public tables.

**Corrections to this document:**
- SPF is **not** missing. Resend's SPF lives on `send.phg-connect.com` (`v=spf1 include:amazonses.com ~all`), which is the correct Resend setup. Only DMARC was missing.
- `altus-saifs-projects-dede158c.vercel.app` is **not** obsolete — it is the `altus` project's own automatic Vercel alias (team `saifs-projects-dede158c`). Keep it in the redirect allowlist.
- `.env.production` is not committed (it is gitignored); Sentry is off because Vercel has no `VITE_SENTRY_DSN` variable.
- Backups are confirmed, not unknown: `pitr_enabled: false`, `backups: []`. The project is on the **Free plan** (the API refused leaked-password protection with "available on Pro Plans and up").

**Still open (needs the owner):**
1. Upgrade to Pro → daily backups, PITR option, leaked-password protection.
2. Add `VITE_SENTRY_DSN` in Vercel (or install the Sentry Vercel integration).
3. Confirm the Google OAuth consent screen is published.
4. Redeploy the 11 edge functions that use the CORS allowlist change (`_shared/cors.ts` importers + `ai-model-verifier`) with the next normal release.
5. Decide whether `content-media`, `media`, and `training-content` should stay public buckets.
6. Revoke the `sbp_` Supabase access token used during this session.

---

## 1. Authentication → URL Configuration

**Site URL:** `https://phg-connect.com` — correct production domain, HTTPS, already fixed earlier this session (was previously a stale Vercel preview alias).

**Redirect URLs (current allowlist):**

| URL | Purpose | Status |
|---|---|---|
| `https://phg-connect.com`, `https://phg-connect.com/**` | Production apex | Keep |
| `https://www.phg-connect.com/**` | `www` variant (301s to apex via `vercel.json`, but Supabase still needs it allow-listed for the brief pre-redirect moment) | Keep |
| `https://altus-connect.com/**`, `https://www.altus-connect.com/**` | Alternate production domain referenced in CSP/CORS | Keep if this domain is actually live; verify it still resolves to this app |
| `https://altus-hospitality-erp.vercel.app`, `/**`, and `-*.vercel.app/**` preview wildcard | Current real Vercel project alias (confirmed via `_shared/cors.ts`) | Keep — this is the actual production/preview Vercel alias, not obsolete |
| `https://altus-saifs-projects-dede158c.vercel.app/` + `/**` + `altus-*-saifs-projects-dede158c.vercel.app` wildcard | Personal/legacy Vercel alias, was the previous (wrong) Site URL | **Candidate for removal** once you confirm nothing still deploys under this alias — kept for now since it was already there and removing wasn't in scope of what you approved |

Not present, and intentionally excluded per your instruction: `prime-hotels-intranet.vercel.app` (legacy name), `altus-advisory.com` / `connect.altusadvisory.com` (you asked to leave these out).

**Minimum secure set for how the app actually works:** login (Google OAuth + email/password) → `/login`; password reset → handled by the `public-forgot-password` edge function using `generateLink` + a custom branded email (not Supabase's native reset email), redirecting to `/reset-password`; invitations → `resend-user-invitation`/`create-user` edge functions generate their own links to `/complete-invite`. All of these resolve to paths already covered by the `phg-connect.com/**` wildcard, so the current allowlist is sufficient — no additional per-path entries are needed.

---

## 2. Authentication → Providers

| Provider | Enabled | Used by app? | Notes |
|---|---|---|---|
| Email/password | ✅ (`external_email_enabled`) | Yes (admin-created accounts, invite flow) | `mailer_autoconfirm=false` — confirmation required unless invited via admin flow (which auto-confirms via `admin.generateLink`) |
| Google OAuth | ✅ | Yes — primary sign-in path | Client ID/secret configured (production Google Cloud OAuth client) |
| Magic link | Not separately toggled (covered by email) | Not observed in code (`signInWithOAuth`/password flows only) | No action needed unless you want to offer it |
| Microsoft/Azure | ❌ disabled | No | Correct — leave disabled unless needed |
| Apple, GitHub, GitLab, Bitbucket, Discord, Facebook, Figma, Kakao, Keycloak, LinkedIn, Slack OIDC, Notion, Spotify, Twitch, Twitter/X, WorkOS, Zoom | ❌ all disabled | No | Correct — nothing to configure |
| Anonymous auth | ❌ disabled | No | Correct |
| Phone/SMS auth | ❌ disabled (`external_phone_enabled=false`) | No | Correct — no SMS provider credentials exist anyway (see §17) |
| Web3 (Solana/Ethereum) | ❌ disabled | No | Correct |

**Verdict:** provider configuration is clean and minimal — only what's used is enabled. **MANUAL SUPABASE DASHBOARD CHECK:** confirm the Google OAuth consent screen is in "Production" / verified status in Google Cloud Console, not "Testing" (which would cap sign-ins to an explicit test-user allowlist of 100 users and show an "unverified app" warning).

---

## 3. Authentication → Email

- **SMTP:** Custom SMTP is configured — `smtp_host: smtp.resend.com`, `smtp_user: resend`, `smtp_sender_name: "PHG system"`, `smtp_admin_email: notfications@phg-connect.com` (note: typo — "notfications" missing the second "i", should be "notifications"). This means you are **not** relying on Supabase's shared/rate-limited default mailer — good, this is what you want for production email volume.
- **Rate limit:** `rate_limit_email_sent: 25` — this is emails-per-hour via Supabase's own mailer path. Since password reset/invite emails are actually sent through your own `send-email` edge function + Resend directly (not through this path), this limit mostly affects native Supabase auth emails (e.g. signup confirmation if that flow is ever used directly).
- **DNS check (live, verified via public DNS just now):**
  - ✅ DKIM record present: `resend._domainkey.phg-connect.com` TXT record exists and is valid.
  - ❌ **SPF record missing** at `phg-connect.com` root (no TXT record found).
  - ❌ **DMARC record missing** at `_dmarc.phg-connect.com` (no TXT record found).

This is a real, verified gap: DKIM alone means receiving mail servers can verify Resend signed the message, but without SPF and DMARC, `phg-connect.com` has no policy telling mailbox providers what to do with mail that fails authentication, and no explicit authorization of Resend as a sending source via SPF. This measurably increases the chance of password-reset/invite emails landing in spam, especially at Gmail/Outlook/Yahoo given their 2024+ bulk-sender requirements (which require SPF + DKIM + DMARC together).

**Action required (outside Supabase, in your DNS provider — looks like Vercel DNS given `ns1.vercel-dns.com`):**
- Add an SPF TXT record at the root: `v=spf1 include:amazonses.com ~all` (Resend sends via AWS SES infrastructure — confirm the exact `include` value in your Resend domain settings) or Resend's documented SPF include.
- Add a DMARC TXT record at `_dmarc.phg-connect.com`, e.g. `v=DMARC1; p=none; rua=mailto:you@phg-connect.com;` to start (monitor-only), tightening to `p=quarantine`/`p=reject` later once you've confirmed alignment.

---

## 4. Authentication → Email Templates

**Finding: Supabase's built-in Auth email templates (confirmation, recovery, magic link, invite, email change, reauthentication, and all the "notification" templates like password-changed) are still 100% the Supabase default text/HTML** — `mailer_subjects_custom_contents` and `mailer_templates_custom_contents` both report every field as `false` (unmodified). Subjects are generic ("Confirm your email address", "Your sign-in link", etc.) with no PHG Connect / Altus branding, logo, or production URL customization baked into the template itself.

**This matters less than it looks, because of how your app actually sends auth-related emails:** password reset (`public-forgot-password`) and invitations (`resend-user-invitation`, `create-user`) generate a Supabase link server-side via `admin.generateLink`, then send the **actual email through your own `send-email` edge function** (which does use your branded `notification_email_templates` system — confirmed by migrations like `add_comprehensive_hotel_email_templates`, `update_email_sender_and_templates_to_altus`). So the unbranded Supabase templates are effectively bypassed for those two flows.

**Where the default templates would still fire:** if a user (or an admin script) ever triggers a native Supabase Auth email directly — e.g. a raw `supabase.auth.signUp()` self-service confirmation, a magic-link sign-in, or a reauthentication OTP — the recipient gets a generic, unbranded Supabase email. **Recommendation:** either confirm those native paths are never exposed in the UI, or customize the templates in Authentication → Email Templates as a defense-in-depth measure so there's no unbranded email a user could ever receive.

---

## 5. Authentication → Sessions

- `jwt_exp`: 3600s (1 hour) — standard, reasonable default.
- `refresh_token_rotation_enabled: true`, `security_refresh_token_reuse_interval: 10` — rotation is on with a 10-second reuse grace window (handles race conditions from concurrent tab refreshes without disabling rotation security). This is a solid, deliberate production setting, not a default left untouched.
- `sessions_single_per_user: false` — multiple concurrent sessions per user allowed (e.g., phone + desktop). Reasonable for a hotel-staff app where people switch devices.
- `sessions_inactivity_timeout` / `sessions_timebox`: currently unset (null = no forced timeout).

**Production implication:** for a hotel-operations SaaS with shared devices (front-desk terminals, tablets), an unset inactivity timeout means a session stays valid until the refresh token naturally expires or is revoked — on a shared/kiosk device this is a real risk if staff don't log out. This isn't "wrong" by default, but worth a deliberate decision: consider setting `sessions_inactivity_timeout` (e.g. 30–60 min) specifically if front-desk/shared-device use is common. Not recommending an aggressive blanket timeout since many users will be on personal devices where that would just be annoying.

---

## 6. Authentication → Rate Limits

| Limit | Value | Assessment |
|---|---|---|
| `rate_limit_anonymous_users` | 30/hr | Default; irrelevant since anonymous auth is disabled |
| `rate_limit_email_sent` | 25/hr | Supabase default; mostly moot given custom email path (§3) |
| `rate_limit_sms_sent` | 30/hr | Irrelevant, SMS disabled |
| `rate_limit_token_refresh` | 150/hr | Default |
| `rate_limit_verify` | 30/hr | Default (OTP/token verification attempts) |
| `rate_limit_otp` | 30/hr | Default |
| `rate_limit_web3` | 30/hr | Irrelevant, Web3 disabled |

**All of these are Supabase's out-of-the-box defaults — none have been intentionally tuned.** They're reasonable starting points, not obviously too permissive or restrictive for your current scale. Your application also has its own `rate_limit_entries` table and `failed_login_attempts` tracking, which is a more meaningful line of defense for login-specific abuse than these platform defaults. No urgent action, but worth revisiting `rate_limit_token_refresh` if you ever see automated/bot traffic hammering refresh.

---

## 7. Authentication → Attack Protection

- **CAPTCHA: disabled** (`security_captcha_enabled: false`). No CAPTCHA on signup, login, or password recovery.
- **Leaked password protection: disabled** (`password_hibp_enabled: false`) — new/changed passwords are not checked against HaveIBeenPwned.
- **Password minimum length: 6** — low for a system holding HR/financial data.
- No custom rate-limiting beyond the defaults in §6.

**MANUAL SUPABASE DASHBOARD CHECK (Authentication → Attack Protection):**
- Enable **"Leaked password protection"** — this is a single toggle, no cost, no user-facing friction unless a password is actually compromised.
- Consider enabling CAPTCHA (hCaptcha or Cloudflare Turnstile) if/when bot signups or credential-stuffing become a problem. Not urgent day one given Google OAuth is the primary path and email/password accounts are admin-provisioned, not self-serve.
- Raise password minimum length to 8–10 via Authentication → Policies.

**Operational note from this session:** while fixing your OAuth redirect URL earlier today, two `PATCH /config/auth` calls (scoped to `site_url`/`uri_allow_list` only) had the side effect of clearing three unrelated nullable fields: `security_captcha_provider` (was `"hcaptcha"`, now unset), `sms_provider` (was `"twilio"`, now unset), and `sessions_inactivity_timeout`/`sessions_timebox` (were `0`, now `null`). **This had zero functional impact** — CAPTCHA was already disabled either way, SMS auth was already non-functional (no Twilio secret exists), and `0`/`null` both mean "no timeout" — but it's worth knowing that this API endpoint doesn't do a true partial merge on every field. If you or I make further auth-config API/CLI changes later, we should fetch the full config first and be explicit about fields that matter.

---

## 8. Authentication → Multi-Factor Authentication

- **TOTP MFA is enabled** (`mfa_totp_enroll_enabled` / `mfa_totp_verify_enabled: true`), max 10 factors per user.
- Phone MFA and WebAuthn/passkey MFA: disabled.
- `mfa_allow_low_aal: false` — actions requiring MFA properly block at low assurance level (good, this is the secure setting).
- **MFA is optional, not enforced**, for everyone — this is a Supabase Auth platform setting (all-or-nothing per project); Supabase does not let you mandate MFA only for specific roles at the platform level.

**Recommendation (needs app-level enforcement, not a Supabase toggle):** Supabase can't natively require "platform operators must have MFA, regular tenant users don't." That has to be enforced in your own authorization logic — e.g., gate `platform_operator_can()`-protected actions on `auth.jwt()->>'aal' = 'aal2'` (i.e., require step-up MFA verification specifically for platform-operator/super-admin actions), while leaving regular tenant users on password/OAuth alone. I did not find this AAL-gating currently applied to `platform_operator_can()` or `is_platform_super_admin()` in the functions inspected in the companion audit — worth adding given how much these functions control.

---

## 9. Authentication → Auth Hooks

**None are configured.** `hook_custom_access_token_enabled`, `hook_mfa_verification_attempt_enabled`, `hook_password_verification_attempt_enabled`, `hook_send_sms_enabled`, `hook_send_email_enabled`, `hook_before_user_created_enabled`, `hook_after_user_created_enabled` are all `false`/unset.

This is fine — your app handles post-signup provisioning (organization membership, roles) through its own edge functions (`create-user`, `complete-invite-profile`) rather than Auth Hooks, which is a legitimate alternative architecture. No hook failure can block authentication since none exist. **No action needed** unless you specifically want to move that provisioning logic into a `after-user-created` hook later (not necessary).

---

## 10. Authentication → Audit Logs

Supabase's own Auth audit log (Dashboard → Authentication → Logs) retains events per your plan's log retention window (**MANUAL SUPABASE DASHBOARD CHECK** — Free plan typically has the shortest retention, often ~1 day; Pro extends this). Your application supplements this with its own `platform_audit_logs`, `failed_login_attempts`, and `system_events` tables (confirmed to exist and be actively written to, e.g. by `purge_archived_organizations`). **Recommendation:** don't rely on Supabase's native Auth logs as your system of record for security investigations given the short retention on lower plans — your own `platform_audit_logs` table is the more durable source, and that's already in place.

---

## 11. Authentication → OAuth Apps / OAuth Server

`oauth_server_enabled: false`, `oauth_server_allow_dynamic_registration: false`, `custom_oauth_enabled: false`. Neither feature is used — correct, since your app is an OAuth **consumer** (of Google) rather than an OAuth **provider** to third parties. No action needed; leave disabled.

---

## 12. Database Configuration

- **Version:** Postgres 17.6.1, `ga` release channel — current and stable, not a beta/preview channel. Good.
- **Extensions:** `pgcrypto`, `pg_stat_statements`, `btree_gist`, `uuid-ossp`, `pg_trgm`, `pg_net`, `pgmq`, `vector` (pgvector) all correctly installed into the `extensions` schema, not loosely into `public`. `pg_cron` installed into `pg_catalog` (Supabase's standard placement) with 7 active jobs. `supabase_vault`/`pgsodium` present for secret storage. No unnecessary or risky extensions found installed.
- **Connection pooling:** `supabase/config.toml` has `[db.pooler] enabled = false` — **this is the local development config only**, not necessarily what's active on the hosted project. **MANUAL SUPABASE DASHBOARD CHECK (Project Settings → Database → Connection pooling):** confirm PgBouncer/Supavisor pooling is enabled and in the right mode (transaction mode for typical serverless/edge-function usage) for the hosted project, and confirm the connection limit matches expected concurrent Edge Function + client load.
- **API exposure:** `pg_graphql` extension is available but not installed (`installed_version: null`) — GraphQL API is not exposed, which is fine since the app uses PostgREST/RPC exclusively.

---

## 13. Database → Backups / Point-in-Time Recovery

**Cannot be verified via CLI/API in this session** — the Management API tools available here don't expose backup/PITR status.

**MANUAL SUPABASE DASHBOARD CHECK (Project Settings → Database → Backups):**
- Confirm whether daily backups are enabled and their retention window.
- Confirm whether Point-in-Time Recovery is available/enabled — **PITR is generally a Pro-plan-and-above feature; it is not available on the Free plan at all**, per Supabase's published plan documentation. If this project is currently on Free, there is no PITR option regardless of configuration, and daily-backup retention is also shorter.
- Given this project has a `purge_archived_organizations` cron job that **permanently, irreversibly deletes** organizations and cascades to all their tenant data, backup/PITR configuration is not optional hygiene here — it is the only real safety net if that job (or a manual mistake) ever deletes the wrong thing. This should be treated as a launch blocker until confirmed, not a nice-to-have.

**On the Free plan question specifically:** I cannot see your billing/plan tier through the tools available in this session. If you tell me the plan, I can tell you exactly what backup/PITR capability you have per Supabase's current published limits; otherwise this needs a direct look at Project Settings → Billing.

---

## 14 & 15. Storage Configuration & File Security

| Bucket | Public? | Purpose (inferred) | Size limit | Assessment |
|---|---|---|---|---|
| `avatars` | ✅ public | Profile photos | 5 MB | Reasonable to be public — low sensitivity, standard pattern |
| `content-media` | ✅ public | Course/training media | 500 MB | **Review** — see below |
| `media` | ✅ public | General media assets | 500 MB | **Review** — see below |
| `training-content` | ✅ public | Training course content | 500 MB | **Review** — see below |
| `documents` | 🔒 private | General documents | 50 MB | Correct — private |
| `employee-documents` | 🔒 private | HR/employee files | 10 MB | Correct — private, sensitive |
| `announcement-attachments` | 🔒 private | Announcement files | 25 MB | Correct |
| `sop-attachments` | 🔒 private | SOP documents | 50 MB | Correct |
| `task-attachments` | 🔒 private | Task files | 20 MB | Correct |
| `reports-exports` | 🔒 private | Generated reports | 50 MB | Correct — reports likely contain sensitive cross-employee data |

**The three public content buckets are the one storage item worth a deliberate decision, not just "public = bad."** A `public` bucket in Supabase Storage skips RLS entirely for reads — anyone with the exact object URL can fetch it, tenant membership or not. Since this is a **multi-tenant SaaS** where each hotel/organization's training content is presumably their own proprietary material (not meant to be visible to a competing tenant), ask: is training/course video content meant to be freely viewable by URL (e.g., for CDN-friendly `<video>` embeds without signed-URL overhead), or should it be tenant-private?
- If **freely viewable by design** (common for training video delivery, since generating signed URLs per view adds latency/complexity): fine as-is, **provided object paths are non-guessable** (random UUID-based keys, not `org-slug/lesson-1.mp4`). This should be confirmed by checking the actual path-generation code, which wasn't done in this pass.
- If **meant to be tenant-private**: switch these buckets to private and serve content through signed URLs (Supabase Storage supports short-lived signed URLs cheaply) or a proxy edge function that checks `organization_id` membership first.

No dead/unused buckets found — all 10 map to a clear purpose. No buckets are missing.

---

## 16. Edge Functions

- **47 functions deployed, all `ACTIVE`.**
- `verify_jwt: false` on 7 functions: `process-ai-request`, `ai-model-verifier`, `public-forgot-password`, and the 4 `slack-*` functions. This is appropriate for all of them:
  - `public-forgot-password` — intentionally public by design (unauthenticated users need to request a reset).
  - `slack-commands`/`slack-events`/`slack-interactive`/`slack-training` — Slack calls these directly without a Supabase JWT; a shared `slack-utils.ts` provides signature-verification helpers (not individually re-confirmed as invoked in every one of the 4 files in this pass).
  - `process-ai-request` — implements its own manual bearer-token/API-key check in code despite `verify_jwt=false`, rather than relying on the platform gate. Functionally fine, but worth being aware this function is doing security-critical work that the platform's built-in JWT check isn't covering — any future refactor of this file needs to preserve that manual check carefully.
  - `ai-model-verifier` — only invoked by the (currently disabled) nightly cron job using the service-role key; since `verify_jwt=false`, this endpoint is technically callable by anyone on the public internet right now. **Recommend verifying it checks for a service-role/internal-secret bearer token internally** (not confirmed in this pass) since it triggers AI-provider API calls that cost money.
- No CORS misconfiguration found in the shared CORS helper (see companion audit, Section E) beyond the two-allowlist-drift note.

---

## 17. Secrets / Environment Variables

Names only — no values ever displayed.

| Secret | Exists | Likely used by | Production required | Status |
|---|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`, `SUPABASE_JWKS` | ✅ | Platform-injected, all Edge Functions | Yes | Auto-managed by Supabase, no action |
| `RESEND_API_KEY` | ✅ | `send-email`, invitation/reset flows | Yes | OK |
| `RESEND_WEBHOOK_SECRET` | ✅ | Inbound email webhook verification | Yes | OK |
| `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | ✅ | `send-email` | Yes | OK |
| `APP_BASE_URL` | ✅ | Link generation in edge functions | Yes | **Verify this value is `https://phg-connect.com`, not a stale Vercel URL** — same class of bug as the Auth redirect issue fixed earlier today, but this one lives in Supabase secrets, not Auth config, so it wasn't touched by that fix |
| `FIELD_ENCRYPTION_KEY` | ✅ | Encrypting sensitive DB fields (`encrypt-field` function) | Yes | OK — rotating this would break decryption of existing encrypted data, so treat as immutable, not something to casually rotate |
| `OPENAI_API_KEY`, `GROQ_API_KEY`, `HUGGINGFACE_TOKEN`, `HUGGINGFACE_MINIMAX_TOKEN` | ✅ | `process-ai-request` AI provider routing | Depends on which providers are actually routed to | OK |
| `VIRUSTOTAL_API_KEY` | ✅ | `scan-file` | Yes, if file-upload malware scanning is live | OK |
| `FIRECRAWL_API_KEY`, `FIRECRAWL_API_KEY_BACKUP`, `SCRAPER_API_KEY`, `SERPER_API_KEY`, `LIBRETRANSLATE_URL` | ✅ | Content/course-generation research tooling | Only if those features are live | OK |
| `TRANSLATION_CHUNK_CHARS`, `TRANSLATION_BATCH_CHUNKS`, `TRANSLATION_CONCURRENCY`, `TRANSLATION_CHUNK_CONCURRENCY` | ✅ | `ai-translation` tuning params | No (tuning, not a real secret) | Fine as-is |
| `SLACK_GUEST_REVIEWS_WEBHOOK` | ✅ | Slack integration | Only if that feature is live | OK |
| `SERVICE_ROLE_KEY` | ✅ | — | — | **Duplicate of `SUPABASE_SERVICE_ROLE_KEY`.** Two secrets holding what's very likely the same value under different names is a rotation hazard — if you ever rotate the service role key, you must remember both exist, or one becomes stale silently. Recommend consolidating to one name and updating whichever function reads the other. |
| `CF_API_TOKEN` (Cloudflare) | ❌ **not found** | Referenced directly via `Deno.env.get("CF_API_TOKEN")` in `process-ai-request/index.ts` | If Cloudflare AI routing is meant to be active | **Missing** — that provider path will silently fail/fall through to another provider at runtime. Verify intentional. |
| `OPENROUTER_API_KEY` | ❌ **not found** | Referenced directly in `process-ai-request/index.ts` | If OpenRouter routing is meant to be active | **Missing** — same as above |
| Gemini/Google AI key | ❌ **not found as an env secret** | `ai_reenable_gemini_fallback` migration implies Gemini is a configured fallback provider | Yes, if Gemini fallback is meant to work | Likely stored encrypted in the `ai_providers`/`ai_models` DB tables instead (via `FIELD_ENCRYPTION_KEY` or the `get_vault_secret` RPC) rather than as a platform secret — **not fully traced in this pass**, worth a quick confirmation that Gemini calls actually have a live credential somewhere |

No secrets appear to be development-only/placeholder values by name (can't check values). No obviously incorrectly-named secrets besides the `SERVICE_ROLE_KEY` duplication above.

---

## 18. Realtime

**Enabled**, with exactly 8 tables published: `assignments`, `document_department_access`, `documents`, `learning_assignment_exemptions`, `learning_assignment_user_overrides`, `notifications`, `profiles`, `training_progress`.

This is a deliberate, minimal set — not "everything exposed by default." Realtime subscriptions on Supabase are gated by the same RLS policies as normal queries (confirmed in the companion audit that all these tables have RLS enabled with tenant-scoped policies), so a subscriber can only receive change events for rows they could already `SELECT`. **No over-exposure found.** Realtime on `profiles` deserves a specific note: confirm no realtime payload accidentally includes PII columns beyond what `profiles_select`'s RLS would allow via a normal query (Realtime broadcasts full row changes, and Postgres RLS applies to the initial subscription filter, but do double check whether Realtime respects column-level restrictions the same way — Supabase Realtime is fundamentally row-level, not column-level, so if there's a view like the "restrict_profile_pii_columns" migration implies column-level PII protection at the query layer, that same protection may not apply to raw Realtime change payloads on the base `profiles` table).

---

## 19. API Configuration

- REST (PostgREST) is the only exposed API surface — GraphQL (`pg_graphql`) is not installed, consistent with the app's usage pattern.
- `max_rows` in `supabase/config.toml` is set to 1000 for local dev; **MANUAL SUPABASE DASHBOARD CHECK** to confirm the hosted project's PostgREST `db-max-rows` matches an intentional value (prevents an unbounded `select *` from ever returning the whole table).
- Anonymous (`anon`) role access: confirmed via the companion audit that RLS gates every table; `anon` role is not broadly granted `EXECUTE` on sensitive functions (only the 2 intentionally-public RPCs noted there).
- JWT: standard Supabase-issued JWTs, `jwt_exp=3600`, no custom JWT signing/hook configured.

Nothing found here that's unnecessarily exposed.

---

## 20. CORS / Domain / Origin Configuration

Two overlapping-but-not-identical allowlists exist in the codebase (flagged in the companion audit too):
- [supabase/functions/_shared/cors.ts](../supabase/functions/_shared/cors.ts): includes `altus-advisory.com`, `www.altus-advisory.com`, `connect.altusadvisory.com`, `prime-hotels-intranet.vercel.app` (legacy), `altus-hospitality-erp.vercel.app`, `www.phg-connect.com`, `phg-connect.com`, plus localhost for dev.
- [vite.config.ts](../vite.config.ts:102) `VITE_ALLOWED_ORIGINS` default: `phg-connect.com`, `www.phg-connect.com`, `altus-connect.com`, `www.altus-connect.com` — no `altus-advisory.com`.
- Supabase Auth `uri_allow_list` (just fixed): `phg-connect.com`+`www`, `altus-connect.com`+`www`, `altus-hospitality-erp.vercel.app` (+preview wildcard), plus the legacy `saifs-projects` Vercel alias.

**These three lists should describe the same set of "trusted origins for this app" but currently don't.** No wildcard-origin CORS (`*`) was found anywhere, which is the important thing — there's no over-permissive CORS. But recommend consolidating to one canonical list (e.g., a single exported constant imported by both the edge functions and the Vite config, or at minimum a comment in each file pointing at the other) so a future domain change doesn't get applied to only one of the three.

---

## 21. Custom Domain (on Supabase itself)

The Supabase project uses its default `dhbfaclkfysqwfppuxxa.supabase.co` URL — no Supabase custom domain is configured, and none is needed. Your actual user-facing domain (`phg-connect.com`) is a Vercel/frontend concern, not a Supabase one; the Supabase API URL being the default `*.supabase.co` domain is invisible to end users and doesn't need to change. **No action recommended** — a Supabase custom domain would only matter if you wanted to hide that the backend is Supabase-hosted (e.g., for white-labeling to your own customers as *their* backend), which doesn't appear to be a goal here.

---

## 22. Email / SMTP Production Readiness

Covered in detail in §3–4. Summary: custom SMTP (Resend) ✅, DKIM ✅, **SPF ❌ missing, DMARC ❌ missing** — these two are the concrete action items, and they're DNS changes at your registrar/Vercel DNS, not a Supabase setting.

---

## 23. Observability

- **Database logs, Auth logs, Edge Function logs:** available through Dashboard → Logs, retention depends on plan (**MANUAL SUPABASE DASHBOARD CHECK**).
- **`pg_stat_statements`** is installed — query-level performance stats are being collected, good foundation for investigating slow queries later.
- **Application-level monitoring:** Sentry is wired into the frontend (`@sentry/react` presumably, given `VITE_SENTRY_DSN`/`VITE_SENTRY_ENV`), but as flagged in the companion audit, the committed `.env.production` DSN is a placeholder — **confirm the real DSN is set as a Vercel environment variable**, since that's the only way this would actually work in production.
- **No Supabase-side alerting** (e.g., on error-rate spikes, connection exhaustion) was found configured — Supabase doesn't provide native alerting on the Free/Pro plans in the way a dedicated APM tool would; **MANUAL SUPABASE DASHBOARD CHECK** on whether your plan includes any usage/error alerting, otherwise this needs to live in Sentry/an external tool.

---

## 24. Supabase Advisors — Interpreted

(Full detail in the companion audit, Section E/F). In priority order, what actually matters:
1. **Matters, fix soon:** Leaked password protection disabled (auth).
2. **Matters, fix soon:** 5 functions with mutable `search_path` (mechanical, low-risk fix).
3. **Matters, low urgency:** 10 tables with duplicate permissive RLS policies (performance only, not a security hole).
4. **Informational, no action:** 2 `anon`-executable `SECURITY DEFINER` functions — both look intentionally public.
5. **Informational, no action:** 163 `authenticated`-executable `SECURITY DEFINER` functions — normal shape for an RPC-heavy app; the underlying table RLS is the real control.
6. **Informational, safe to ignore right now:** 365 "unused" indexes, 2 unindexed FKs on `lessons`, 27 "no primary key" tables — all in `archive`/`hotel_archive` schemas (cold storage, not live tables) or explained by low current traffic.

---

## 25. Project Settings — Broader Sweep

Beyond Auth (already covered exhaustively above):
- **General:** project name is "connect v2" internally — purely cosmetic, no action needed, but worth knowing the Dashboard won't show "Altus" or "PHG Connect" as the project name, which can cause confusion if you manage multiple Supabase projects.
- **API settings:** covered in §19.
- **Storage settings:** covered in §14–15.
- **Integrations:** none of Supabase's native third-party integrations (e.g., Vercel integration for auto env-var sync) were checked — **MANUAL SUPABASE DASHBOARD CHECK** if you want Supabase↔Vercel env var auto-sync (Integrations tab), otherwise you're manually keeping `.env.production`/Vercel env vars and Supabase secrets in sync, which is the `APP_BASE_URL` risk noted in §17.
- **Infrastructure:** compute size, region (`eu-west-1` — confirm this matches where your users/hotels are actually located, for latency), and pooler config — all **MANUAL SUPABASE DASHBOARD CHECK**.

---

## 26. Production Plan / Usage

I cannot see your current billing plan/tier through the tools available in this session (no billing/usage API was accessible). Rather than guess:

| Current capability | Expected requirement | Potential limitation | Action |
|---|---|---|---|
| Unknown plan tier | Real customer data, multi-tenant SaaS, needs backups | If Free: no PITR, short backup retention, short log retention, lower compute/connection limits | **Check Project Settings → Billing** and tell me the tier if you want a precise gap analysis against Supabase's current published limits for that tier |
| `eu-west-1` region, single region | Depends on where hotel customers are | If customers are outside the EU, added latency | Confirm region matches actual user base |

---

# SECTION 1 — PRODUCTION STATUS

**READY WITH CONFIGURATION REQUIRED.**

The database/RLS/application layer (covered in the companion audit) is genuinely strong. The gaps here are entirely in platform configuration that's easy to forget precisely because the app already works day-to-day: email authentication (SPF/DMARC), attack protection toggles, and — most importantly — **backup/PITR verification, which I could not confirm and which is the single most consequential unknown given this project has an automated irreversible-delete cron job.**

---

# SECTION 2 — MUST CONFIGURE BEFORE LAUNCH

| Area | Setting | Current State | Required State | Action |
|---|---|---|---|---|
| Backups | PITR / automated backups | Unknown (unverifiable via API) | Confirmed enabled with adequate retention | **Check Dashboard → Database → Backups now** |
| Email DNS | SPF | Missing | `v=spf1 include:<resend's SPF host> ~all` at `phg-connect.com` root | Add DNS TXT record |
| Email DNS | DMARC | Missing | `v=DMARC1; p=none; rua=mailto:...` at `_dmarc.phg-connect.com` | Add DNS TXT record |
| Auth | Leaked password protection | Off | On | Dashboard → Authentication → Attack Protection |
| Secrets | `APP_BASE_URL` | Unverified value | Must equal `https://phg-connect.com` | Check the secret's actual value in Dashboard → Edge Functions → Secrets |

---

# SECTION 3 — MANUAL SUPABASE DASHBOARD TASKS

**Authentication → URL Configuration**
- Verify: Site URL = `https://phg-connect.com` (already fixed this session)
- Consider removing the legacy `altus-saifs-projects-dede158c.vercel.app` redirect entries once confirmed unused

**Authentication → Attack Protection**
- Enable: Leaked password protection
- Configure: Raise minimum password length to 8–10
- Consider: CAPTCHA (hCaptcha/Turnstile) if bot signups become an issue

**Authentication → Providers → Google**
- Verify: Google Cloud OAuth consent screen is Published/Verified, not in Testing mode

**Authentication → Email Templates**
- Optional defense-in-depth: brand the native templates even though the two main flows bypass them (see §4)

**Database → Backups**
- Confirm automated backups + PITR status and retention (see §13 — this is the top-priority manual check)

**Database → Connection Pooling**
- Confirm pooler mode/connection limits for the hosted project (local `config.toml` setting doesn't reflect this)

**Project Settings → Billing**
- Confirm current plan tier; tell me the tier for a precise capability gap-check

**Project Settings → Integrations**
- Optional: Vercel↔Supabase env var sync, to reduce the `APP_BASE_URL`-drift risk in §17

**Edge Functions → Secrets**
- Verify `APP_BASE_URL` value is correct
- Decide whether `CF_API_TOKEN` / `OPENROUTER_API_KEY` should be added (currently missing, referenced in code)
- Consolidate `SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` duplication

**DNS provider (Vercel DNS, per `ns1.vercel-dns.com`)**
- Add SPF and DMARC TXT records (see §3/§22)

---

# SECTION 4 — ALREADY CORRECT (do not change)

- Site URL and redirect allowlist (fixed this session) ✅
- Custom SMTP via Resend, with DKIM already valid ✅
- MFA (TOTP) available and correctly scoped ✅
- Refresh token rotation with sensible reuse-interval grace period ✅
- OAuth providers minimal and correct (only Google + email enabled) ✅
- Auth Hooks correctly left unconfigured (app handles provisioning its own way) ✅
- OAuth Server/Apps correctly left disabled (not an OAuth provider) ✅
- Realtime scoped to exactly 8 tables, all RLS-protected ✅
- No wildcard CORS anywhere ✅
- No service-role key in frontend bundle ✅
- `vault.decrypted_secrets` correctly restricted to `postgres`/`service_role` ✅
- Extensions correctly namespaced into `extensions` schema, not loose in `public` ✅
- Storage buckets for genuinely sensitive data (HR docs, reports, SOPs) are correctly private ✅

---

# SECTION 5 — SECURITY RISKS

- Missing SPF/DMARC → email spoofing/deliverability risk (verified via live DNS lookup).
- Leaked password protection off → weak/breached passwords accepted.
- 3 public storage buckets hold potentially tenant-proprietary training content → cross-tenant visibility if a URL leaks (see §14–15 for the nuanced call).
- `ai-model-verifier` edge function has `verify_jwt=false` and wasn't confirmed to have an internal auth check → potential unauthenticated cost-abuse vector if it lacks one (not confirmed either way in this pass).
- `SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` duplication → rotation hazard, not an active exploit.

---

# SECTION 6 — OPTIONAL / POST-LAUNCH

- Brand the native Supabase Auth email templates (defense-in-depth only).
- CAPTCHA on auth forms.
- Session inactivity timeout, if shared/kiosk device usage turns out to be common.
- AAL2 (MFA step-up) enforcement specifically on platform-operator actions.
- Consolidate the three CORS/origin allowlists into one source of truth.
- Add `pg_stat_monitor` if you need deeper per-tenant query histograms later (not needed now, `pg_stat_statements` already covers baseline stats).

---

# SECTION 7 — CLEANUP

- Obsolete redirect URL candidate: `altus-saifs-projects-dede158c.vercel.app` (and its wildcard variant) in the Auth allowlist — was the old, wrong Site URL; confirm nothing still deploys there before removing.
- Obsolete/duplicate secret: `SERVICE_ROLE_KEY` alongside `SUPABASE_SERVICE_ROLE_KEY`.
- Obsolete cron job: `ai-model-verifier-nightly` is currently disabled (`active=false`) — decide to re-enable or drop.
- Development configuration living in a committed file: `.env.production`'s placeholder Sentry DSN.

**Nothing above was deleted.** All are candidates for your review per your explicit instruction.

---

# SECTION 8 — FINAL PRODUCTION CHECKLIST

### Supabase
- [ ] Confirm backups/PITR status and retention (Dashboard → Database → Backups)
- [ ] Confirm connection pooler configuration for the hosted project
- [ ] Confirm billing plan tier matches production risk profile

### Authentication
- [ ] Enable leaked password protection
- [ ] Raise minimum password length to 8–10
- [ ] Confirm Google OAuth consent screen is published/verified
- [ ] Remove legacy Vercel-preview entries from the redirect allowlist once confirmed unused
- [ ] Decide on CAPTCHA
- [ ] Decide on session inactivity timeout for shared/kiosk devices
- [ ] Add AAL2 step-up requirement for platform-operator actions (app-level)

### Email
- [ ] Add SPF TXT record for `phg-connect.com`
- [ ] Add DMARC TXT record for `_dmarc.phg-connect.com`
- [ ] Fix `smtp_admin_email` typo ("notfications" → "notifications")
- [ ] Optional: brand native Supabase Auth email templates

### Storage
- [ ] Decide: should `content-media`/`media`/`training-content` stay public, or move to signed URLs?
- [ ] Confirm public-bucket object paths are non-guessable

### Security
- [ ] Verify `ai-model-verifier` edge function enforces its own auth given `verify_jwt=false`
- [ ] Consolidate `SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`
- [ ] Add missing `CF_API_TOKEN`/`OPENROUTER_API_KEY` secrets, or confirm those providers are intentionally inactive
- [ ] Consolidate the 3 CORS/origin allowlists

### Monitoring
- [ ] Confirm real Sentry DSN is set in Vercel (not the placeholder)
- [ ] Confirm Dashboard log retention window meets your incident-investigation needs

### Backups
- [ ] (see Supabase section above — this is the top overall priority item)

### Domains
- [ ] Confirm `altus-connect.com` is still a live, intended production domain (or remove references)
- [ ] Confirm `APP_BASE_URL` secret value is `https://phg-connect.com`
