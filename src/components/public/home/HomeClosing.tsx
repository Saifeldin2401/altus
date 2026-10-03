import { ArrowRight, Mail, MapPin, Send, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { BrandMark, LanguageToggle } from './HomeHeader'
import { Eyebrow, headingClass } from './HomeSections'
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
    if (value) navigate(`/verify/${encodeURIComponent(value)}`)
  }

  return (
    <section id="verify" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-[rgb(var(--cert-gold)/0.45)] bg-[rgb(var(--cert-cream))] px-6 py-12 sm:px-12">
            <div className="pointer-events-none absolute inset-2 rounded-[22px] border border-[rgb(var(--cert-gold)/0.3)]" aria-hidden="true" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--cert-gold-deep))]">{t('home.verify.eyebrow')}</p>
                <h2 className="mt-4 text-balance font-editorial text-4xl font-semibold leading-[1.05] text-[rgb(var(--cert-navy))] rtl:font-sans rtl:text-3xl rtl:font-bold rtl:leading-[1.3]">
                  {t('home.verify.title')}
                </h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-[rgb(var(--cert-navy)/0.75)]">{t('home.verify.body')}</p>
              </div>
              <form onSubmit={submit} className="rounded-2xl border border-[rgb(var(--cert-gold)/0.35)] bg-white/80 p-3 shadow-[0_20px_50px_-30px_rgba(11,28,62,0.5)]">
                <label htmlFor="home-verify-code" className="sr-only">{t('home.verify.label')}</label>
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
                      className="h-12 w-full rounded-xl border border-transparent bg-transparent pe-3 ps-10 font-mono text-sm uppercase tracking-wider text-[rgb(var(--cert-navy))] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[rgb(var(--cert-navy)/0.45)] focus:border-[rgb(var(--cert-gold)/0.6)] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--cert-gold)/0.15)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!code.trim()}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--cert-navy))] px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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

/* ── Demo request ─────────────────────────────────────────────────────── */

const fieldClass =
  'h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/40 transition-colors focus:border-ds-chrome-accent focus:bg-white/[0.09] focus:outline-none focus:ring-4 focus:ring-ds-chrome-accent/15'

/**
 * Collects the essentials and hands them to the visitor's mail client,
 * addressed to the sales inbox. Nothing is stored by the app.
 */
export function HomeContact() {
  const { t } = useTranslation('public')
  const [form, setForm] = useState({ name: '', email: '', company: '', hotels: '', message: '' })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const subject = t('home.contact.mailSubject', { company: form.company || form.name })
    const body = [
      `${t('home.contact.name')}: ${form.name}`,
      `${t('home.contact.email')}: ${form.email}`,
      `${t('home.contact.company')}: ${form.company}`,
      `${t('home.contact.hotels')}: ${form.hotels}`,
      '',
      form.message,
    ].join('\n')
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const hotelOptions = ['1', '2-5', '6-20', '20+'] as const

  return (
    <section id="contact" className="scroll-mt-20 pb-24 sm:pb-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[32px] bg-ds-chrome px-6 py-14 text-white sm:px-12 sm:py-16 lg:px-16">
            <img src="/media/home/lobby.webp" alt="" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-20" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,rgba(21,33,46,0.97)_35%,rgba(21,33,46,0.85))]" />
            <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              <div>
                <Eyebrow inverted>{t('home.contact.eyebrow')}</Eyebrow>
                <h2 className={cn(headingClass, 'mt-5 text-4xl text-white sm:text-[52px] rtl:text-3xl rtl:sm:text-[40px]')}>{t('home.contact.title')}</h2>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-ds-chrome-muted">{t('home.contact.body')}</p>
                <ul className="mt-10 space-y-4 text-sm">
                  {(['one', 'two', 'three'] as const).map((k) => (
                    <li key={k} className="flex items-start gap-3 text-white/85">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ds-chrome-accent" />
                      {t(`home.contact.promise.${k}`)}
                    </li>
                  ))}
                </ul>
                <div className="mt-10 space-y-3 border-t border-white/10 pt-8 text-sm text-white/75">
                  <a href={`mailto:${SALES_EMAIL}`} className="flex items-center gap-3 hover:text-white">
                    <Mail className="h-4 w-4 text-ds-chrome-accent" />
                    <span dir="ltr">{SALES_EMAIL}</span>
                  </a>
                  <p className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-ds-chrome-accent" />
                    {t('home.contact.location')}
                  </p>
                </div>
              </div>

              <form onSubmit={submit} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/70">{t('home.contact.name')}</span>
                    <input required value={form.name} onChange={set('name')} autoComplete="name" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/70">{t('home.contact.email')}</span>
                    <input required type="email" value={form.email} onChange={set('email')} autoComplete="email" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/70">{t('home.contact.company')}</span>
                    <input required value={form.company} onChange={set('company')} autoComplete="organization" className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/70">{t('home.contact.hotels')}</span>
                    <select value={form.hotels} onChange={set('hotels')} className={cn(fieldClass, 'appearance-none')}>
                      <option value="" className="text-ds-ink">{t('home.contact.hotelsPlaceholder')}</option>
                      {hotelOptions.map((o) => (
                        <option key={o} value={o} className="text-ds-ink">{o}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-white/70">{t('home.contact.message')}</span>
                    <textarea
                      rows={4}
                      value={form.message}
                      onChange={set('message')}
                      placeholder={t('home.contact.messagePlaceholder')}
                      className={cn(fieldClass, 'h-auto resize-none py-3')}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ds-chrome-accent px-8 text-[15px] font-semibold text-ds-chrome transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ds-chrome"
                >
                  <Send className="h-4 w-4" />
                  {t('home.contact.submit')}
                </button>
                <p className="mt-4 text-center text-xs text-white/50">{t('home.contact.note')}</p>
              </form>
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
  const linkClass = 'text-sm text-ds-chrome-muted transition-colors hover:text-white'

  return (
    <footer className="bg-ds-chrome text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <BrandMark inverted />
          <p className="mt-5 text-sm leading-relaxed text-ds-chrome-muted">{t('home.footer.about')}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ds-chrome-accent">{t('home.footer.platform')}</p>
          <ul className="mt-5 space-y-3">
            <li><a href="#platform" className={linkClass}>{t('home.nav.platform')}</a></li>
            <li><a href="#approach" className={linkClass}>{t('home.nav.approach')}</a></li>
            <li><Link to="/verify" className={linkClass}>{t('home.nav.verify')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ds-chrome-accent">{t('home.footer.company')}</p>
          <ul className="mt-5 space-y-3">
            <li><a href="#why" className={linkClass}>{t('home.nav.why')}</a></li>
            <li><a href="#contact" className={linkClass}>{t('home.nav.demo')}</a></li>
            <li><a href={`mailto:${SALES_EMAIL}`} className={linkClass}>{t('home.nav.contact')}</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ds-chrome-accent">{t('home.footer.customers')}</p>
          <ul className="mt-5 space-y-3">
            <li><Link to="/login" className={linkClass}>{t('home.nav.signIn')}</Link></li>
            <li><Link to="/forgot-password" className={linkClass}>{t('home.footer.forgot')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-6 text-xs text-ds-chrome-muted sm:flex-row sm:items-center sm:px-8">
          <p>{t('home.footer.rights', { year })}</p>
          <LanguageToggle className="-mx-2.5 text-ds-chrome-muted hover:text-white" />
        </div>
      </div>
    </footer>
  )
}
