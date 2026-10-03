import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Languages,
  ListChecks,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { HeroPreview } from './HeroPreview'
import { Reveal } from './Reveal'

function Eyebrow({ children, inverted = false }: { children: React.ReactNode; inverted?: boolean }) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.18em]',
        inverted ? 'text-ds-chrome-accent' : 'text-ds-brass',
      )}
    >
      {children}
    </p>
  )
}

const headingClass =
  'text-balance font-editorial font-semibold tracking-[-0.015em] leading-[1.05] rtl:font-sans rtl:font-bold rtl:leading-[1.3] rtl:tracking-normal'

/* ── Hero ─────────────────────────────────────────────────────────────── */

export function HomeHero() {
  const { t, i18n } = useTranslation('public')
  const isRTL = i18n.dir() === 'rtl'

  return (
    <section className="relative isolate overflow-hidden">
      {/* backdrop: warm light and a faint architectural grid */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_85%_0%,rgba(183,154,98,0.16),transparent_70%),radial-gradient(50%_40%_at_0%_30%,rgba(21,33,46,0.05),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(21,33,46,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(21,33,46,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent_75%)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-16">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-ds-brass/25 bg-ds-surface/70 px-3 py-1 text-xs font-medium text-ds-ink-secondary shadow-[0_1px_2px_rgba(21,33,46,0.04)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-ds-brass" />
            {t('home.hero.eyebrow')}
          </span>

          <h1 className={cn(headingClass, 'mt-6 text-[46px] text-ds-ink sm:text-6xl lg:text-[76px] rtl:text-[40px] rtl:sm:text-5xl rtl:lg:text-[60px]')}>
            {t('home.hero.titleLead')}
            <br />
            <span className="text-ds-brass">{t('home.hero.titleAccent')}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-ds-ink-secondary sm:text-lg">
            {t('home.hero.body')}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/login"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ds-chrome px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(21,33,46,0.6)] transition-colors hover:bg-ds-chrome-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ds-background"
            >
              {t('home.hero.primary')}
              <ArrowRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', isRTL && 'rotate-180 group-hover:-translate-x-0.5')} />
            </Link>
            <Link
              to="/verify"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-ds-border-strong bg-ds-surface/80 px-6 text-sm font-semibold text-ds-ink transition-colors hover:border-ds-brass/50 hover:bg-ds-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass"
            >
              <ShieldCheck className="h-4 w-4 text-ds-brass" />
              {t('home.hero.secondary')}
            </Link>
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-ds-muted">
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            {t('home.hero.note')}
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <HeroPreview />
        </Reveal>
      </div>
    </section>
  )
}

/* ── The loop ─────────────────────────────────────────────────────────── */

export function HomeLoop() {
  const { t } = useTranslation('public')
  const steps = [
    { key: 'assign', icon: ListChecks },
    { key: 'learn', icon: BookOpen },
    { key: 'assess', icon: ClipboardCheck },
    { key: 'certify', icon: Award },
    { key: 'prove', icon: FileCheck2 },
  ] as const

  return (
    <section id="how-it-works" className="relative isolate scroll-mt-16 overflow-hidden bg-ds-chrome py-24 text-white sm:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(183,154,98,0.18),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(183,154,98,0.08),transparent_60%)]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow inverted>{t('home.loop.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-4 text-4xl text-white sm:text-5xl rtl:text-3xl rtl:sm:text-4xl')}>
            {t('home.loop.title')}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-ds-chrome-muted sm:text-lg">{t('home.loop.body')}</p>
        </Reveal>

        <ol className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {/* connecting rule on wide screens */}
          <div className="absolute inset-x-[10%] top-7 hidden h-px bg-gradient-to-r from-transparent via-ds-chrome-accent/40 to-transparent lg:block" aria-hidden="true" />
          {steps.map(({ key, icon: Icon }, i) => (
            <li key={key}>
              <Reveal delay={i * 0.08} className="relative h-full">
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors hover:border-ds-chrome-accent/40 hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-ds-chrome-accent/30 bg-ds-chrome text-ds-chrome-accent">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-3xl font-semibold tabular-nums tracking-tight text-white/15">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-white">{t(`home.loop.steps.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ds-chrome-muted">{t(`home.loop.steps.${key}.body`)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ── Roles ────────────────────────────────────────────────────────────── */

export function HomeRoles() {
  const { t } = useTranslation('public')
  const roles = [
    { key: 'learner', icon: GraduationCap },
    { key: 'author', icon: PenLine },
    { key: 'manager', icon: ClipboardCheck },
    { key: 'admin', icon: UserCog },
  ] as const

  return (
    <section id="roles" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>{t('home.roles.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-4 text-4xl text-ds-ink sm:text-5xl rtl:text-3xl rtl:sm:text-4xl')}>
            {t('home.roles.title')}
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map(({ key, icon: Icon }, i) => (
            <Reveal key={key} delay={i * 0.07} className="h-full">
              <article className="group flex h-full flex-col rounded-2xl border border-ds-border/80 bg-ds-surface p-6 shadow-[0_1px_2px_rgba(21,33,46,0.04)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-ds-brass/40 hover:shadow-[0_24px_48px_-28px_rgba(21,33,46,0.35)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ds-accent-soft text-ds-brass transition-colors group-hover:bg-ds-brass group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ds-ink">{t(`home.roles.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ds-muted">{t(`home.roles.${key}.body`)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Knowledge ────────────────────────────────────────────────────────── */

function KnowledgePreview() {
  const { t } = useTranslation('public')
  const results = [
    { title: t('home.knowledge.resultA'), type: t('home.knowledge.typeSop') },
    { title: t('home.knowledge.resultB'), type: t('home.knowledge.typeGuide') },
    { title: t('home.knowledge.resultC'), type: t('home.knowledge.typePolicy') },
  ]

  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(60%_60%_at_40%_50%,rgba(183,154,98,0.16),transparent_70%)] blur-2xl" />
      <div className="rounded-[22px] border border-ds-border/80 bg-ds-surface p-5 shadow-[0_40px_90px_-45px_rgba(21,33,46,0.45)] sm:p-6">
        <div className="flex items-center gap-3 rounded-xl border border-ds-brass/40 bg-ds-background/60 px-4 py-3 ring-4 ring-ds-brass/10">
          <Search className="h-4 w-4 shrink-0 text-ds-brass" />
          <span className="truncate text-sm text-ds-ink">{t('home.knowledge.query')}</span>
          <span className="ms-auto h-4 w-px animate-pulse bg-ds-ink/60" />
        </div>
        <ul className="mt-4 divide-y divide-ds-border/70">
          {results.map((r, i) => (
            <li key={r.title} className="flex items-center gap-3 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ds-surface-subtle text-ds-ink-secondary">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ds-ink">{r.title}</span>
                <span className="mt-1 block h-1.5 w-2/3 rounded-full bg-ds-surface-subtle" />
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  i === 0 ? 'bg-ds-accent-soft text-ds-brass' : i === 1 ? 'bg-ds-info-soft text-ds-info' : 'bg-ds-success-soft text-ds-success',
                )}
              >
                {r.type}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function HomeKnowledge() {
  const { t } = useTranslation('public')
  const points = ['types', 'review', 'current'] as const

  return (
    <section id="knowledge" className="scroll-mt-16 border-y border-ds-border/70 bg-ds-surface py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Eyebrow>{t('home.knowledge.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-4 text-4xl text-ds-ink sm:text-5xl rtl:text-3xl rtl:sm:text-4xl')}>
            {t('home.knowledge.title')}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ds-ink-secondary sm:text-lg">{t('home.knowledge.body')}</p>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ds-accent-soft text-ds-brass">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm leading-relaxed text-ds-ink-secondary sm:text-[15px]">{t(`home.knowledge.points.${p}`)}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.12}>
          <KnowledgePreview />
        </Reveal>
      </div>
    </section>
  )
}

/* ── Capabilities ─────────────────────────────────────────────────────── */

export function HomeCapabilities() {
  const { t } = useTranslation('public')
  const items = [
    { key: 'ai', icon: Sparkles },
    { key: 'language', icon: Languages },
    { key: 'structure', icon: Building2 },
    { key: 'evidence', icon: FileCheck2 },
  ] as const

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <Eyebrow>{t('home.capabilities.eyebrow')}</Eyebrow>
            <h2 className={cn(headingClass, 'mt-4 text-4xl text-ds-ink sm:text-5xl rtl:text-3xl rtl:sm:text-4xl')}>
              {t('home.capabilities.title')}
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ds-ink-secondary">{t('home.capabilities.body')}</p>
          </Reveal>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-ds-border/80 bg-ds-border/80 sm:grid-cols-2">
            {items.map(({ key, icon: Icon }, i) => (
              <Reveal key={key} delay={i * 0.07} className="h-full bg-ds-surface">
                <div className="h-full p-7">
                  <Icon className="h-6 w-6 text-ds-brass" />
                  <h3 className="mt-5 text-base font-semibold text-ds-ink">{t(`home.capabilities.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ds-muted">{t(`home.capabilities.${key}.body`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
