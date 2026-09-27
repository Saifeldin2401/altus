# Altus Connect

Multi-tenant learning and knowledge platform for hospitality teams: courses and
learning paths, a searchable knowledge base (SOPs, policies, guides), quizzes and
assessments, certificates, and learner gamification. Bilingual English / Arabic
with full right-to-left support.

> Infrastructure identifiers still use the historical `prime-hotels-*` names
> (repository, Supabase project). The product name is **Altus Connect**.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, TanStack Query 5, React Router 7 |
| i18n | i18next (`src/i18n/locales/{en,ar}`), logical CSS properties for RTL |
| Backend | Supabase: Postgres with row-level security, Auth, Storage, Edge Functions (Deno) |
| Monitoring | Sentry (errors, sampled session replay loaded after first paint) |
| Tests | Vitest + Testing Library, SQL integrity tests in `supabase/tests` |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and anon key
npm run dev                  # http://localhost:5173
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run verify` | lint + guardrails + typecheck + tests - run before every commit |
| `npm run typecheck` | TypeScript, app project |
| `npm run test:run` | Vitest once |
| `npm run check:guardrails` | project-specific rules (no fake data, known storage buckets, no direct certificate writes, ...) |
| `npm run check:migrations` | parses every SQL migration |
| `npm run db:types` | regenerates `src/types/database.generated.ts` from the live schema |
| `npm run build` | production build to `dist/` |

## Documentation

Start with **[docs/HANDOVER.md](docs/HANDOVER.md)** - architecture, security model,
deployment, operations and known open items. Older reports are kept for history in
`docs/archive/`.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.
