import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const { t } = useTranslation('public')
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img src="/altus-emblem-icon.png" alt="" className="h-10 w-12 shrink-0 object-cover object-[64%_50%]" />
      <span className="leading-none">
        <span className={cn('block whitespace-nowrap text-[15px] font-semibold tracking-tight transition-colors', inverted ? 'text-white' : 'text-ds-ink')}>
          Altus Connect
        </span>
        <span
          className={cn(
            'mt-1 hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] transition-colors sm:block',
            inverted ? 'text-ds-chrome-accent' : 'text-ds-brass',
          )}
        >
          {t('home.brandTagline')}
        </span>
      </span>
    </span>
  )
}

export function LanguageToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith('ar')
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(isArabic ? 'en' : 'ar')}
      lang={isArabic ? 'en' : 'ar'}
      className={cn(
        'min-h-[40px] rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass',
        className,
      )}
    >
      {isArabic ? 'English' : 'العربية'}
    </button>
  )
}

/** Transparent over the photographic hero, solid ivory once the page scrolls. */
export function HomeHeader() {
  const { t } = useTranslation('public')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#why', label: t('home.nav.why') },
    { href: '#platform', label: t('home.nav.platform') },
    { href: '#approach', label: t('home.nav.approach') },
    { href: '#contact', label: t('home.nav.contact') },
  ]
  const onDark = !scrolled

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300',
        scrolled ? 'border-b border-ds-border/70 bg-ds-background/90 shadow-sm backdrop-blur-md' : 'border-b border-white/10 bg-transparent',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="Altus Connect" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass">
          <BrandMark inverted={onDark} />
        </Link>

        <nav aria-label={t('home.nav.label')} className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass',
                onDark ? 'text-white/80 hover:text-white' : 'text-ds-ink-secondary hover:text-ds-ink',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle className={onDark ? 'text-white/75 hover:text-white' : 'text-ds-muted hover:text-ds-ink'} />
          <Link
            to="/login"
            className={cn(
              'hidden min-h-[40px] items-center rounded-md px-3 text-sm font-semibold transition-colors sm:inline-flex',
              onDark ? 'text-white hover:text-ds-chrome-accent' : 'text-ds-ink hover:text-ds-brass',
            )}
          >
            {t('home.nav.signIn')}
          </Link>
          <a
            href="#contact"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-ds-chrome-accent px-5 text-sm font-semibold text-ds-chrome shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass focus-visible:ring-offset-2"
          >
            {t('home.nav.demo')}
          </a>
        </div>
      </div>
    </header>
  )
}
