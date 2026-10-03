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
        <span className={cn('block whitespace-nowrap text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-ds-ink')}>
          Altus Connect
        </span>
        <span className={cn('mt-1 hidden whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.16em] sm:block', inverted ? 'text-ds-chrome-accent' : 'text-ds-brass')}>
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

export function HomeHeader() {
  const { t } = useTranslation('public')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '#how-it-works', label: t('home.nav.how') },
    { href: '#roles', label: t('home.nav.roles') },
    { href: '#knowledge', label: t('home.nav.knowledge') },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300',
        scrolled
          ? 'border-b border-ds-border/70 bg-ds-background/85 shadow-[0_1px_0_rgba(21,33,46,0.02)] backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="Altus Connect" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass">
          <BrandMark />
        </Link>

        <nav aria-label={t('home.nav.label')} className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ds-ink-secondary transition-colors hover:text-ds-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass"
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/verify"
            className="rounded-md px-3 py-2 text-sm font-medium text-ds-ink-secondary transition-colors hover:text-ds-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass"
          >
            {t('home.nav.verify')}
          </Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <LanguageToggle className="text-ds-muted hover:text-ds-ink" />
          <Link
            to="/login"
            className="inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-ds-chrome px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ds-chrome-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ds-background"
          >
            {t('home.nav.signIn')}
          </Link>
        </div>
      </div>
    </header>
  )
}
