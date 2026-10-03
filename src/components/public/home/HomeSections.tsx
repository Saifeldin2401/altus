import { m, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Compass,
  FileCheck2,
  Languages,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { HeroPreview } from './HeroPreview'
import { Reveal } from './Reveal'

export function Eyebrow({ children, inverted = false, className }: { children: React.ReactNode; inverted?: boolean; className?: string }) {
  return (
    <p className={cn('flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em]', inverted ? 'text-ds-chrome-accent' : 'text-ds-brass', className)}>
      <span className={cn('h-px w-8', inverted ? 'bg-ds-chrome-accent/60' : 'bg-ds-brass/50')} aria-hidden="true" />
      {children}
    </p>
  )
}

export const headingClass =
  'text-balance font-editorial font-semibold tracking-[-0.01em] leading-[1.14] rtl:font-sans rtl:font-bold rtl:leading-[1.3] rtl:tracking-normal'

/* ── Hero ─────────────────────────────────────────────────────────────── */

export function HomeHero() {
  const { t, i18n } = useTranslation('public')
  const isRTL = i18n.dir() === 'rtl'
  const reduce = useReducedMotion()
  const pillars = [
    { key: 'arabic', icon: Languages },
    { key: 'audit', icon: ShieldCheck },
    { key: 'ai', icon: Sparkles },
    { key: 'ksa', icon: Compass },
  ] as const

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ds-chrome text-white">
      <m.img
        src="/media/home/hero.webp"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_60%]"
        initial={reduce ? false : { scale: 1.08 }}
        animate={reduce ? undefined : { scale: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(11,20,32,0.94)_0%,rgba(11,20,32,0.78)_42%,rgba(11,20,32,0.25)_100%)] rtl:bg-[linear-gradient(260deg,rgba(11,20,32,0.94)_0%,rgba(11,20,32,0.78)_42%,rgba(11,20,32,0.25)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[rgba(11,20,32,0.9)] to-transparent" />

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-16 pt-32 sm:px-8 lg:pt-36">
        <Reveal className="max-w-3xl">
          <Eyebrow inverted>{t('home.hero.eyebrow')}</Eyebrow>
          <h1 className={cn(headingClass, 'mt-7 text-[46px] text-white sm:text-7xl lg:text-[88px] rtl:text-[42px] rtl:sm:text-6xl rtl:lg:text-[68px]')}>
            {t('home.hero.titleLead')}{' '}
            <span className="text-ds-chrome-accent">{t('home.hero.titleAccent')}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">{t('home.hero.body')}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="#contact"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-ds-chrome-accent px-8 text-[15px] font-semibold text-ds-chrome shadow-[0_18px_40px_-16px_rgba(183,154,98,0.8)] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ds-chrome"
            >
              {t('home.hero.primary')}
              <ArrowRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', isRTL && 'rotate-180 group-hover:-translate-x-0.5')} />
            </a>
            <a
              href="#platform"
              className="inline-flex h-14 items-center justify-center rounded-full border border-white/30 px-8 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t('home.hero.secondary')}
            </a>
          </div>
        </Reveal>
      </div>

      {/* value strip */}
      <div className="border-t border-white/10 bg-[rgba(11,20,32,0.55)] backdrop-blur-md">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 sm:px-8 lg:grid-cols-4">
          {pillars.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-center gap-3 py-5 lg:py-6">
              <Icon className="h-5 w-5 shrink-0 text-ds-chrome-accent" />
              <span className="text-sm font-medium text-white/85">{t(`home.pillars.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ── Why Altus ────────────────────────────────────────────────────────── */

export function HomeWhy() {
  const { t } = useTranslation('public')
  const points = ['expertise', 'region', 'partner'] as const

  return (
    <section id="why" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2 lg:gap-24">
        <Reveal className="relative">
          <div className="absolute -start-4 -top-4 h-full w-full rounded-[28px] border border-ds-brass/40" aria-hidden="true" />
          <img
            src="/media/home/lobby.webp"
            alt={t('home.why.imageAlt')}
            loading="lazy"
            className="relative aspect-[4/5] w-full rounded-[28px] object-cover shadow-[0_40px_80px_-40px_rgba(21,33,46,0.55)] sm:aspect-[5/5]"
          />
          <div className="absolute -bottom-8 end-6 max-w-[260px] rounded-2xl bg-ds-chrome p-6 text-white shadow-2xl sm:end-10">
            <p className="font-editorial text-2xl font-semibold leading-snug rtl:font-sans rtl:text-lg rtl:font-bold">{t('home.why.badgeTitle')}</p>
            <p className="mt-2 text-sm text-ds-chrome-muted">{t('home.why.badgeBody')}</p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Eyebrow>{t('home.why.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-5 text-4xl text-ds-ink sm:text-[54px] rtl:text-3xl rtl:sm:text-[42px]')}>{t('home.why.title')}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ds-ink-secondary">{t('home.why.body')}</p>
          <dl className="mt-10 space-y-7">
            {points.map((p, i) => (
              <div key={p} className="flex gap-5">
                <dt className="font-editorial text-3xl font-semibold leading-none text-ds-brass">0{i + 1}</dt>
                <dd>
                  <p className="text-base font-semibold text-ds-ink">{t(`home.why.points.${p}.title`)}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ds-muted">{t(`home.why.points.${p}.body`)}</p>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Outcomes ─────────────────────────────────────────────────────────── */

export function HomeOutcomes() {
  const { t } = useTranslation('public')
  const items = [
    { key: 'onboard', icon: Rocket },
    { key: 'comply', icon: FileCheck2 },
    { key: 'consistent', icon: Building2 },
  ] as const

  return (
    <section className="border-y border-ds-border/70 bg-ds-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow className="justify-center">{t('home.outcomes.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-5 text-4xl text-ds-ink sm:text-[54px] rtl:text-3xl rtl:sm:text-[42px]')}>{t('home.outcomes.title')}</h2>
        </Reveal>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {items.map(({ key, icon: Icon }, i) => (
            <Reveal key={key} delay={i * 0.08} className="h-full">
              <article className="group relative h-full overflow-hidden rounded-[24px] border border-ds-border/80 bg-ds-background/60 p-8 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-ds-brass/40 hover:shadow-[0_30px_60px_-35px_rgba(21,33,46,0.45)] sm:p-10">
                <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(183,154,98,0.18),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ds-chrome text-ds-chrome-accent">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-8 font-editorial text-[28px] font-semibold leading-tight text-ds-ink rtl:font-sans rtl:text-xl rtl:font-bold">
                  {t(`home.outcomes.${key}.title`)}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ds-muted">{t(`home.outcomes.${key}.body`)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Platform showcase ────────────────────────────────────────────────── */

export function HomePlatform() {
  const { t } = useTranslation('public')
  const features = [
    { key: 'assign', icon: ClipboardCheck },
    { key: 'certify', icon: BadgeCheck },
    { key: 'knowledge', icon: Users },
    { key: 'report', icon: TrendingUp },
  ] as const

  return (
    <section id="platform" className="relative isolate scroll-mt-20 overflow-hidden bg-ds-chrome py-24 text-white sm:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_85%_20%,rgba(183,154,98,0.2),transparent_65%),radial-gradient(40%_50%_at_0%_100%,rgba(183,154,98,0.1),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_70%_40%,black,transparent_80%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <Eyebrow inverted>{t('home.platform.eyebrow')}</Eyebrow>
          <h2 className={cn(headingClass, 'mt-5 text-4xl text-white sm:text-[54px] rtl:text-3xl rtl:sm:text-[42px]')}>{t('home.platform.title')}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ds-chrome-muted">{t('home.platform.body')}</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {features.map(({ key, icon: Icon }) => (
              <li key={key}>
                <Icon className="h-5 w-5 text-ds-chrome-accent" />
                <p className="mt-3 font-semibold text-white">{t(`home.platform.features.${key}.title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-ds-chrome-muted">{t(`home.platform.features.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.12}>
          <HeroPreview />
        </Reveal>
      </div>
    </section>
  )
}

/* ── Approach ─────────────────────────────────────────────────────────── */

export function HomeApproach() {
  const { t } = useTranslation('public')
  const steps = [
    { key: 'discover', icon: Compass },
    { key: 'configure', icon: Settings2 },
    { key: 'launch', icon: Rocket },
    { key: 'grow', icon: TrendingUp },
  ] as const

  return (
    <section id="approach" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>{t('home.approach.eyebrow')}</Eyebrow>
            <h2 className={cn(headingClass, 'mt-5 text-4xl text-ds-ink sm:text-[54px] rtl:text-3xl rtl:sm:text-[42px]')}>{t('home.approach.title')}</h2>
            <p className="mt-6 text-lg leading-relaxed text-ds-ink-secondary">{t('home.approach.body')}</p>
            <img
              src="/media/home/boardroom.webp"
              alt={t('home.approach.imageAlt')}
              loading="lazy"
              className="mt-10 hidden aspect-[16/10] w-full rounded-[24px] object-cover shadow-[0_30px_60px_-35px_rgba(21,33,46,0.5)] lg:block"
            />
          </Reveal>
          <div className="relative">
          <div className="absolute bottom-8 start-[3.6rem] top-8 w-px bg-gradient-to-b from-ds-brass/50 via-ds-border to-transparent sm:start-[3.85rem]" aria-hidden="true" />
          <ol className="relative space-y-5">
            {steps.map(({ key, icon: Icon }, i) => (
              <li key={key}>
                <Reveal delay={i * 0.08}>
                  <div className="relative flex gap-6 rounded-[24px] border border-ds-border/80 bg-ds-surface p-7 shadow-[0_1px_2px_rgba(21,33,46,0.04)] sm:p-8">
                    <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-ds-brass/30 bg-ds-accent-soft text-ds-brass">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ds-brass">
                        {t('home.approach.step', { n: i + 1 })}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-ds-ink">{t(`home.approach.steps.${key}.title`)}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-ds-muted">{t(`home.approach.steps.${key}.body`)}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Sign-in strip for existing customers ─────────────────────────────── */

export function HomeCustomers() {
  const { t, i18n } = useTranslation('public')
  const isRTL = i18n.dir() === 'rtl'
  return (
    <section className="pb-8">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-5 rounded-[24px] border border-ds-border/80 bg-ds-surface px-7 py-7 sm:flex-row sm:items-center sm:px-10">
            <div>
              <p className="text-lg font-semibold text-ds-ink">{t('home.customers.title')}</p>
              <p className="mt-1 text-sm text-ds-muted">{t('home.customers.body')}</p>
            </div>
            <Link
              to="/login"
              className="group inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-ds-chrome px-6 text-sm font-semibold text-white transition-colors hover:bg-ds-chrome-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass focus-visible:ring-offset-2"
            >
              {t('home.nav.signIn')}
              <ArrowRight className={cn('h-4 w-4 transition-transform group-hover:translate-x-0.5', isRTL && 'rotate-180 group-hover:-translate-x-0.5')} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
