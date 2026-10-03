import { ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { BrandMark, LanguageToggle } from './HomeHeader'
import { Reveal } from './Reveal'

const SALES_EMAIL = 'sales@altus-advisory.com'

/* ── Certificate verification ─────────────────────────────────────────── */

export function HomeVerify() {
  const { t, i18n } = useTranslation('public')
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const isRTL = i18n.dir() === 'rtl'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = code.trim()
    if (!value) return
    navigate(`/verify/${encodeURIComponent(value)}`)
  }

  return (
    <section id="verify" className="scroll-mt-16 pb-24 sm:pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-[rgb(var(--cert-gold)/0.45)] bg-[rgb(var(--cert-cream))] px-6 py-12 sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-[rgb(var(--cert-gold)/0.3)]" aria-hidden="true" />
            <div
              className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(197,160,89,0.28),transparent_70%)]"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--cert-gold-deep))]">
                  {t('home.verify.eyebrow')}
                </p>
                <h2 className="mt-4 text-balance font-editorial text-4xl font-semibold leading-[1.05] tracking-[-0.015em] text-[rgb(var(--cert-navy))] sm:text-5xl rtl:font-sans rtl:text-3xl rtl:font-bold rtl:leading-[1.3] rtl:sm:text-4xl">
                  {t('home.verify.title')}
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-[rgb(var(--cert-navy)/0.75)]">{t('home.verify.body')}</p>
              </div>

              <form onSubmit={submit} className="rounded-2xl border border-[rgb(var(--cert-gold)/0.35)] bg-white/80 p-3 shadow-[0_20px_50px_-30px_rgba(11,28,62,0.5)] backdrop-blur">
                <label htmlFor="home-verify-code" className="sr-only">
                  {t('home.verify.label')}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <ShieldCheck className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--cert-gold-deep))]" />
                    <input
                      id="home-verify-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={t('home.verify.placeholder')}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-12 w-full rounded-xl border border-transparent bg-transparent ps-10 pe-3 font-mono text-sm uppercase tracking-wider text-[rgb(var(--cert-navy))] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[rgb(var(--cert-navy)/0.45)] focus:border-[rgb(var(--cert-gold)/0.6)] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--cert-gold)/0.15)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!code.trim()}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--cert-navy))] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cert-gold))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('home.verify.submit')}
                    <ArrowRight className={cn('h-4 w-4', isRTL && 'rotate-180')} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Closing call to action ───────────────────────────────────────────── */

export function HomeCta() {
  const { t } = useTranslation('public')
  const subject = encodeURIComponent(t('home.cta.subject'))

  return (
    <section className="pb-24 sm:pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[28px] bg-ds-chrome px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(55%_90%_at_50%_0%,rgba(183,154,98,0.28),transparent_65%)]" aria-hidden="true" />
            <div
              className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent_80%)]"
              aria-hidden="true"
            />
            <img src="/altus-emblem-icon.png" alt="" className="mx-auto h-16 w-20 object-cover object-[64%_50%]" />
            <h2 className="mx-auto mt-8 max-w-3xl text-balance font-editorial text-4xl font-semibold leading-[1.08] tracking-[-0.015em] text-white sm:text-5xl rtl:font-sans rtl:text-3xl rtl:font-bold rtl:leading-[1.35] rtl:sm:text-4xl">
              {t('home.cta.title')}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ds-chrome-muted">{t('home.cta.body')}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={`mailto:${SALES_EMAIL}?subject=${subject}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ds-chrome-accent px-6 text-sm font-semibold text-ds-chrome transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ds-chrome"
              >
                <Mail className="h-4 w-4" />
                {t('home.cta.contact')}
              </a>
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('home.cta.signIn')}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Footer ───────────────────────────────────────────────────────────── */

export function HomeFooter() {
  const { t } = useTranslation('public')
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-ds-border/70 bg-ds-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <BrandMark />
          <p className="text-xs text-ds-muted">{t('home.footer.rights', { year })}</p>
        </div>
        <nav aria-label={t('home.footer.label')} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ds-ink-secondary">
          <Link to="/login" className="hover:text-ds-ink">{t('home.nav.signIn')}</Link>
          <Link to="/verify" className="hover:text-ds-ink">{t('home.nav.verify')}</Link>
          <a href={`mailto:${SALES_EMAIL}`} className="hover:text-ds-ink">{t('home.cta.contact')}</a>
          <LanguageToggle className="-mx-2.5 text-ds-ink-secondary hover:text-ds-ink" />
        </nav>
      </div>
    </footer>
  )
}
