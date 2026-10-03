/**
 * Public homepage - the Altus Connect marketing page, shown at / to signed-out
 * visitors. Signed-in users never see it: RootIndex sends them to their
 * workspace first.
 */
import { LazyMotion, domAnimation } from 'framer-motion'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HomeContact, HomeFooter, HomeVerify } from '@/components/public/home/HomeClosing'
import { HomeHeader } from '@/components/public/home/HomeHeader'
import { HomeApproach, HomeCustomers, HomeHero, HomeOutcomes, HomePlatform, HomeWhy } from '@/components/public/home/HomeSections'

export default function Home() {
  const { t, i18n } = useTranslation('public')
  const isRTL = i18n.dir() === 'rtl'

  useEffect(() => {
    const previous = document.title
    document.title = t('home.meta.title')
    return () => {
      document.title = previous
    }
  }, [t])

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        lang={isRTL ? 'ar' : 'en'}
        className="min-h-screen bg-ds-background font-sans text-ds-ink antialiased selection:bg-ds-brass/20"
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ds-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          {t('home.skip')}
        </a>
        <HomeHeader />
        <main id="main">
          <HomeHero />
          <HomeWhy />
          <HomeOutcomes />
          <HomePlatform />
          <HomeApproach />
          <HomeCustomers />
          <HomeVerify />
          <HomeContact />
        </main>
        <HomeFooter />
      </div>
    </LazyMotion>
  )
}
