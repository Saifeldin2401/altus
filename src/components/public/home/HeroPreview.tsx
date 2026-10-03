import { m, useReducedMotion } from 'framer-motion'
import { BookOpenCheck, CheckCircle2, Flame, HandPlatter, ShieldCheck, Utensils } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// A fixed QR-style pattern for the illustrative certificate (decorative only).
const QR_ROWS = [
  '111111101',
  '100000101',
  '101110100',
  '101110111',
  '100000001',
  '111111101',
  '001010011',
  '110011101',
  '101101011',
]

function QrGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 9" className={className} shapeRendering="crispEdges" aria-hidden="true">
      {QR_ROWS.flatMap((row, y) =>
        row.split('').map((cell, x) => (cell === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
      )}
    </svg>
  )
}

function ScoreRing({ value }: { value: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-ds-surface-subtle" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        className="stroke-ds-success"
      />
    </svg>
  )
}

/**
 * Illustration of the learner workspace for the public homepage. It is a
 * picture of the product, not live data, so it is hidden from assistive tech.
 */
export function HeroPreview() {
  const { t } = useTranslation('public')
  const reduce = useReducedMotion()

  const courses = [
    { icon: HandPlatter, title: t('home.preview.courseA'), meta: t('home.preview.due', { count: 3 }), progress: 64, tone: 'brass' },
    { icon: Utensils, title: t('home.preview.courseB'), meta: t('home.preview.due', { count: 9 }), progress: 28, tone: 'brass' },
    { icon: Flame, title: t('home.preview.courseC'), meta: t('home.preview.done'), progress: 100, tone: 'success' },
  ] as const

  return (
    <div className="relative mx-auto w-full max-w-[560px] pb-24" aria-hidden="true">
      {/* soft light behind the window */}
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_40%,rgba(183,154,98,0.22),transparent_70%)] blur-2xl" />

      <div className="overflow-hidden rounded-[22px] border border-ds-border/80 bg-ds-surface shadow-[0_40px_90px_-40px_rgba(21,33,46,0.45),0_2px_6px_rgba(21,33,46,0.05)]">
        {/* window bar */}
        <div className="flex h-12 items-center justify-between border-b border-ds-border/70 bg-ds-chrome px-4">
          <div className="flex items-center gap-2.5">
            <img src="/altus-emblem-icon.png" alt="" className="h-6 w-7 object-cover object-[64%_50%]" />
            <span className="text-xs font-semibold tracking-tight text-ds-chrome-text">{t('home.preview.workspace')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-12 rounded-full bg-white/15" />
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-ds-chrome-accent to-[rgb(var(--cert-gold-deep))] ring-2 ring-white/10" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 bg-ds-background/60 p-4 sm:grid-cols-5 sm:p-5">
          {/* assigned courses */}
          <div className="rounded-2xl border border-ds-border/70 bg-ds-surface p-4 sm:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('home.preview.assigned')}</span>
              <BookOpenCheck className="h-4 w-4 text-ds-brass" />
            </div>
            <ul className="space-y-3">
              {courses.map(({ icon: Icon, title, meta, progress, tone }) => (
                <li key={title} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      tone === 'success' ? 'bg-ds-success-soft text-ds-success' : 'bg-ds-accent-soft text-ds-brass',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ds-ink">{title}</span>
                      <span className={cn('shrink-0 text-[10px] font-medium', tone === 'success' ? 'text-ds-success' : 'text-ds-muted')}>
                        {meta}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ds-surface-subtle">
                      <span
                        className={cn('block h-full rounded-full', tone === 'success' ? 'bg-ds-success' : 'bg-ds-brass')}
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* quiz result */}
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-ds-border/70 bg-ds-surface p-4 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('home.preview.quiz')}</span>
            <div className="flex items-center gap-3">
              <div className="relative">
                <ScoreRing value={92} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ds-ink">92%</span>
              </div>
              <span className="text-[11px] leading-snug text-ds-muted">{t('home.preview.score')}</span>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ds-success-soft px-2.5 py-1 text-[11px] font-semibold text-ds-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('home.preview.passed')}
            </span>
          </div>
        </div>
      </div>

      {/* floating certificate */}
      <m.div
        className="absolute bottom-0 start-[-6px] w-[230px] sm:start-[-28px] sm:w-[250px]"
        initial={reduce ? false : { opacity: 0, y: 24, rotate: -6 }}
        animate={reduce ? undefined : { opacity: 1, y: [0, -6, 0], rotate: -4 }}
        transition={
          reduce
            ? undefined
            : {
                opacity: { duration: 0.6, delay: 0.5 },
                rotate: { duration: 0.6, delay: 0.5 },
                y: { duration: 6, delay: 1.1, repeat: Infinity, ease: 'easeInOut' },
              }
        }
        style={reduce ? { transform: 'rotate(-4deg)' } : undefined}
      >
        <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--cert-gold)/0.55)] bg-[rgb(var(--cert-cream))] p-4 shadow-[0_24px_50px_-20px_rgba(11,28,62,0.45)]">
          <div className="pointer-events-none absolute inset-1.5 rounded-lg border border-[rgb(var(--cert-gold)/0.35)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--cert-gold-deep))]">
                {t('home.preview.certificate')}
              </p>
              <p className="mt-1 font-editorial text-lg font-semibold leading-tight text-[rgb(var(--cert-navy))]">
                {t('home.preview.courseC')}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--cert-gold-bright))] to-[rgb(var(--cert-gold-deep))] text-white shadow-inner">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="relative mt-3 flex items-end justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--cert-navy))] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--cert-gold-light))]">
              <CheckCircle2 className="h-3 w-3" />
              {t('home.preview.verifiable')}
            </span>
            <QrGlyph className="h-10 w-10 fill-[rgb(var(--cert-navy))]" />
          </div>
        </div>
      </m.div>
    </div>
  )
}
