/**
 * Knowledge hub - "Everything your team needs to know."
 *
 * Search first. With no query the hub shows the categories with their real
 * document counts, what is for this member (required reading, the article they
 * last opened, something relevant to their department, saved articles), and
 * the latest published knowledge with the signals that make it trustworthy
 * (type, department, version, last update, scope, review status).
 *
 * "Continue where you left off" uses the last-viewed timestamp KnowledgeRead
 * records for this member on this device. Reading progress is not stored, so
 * no progress bar is shown for it.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, BookMarked, Building2, CheckCircle2, ChevronRight, Clock, FileCheck2, Flame, Search,
  Sparkles, Users, X, type LucideIcon,
} from 'lucide-react'

import { useTenant } from '@/contexts/TenantContext'
import { useAccountContext } from '@/contexts/auth/AccountContext'
import { useAuth } from '@/hooks/useAuth'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDebounce } from '@/hooks/useDebounce'
import { useDepartments } from '@/hooks/useDepartments'
import { useArticles, useBookmarks, useKnowledgeArticle, useRequiredReading } from '@/hooks/useKnowledge'
import { cn } from '@/lib/utils'
import type { KnowledgeArticle } from '@/types/knowledge'
import { EmptyState, Skeleton } from '@/ui'

import { CourseCover } from '@/features/learn/gamification/components/CourseCover'

import { usePopularArticles } from '../api/popularApi'
import { usePublishedTypeCounts } from '../api/typeCountsApi'
import { useContentGaps } from '../api/gapsApi'
import { AskKnowledgePanel, looksLikeQuestion } from '../components/AskKnowledgePanel'
import { ArticleTrustRow } from '../components/ArticleTrustRow'
import { knowledgeTypeStyle } from '../knowledgeTypes'

type TypeFilter = 'all' | 'sop' | 'guide' | 'policy' | 'required' | 'saved'
const LAST_VIEWED_KEY = 'altus_kb_last_viewed'

/** Most recently opened article id and when, from KnowledgeRead's per-member record. */
function readLastViewed(userId: string | undefined): { id: string; at: string } | null {
  if (!userId) return null
  try {
    const map = JSON.parse(localStorage.getItem(`${LAST_VIEWED_KEY}_${userId}`) ?? '{}') as Record<string, string>
    const [id, at] = Object.entries(map).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))[0] ?? []
    return id && at ? { id, at } : null
  } catch {
    return null
  }
}

const departmentName = (a: KnowledgeArticle) =>
  (a as KnowledgeArticle & { department?: { name?: string | null } | null }).department?.name ?? null

function SectionLabel({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ds-muted">{children}</h2>
      {action}
    </div>
  )
}

interface ForYouRow {
  key: string
  icon: LucideIcon
  tone: string
  title: string
  hint: string
  badge?: number
  href?: string
  onClick?: () => void
}

export default function KnowledgeHubPage() {
  const { t, i18n } = useTranslation('knowledge')
  const isArabic = i18n.language?.startsWith('ar')
  const locale = isArabic ? 'ar-SA' : 'en-GB'
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(() => Date.now())
  const { user } = useAuth()
  const { currentOrganization } = useTenant()
  const account = useAccountContext()
  const { can } = useCapabilities()
  const { departments } = useDepartments()

  const initialQuery = searchParams.get('q') ?? ''
  const filter = (searchParams.get('type') as TypeFilter | null) ?? 'all'
  const departmentParam = searchParams.get('department') ?? undefined
  const [text, setText] = useState(initialQuery)
  const query = useDebounce(text.trim(), 300)

  // Keep the URL shareable: ?q= and ?type= describe what is on screen.
  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (query) next.set('q', query)
    else next.delete('q')
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [query, searchParams, setSearchParams])

  const departmentId = account.tenantMemberships.find((m) => m.organization_id === currentOrganization?.id)?.department_id ?? undefined
  const typeParam = filter === 'sop' || filter === 'guide' || filter === 'policy' ? filter : undefined
  const isSearching = !!query || filter !== 'all' || !!departmentParam

  const results = useArticles({ search: query || undefined, type: typeParam, departmentId: departmentParam, limit: 60 })
  const roleArticles = useArticles({ departmentId, limit: 6 })
  const reading = useRequiredReading()
  const bookmarks = useBookmarks()
  const trending = usePopularArticles(7, 6)
  const typeCounts = usePublishedTypeCounts()
  const gaps = useContentGaps(can('content.publish'))
  const [lastViewed] = useState(() => readLastViewed(user?.id))
  const lastArticle = useKnowledgeArticle(lastViewed?.id)

  const all = useMemo(() => results.data ?? [], [results.data])
  const pendingReading = useMemo(() => (reading.data ?? []).filter((r) => !r.is_acknowledged), [reading.data])
  const pendingReadingIds = useMemo(() => new Set(pendingReading.map((r) => r.document_id)), [pendingReading])
  const savedIds = useMemo(() => new Set((bookmarks.data ?? []).map((b) => b.document_id)), [bookmarks.data])

  const shown = useMemo(() => {
    if (filter === 'required') return all.filter((a) => pendingReadingIds.has(a.id))
    if (filter === 'saved') return all.filter((a) => savedIds.has(a.id))
    return all
  }, [all, filter, pendingReadingIds, savedIds])

  const latest = useMemo(() => [...all].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 6), [all])
  const needsReview = useMemo(() => all.filter((a) => a.next_review_date && Date.parse(a.next_review_date) < now).slice(0, 5), [all, now])
  const recommendedArticle = (roleArticles.data ?? []).find((a) => a.id !== lastViewed?.id)

  const setFilter = (next: TypeFilter) => {
    const params = new URLSearchParams(searchParams)
    params.delete('department')
    if (next === 'all') params.delete('type')
    else params.set('type', next)
    setSearchParams(params)
  }

  const titleOf = (a: { title: string; title_ar?: string | null }) => (isArabic && a.title_ar) || a.title
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const relTime = (iso: string) => {
    const days = Math.floor((now - Date.parse(iso)) / 86400000)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    return days < 30 ? rtf.format(-Math.max(0, days), 'day') : fmtDate(iso)
  }

  const pills: { id: TypeFilter; label: string; icon: LucideIcon }[] = [
    { id: 'all', label: t('hub.filter.allKnowledge', 'All knowledge'), icon: Sparkles },
    { id: 'sop', label: t('hub.filter.sop', 'SOPs'), icon: knowledgeTypeStyle('sop').icon },
    { id: 'policy', label: t('hub.filter.policy', 'Policies'), icon: knowledgeTypeStyle('policy').icon },
    { id: 'guide', label: t('hub.filter.guide', 'Guides'), icon: knowledgeTypeStyle('guide').icon },
    { id: 'required', label: t('hub.filter.required', 'Required reading'), icon: FileCheck2 },
    { id: 'saved', label: t('hub.filter.saved', 'Saved'), icon: BookMarked },
  ]

  const countOr = (n: number | undefined) => n ?? (typeCounts.isSuccess ? 0 : undefined)
  const tiles: { id: TypeFilter; title: string; hint: string; count?: number; icon: LucideIcon; tone: string; iconTone: string }[] = [
    { id: 'sop', title: t('hub.filter.sop', 'SOPs'), hint: t('hub.tile.sop', 'Operational procedures'), count: countOr(typeCounts.data?.sop), icon: knowledgeTypeStyle('sop').icon, tone: 'bg-ds-brass/10 border-ds-brass/25', iconTone: 'text-ds-brass' },
    { id: 'policy', title: t('hub.filter.policy', 'Policies'), hint: t('hub.tile.policy', 'Organization standards'), count: countOr(typeCounts.data?.policy), icon: knowledgeTypeStyle('policy').icon, tone: 'bg-ds-info-soft border-ds-info/25', iconTone: 'text-ds-info' },
    { id: 'guide', title: t('hub.filter.guide', 'Guides'), hint: t('hub.tile.guide', 'Practical knowledge'), count: countOr(typeCounts.data?.guide), icon: knowledgeTypeStyle('guide').icon, tone: 'bg-ds-success-soft border-ds-success/25', iconTone: 'text-ds-success' },
    { id: 'required', title: t('hub.filter.required', 'Required reading'), hint: t('hub.tile.required', 'Documents assigned to you'), count: reading.isLoading ? undefined : pendingReading.length, icon: FileCheck2, tone: 'bg-ds-danger-soft border-ds-danger/20', iconTone: 'text-ds-danger' },
    { id: 'saved', title: t('hub.filter.saved', 'Saved'), hint: t('hub.tile.saved', 'Your saved documents'), count: bookmarks.isLoading ? undefined : savedIds.size, icon: BookMarked, tone: 'bg-ds-accent-soft border-ds-accent/20', iconTone: 'text-ds-accent' },
  ]

  const forYou: ForYouRow[] = [
    { key: 'required', icon: FileCheck2, tone: 'bg-ds-danger-soft text-ds-danger', title: t('hub.filter.required', 'Required reading'), hint: t('hub.requiredAssigned', '{{count}} documents assigned to you', { count: pendingReading.length }), badge: pendingReading.length, onClick: () => setFilter('required') },
    ...(lastArticle.data ? [{ key: 'recent', icon: Clock, tone: 'bg-ds-info-soft text-ds-info', title: t('hub.recentlyViewed', 'Recently viewed'), hint: titleOf(lastArticle.data), href: `/knowledge/${lastArticle.data.id}` }] : []),
    ...(recommendedArticle ? [{ key: 'recommended', icon: Sparkles, tone: 'bg-ds-brass/15 text-ds-brass', title: t('hub.recommended', 'Recommended'), hint: titleOf(recommendedArticle), href: `/knowledge/${recommendedArticle.id}` }] : []),
    { key: 'saved', icon: BookMarked, tone: 'bg-ds-accent-soft text-ds-accent', title: t('hub.filter.saved', 'Saved'), hint: t('hub.savedCount', '{{count}} documents', { count: savedIds.size }), onClick: () => setFilter('saved') },
  ]

  const scope = currentOrganization?.name ?? ''

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Hero: search first */}
      <header className="relative isolate overflow-hidden rounded-2xl border border-ds-border bg-ds-surface p-6 sm:p-9">
        <div aria-hidden="true" className="absolute inset-y-0 end-0 -z-10 w-full bg-cover bg-center sm:w-[58%]" style={{ backgroundImage: "url('/assets/altus/knowledge-hero.jpg')" }} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-ds-surface from-45% via-ds-surface/85 via-65% to-ds-surface/10 rtl:bg-gradient-to-l" />

        <div className="max-w-4xl space-y-5 xl:pe-64">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ds-brass">{t('hub.eyebrow', 'Knowledge')}</p>
            <h1 className="font-editorial text-[38px] font-medium leading-[1.02] text-ds-ink sm:text-[50px]">{t('hub.heroTitle', 'Everything your team needs to know.')}</h1>
            <p className="flex items-center gap-2 text-base text-ds-ink-secondary">
              <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-brass" />
              {t('hub.heroDescription', "Search your organization's SOPs, policies, guides and procedures.")}
            </p>
          </div>
          <form role="search" className="relative" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="knowledge-search" className="sr-only">{t('hub.searchLabel', 'Search knowledge')}</label>
            <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ds-muted" />
            <input
              id="knowledge-search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('hub.searchPlaceholderLong', 'Search knowledge… try "late check-out", "lost items" or "housekeeping"')}
              className="h-14 w-full rounded-xl border border-ds-border bg-ds-surface ps-12 pe-28 text-base text-ds-ink shadow-sm placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30"
            />
            {text && (
              <button type="button" onClick={() => setText('')} aria-label={t('hub.clearSearch', 'Clear search')} className="absolute end-14 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-ds-muted hover:bg-ds-surface-subtle">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
            <button type="submit" aria-label={t('hub.search', 'Search')} className="absolute end-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-ds-brass text-white hover:bg-ds-brass/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
              <ArrowRight aria-hidden="true" className="h-5 w-5 rtl:rotate-180" />
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {pills.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
                  filter === f.id ? 'border-ds-ink bg-ds-ink text-ds-on-ink' : 'border-ds-border bg-ds-surface text-ds-ink hover:border-ds-border-strong',
                )}
              >
                <f.icon aria-hidden="true" className="h-4 w-4" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {scope && (
          <div className="absolute end-8 top-8 hidden w-56 rounded-xl border border-ds-border bg-ds-surface/90 p-4 shadow-sm backdrop-blur-sm xl:block">
            <div className="flex items-center gap-2.5">
              <Building2 aria-hidden="true" className="h-7 w-7 shrink-0 text-ds-ink" />
              <p className="font-editorial text-lg font-semibold leading-tight text-ds-ink">{scope}</p>
            </div>
            <p className="mt-4 text-xs text-ds-muted">{t('hub.showingFor', 'Showing knowledge for')}</p>
            <p className="text-sm font-semibold text-ds-ink">{scope}</p>
            <Link to="/select-tenant" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ds-brass underline-offset-2 hover:underline">
              {t('hub.changeOrganization', 'Change organization')}
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </header>

      {isSearching ? (
        /* ---------- Search / filter results ---------- */
        <div className="space-y-5">
        {query && looksLikeQuestion(query) && <AskKnowledgePanel question={query} />}
        <section aria-labelledby="kb-results" className="space-y-3">
          <SectionLabel id="kb-results">
            {query
              ? t('hub.resultsFor', '{{count}} results for "{{q}}"', { count: shown.length, q: query })
              : t('hub.resultsCount', '{{count}} articles', { count: shown.length })}
          </SectionLabel>
          {results.isLoading ? (
            <div className="space-y-3" aria-busy="true"><Skeleton variant="card" className="h-20" /><Skeleton variant="card" className="h-20" /></div>
          ) : shown.length > 0 ? (
            <ul className="divide-y divide-ds-border overflow-hidden rounded-xl border border-ds-border bg-ds-surface">
              {shown.map((a) => <ArticleTrustRow key={a.id} article={a} now={now} />)}
            </ul>
          ) : (
            <EmptyState
              illustration="search"
              title={query ? t('hub.noResults', 'No articles match "{{q}}"', { q: query }) : t('hub.noResultsFilter', 'No articles here yet')}
              description={t('hub.noResultsHint', 'Try fewer words or another type. If an SOP should exist, tell your knowledge manager.')}
              action={<button type="button" onClick={() => { setText(''); setSearchParams(new URLSearchParams()) }} className="text-sm font-semibold text-ds-accent hover:underline">{t('hub.clearFilters', 'Clear search and filters')}</button>}
            />
          )}
        </section>
        </div>
      ) : (
        <>
          {/* Category tiles with real counts */}
          <nav aria-label={t('hub.categories', 'Knowledge categories')}>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {tiles.map((tile) => (
                <li key={tile.id}>
                  <button
                    type="button"
                    onClick={() => setFilter(tile.id)}
                    className={cn('group flex h-full w-full items-start gap-3 rounded-xl border p-4 text-start transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent', tile.tone)}
                  >
                    <tile.icon aria-hidden="true" className={cn('h-7 w-7 shrink-0', tile.iconTone)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-editorial text-[18px] font-semibold leading-tight text-ds-ink">{tile.title}</span>
                      <span className="block truncate text-xs text-ds-ink-secondary">{tile.hint}</span>
                      <span className="mt-2 flex items-center justify-between text-xs font-semibold text-ds-ink">
                        {tile.count === undefined ? ' ' : t('hub.tile.documents', '{{count}} documents', { count: tile.count })}
                        <ChevronRight aria-hidden="true" className="h-4 w-4 text-ds-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Left: for you + browse by department */}
            <div className="space-y-5 lg:col-span-4">
              <section aria-labelledby="kb-for-you" className="rounded-2xl border border-ds-border bg-ds-surface p-5">
                <SectionLabel id="kb-for-you">{t('hub.forYou', 'For you')}</SectionLabel>
                <ul className="mt-3 divide-y divide-ds-border">
                  {forYou.map((r) => {
                    const inner = (
                      <>
                        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', r.tone)}><r.icon aria-hidden="true" className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ds-ink">{r.title}</span>
                          <span className="block truncate text-xs text-ds-muted">{r.hint}</span>
                        </span>
                        {!!r.badge && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ds-danger px-1.5 text-xs font-bold text-white">{r.badge}</span>}
                        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-muted rtl:rotate-180" />
                      </>
                    )
                    const cls = 'flex min-h-[60px] w-full items-center gap-3 py-2.5 text-start hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent'
                    return (
                      <li key={r.key}>
                        {r.href ? <Link to={r.href} className={cls}>{inner}</Link> : <button type="button" onClick={r.onClick} className={cls}>{inner}</button>}
                      </li>
                    )
                  })}
                </ul>
              </section>

              {departments.length > 0 && (
                <section aria-labelledby="kb-departments" className="rounded-2xl border border-ds-chrome-border bg-ds-chrome p-5 text-ds-chrome-text">
                  <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-full bg-ds-chrome-accent" />
                  <h2 id="kb-departments" className="font-editorial text-[21px] font-semibold leading-tight text-white">{t('hub.needHelp', 'Need help finding something?')}</h2>
                  <p className="mt-1 text-sm text-ds-chrome-muted">{t('hub.browseByDepartment', 'Browse by department')}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {departments.slice(0, 8).map((d) => (
                      <li key={d.id}>
                        <Link to={`/knowledge?department=${d.id}`} className="inline-flex min-h-[34px] items-center rounded-full border border-ds-chrome-border bg-white/5 px-3 text-xs font-medium text-white hover:border-ds-chrome-accent hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-chrome-accent">
                          {d.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Right: continue + latest */}
            <div className="space-y-6 lg:col-span-8">
              {lastArticle.data && lastViewed && (
                <section aria-labelledby="kb-continue" className="space-y-3">
                  <SectionLabel id="kb-continue">{t('hub.continue', 'Continue where you left off')}</SectionLabel>
                  <div className="flex flex-col gap-4 rounded-2xl border border-ds-border bg-ds-surface p-4 sm:flex-row sm:items-center">
                    <CourseCover course={{ id: lastArticle.data.id, title: lastArticle.data.title }} className="h-28 w-full rounded-xl sm:w-28" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', knowledgeTypeStyle(lastArticle.data.content_type).soft, knowledgeTypeStyle(lastArticle.data.content_type).text)}>
                        {t(`types.${lastArticle.data.content_type}`, lastArticle.data.content_type)}
                      </span>
                      <p className="font-editorial text-[22px] font-semibold leading-tight text-ds-ink">{titleOf(lastArticle.data)}</p>
                      <p className="text-sm text-ds-muted">{[departmentName(lastArticle.data), scope].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span className="text-xs text-ds-muted">{t('hub.lastViewed', 'Last viewed {{when}}', { when: relTime(lastViewed.at) })}</span>
                      <Link to={`/knowledge/${lastArticle.data.id}`} className="inline-flex min-h-[44px] items-center gap-6 rounded-lg bg-ds-ink px-5 text-sm font-semibold text-ds-on-ink hover:bg-ds-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2">
                        {t('hub.continueReading', 'Continue reading')}
                        <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              <section aria-labelledby="kb-latest" className="space-y-3">
                <SectionLabel id="kb-latest">{t('hub.latestKnowledge', 'Latest knowledge')}</SectionLabel>
                {results.isLoading ? (
                  <div className="space-y-2" aria-busy="true"><Skeleton variant="card" className="h-16" /><Skeleton variant="card" className="h-16" /><Skeleton variant="card" className="h-16" /></div>
                ) : latest.length === 0 ? (
                  <EmptyState
                    illustration="knowledge"
                    title={t('hub.emptyTitle', 'No knowledge published yet')}
                    description={can('content.author') ? t('hub.emptyAuthor', 'Write the first SOP, guide or policy for your teams.') : t('hub.emptyLearner', 'Your organization has not published any articles yet.')}
                    action={can('content.author') ? <Link to="/studio/articles/new" className="text-sm font-semibold text-ds-accent hover:underline">{t('hub.writeFirst', 'Write an article')}</Link> : undefined}
                  />
                ) : (
                  <ul className="divide-y divide-ds-border overflow-hidden rounded-2xl border border-ds-border bg-ds-surface">
                    {latest.map((a) => {
                      const style = knowledgeTypeStyle(a.content_type)
                      const overdueReview = !!a.next_review_date && Date.parse(a.next_review_date) < now
                      const version = a.published_version_number ?? a.current_version ?? a.version
                      const wholeOrg = a.scope_type === 'organization' || (a.visibility_scope as string) === 'organization'
                      return (
                        <li key={a.id}>
                          <Link to={`/knowledge/${a.id}`} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent">
                            <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', style.soft, style.text)}><style.icon aria-hidden="true" className="h-5 w-5" /></span>
                            <span className={cn('hidden w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold uppercase sm:inline-block', style.soft, style.text)}>
                              {t(`types.${a.content_type}`, a.content_type)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-ds-ink group-hover:underline">{titleOf(a)}</span>
                              <span className="block truncate text-xs text-ds-muted">
                                {[
                                  departmentName(a),
                                  version ? t('hub.version', 'Version {{n}}', { n: version }) : null,
                                  t('hub.updated', 'Updated {{date}}', { date: fmtDate(a.updated_at) }),
                                  wholeOrg ? t('hub.appliesOrg', 'Applies to: Whole organization') : null,
                                ].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <span className={cn('hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold md:inline-flex', overdueReview ? 'bg-ds-warning-soft text-ds-warning' : 'bg-ds-success-soft text-ds-success')}>
                              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              {overdueReview ? t('hub.reviewDue', 'Review due') : t('hub.current', 'Current')}
                            </span>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-muted rtl:rotate-180" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {(gaps.data ?? []).length > 0 && (
                <section aria-labelledby="kb-gaps" className="space-y-3">
                  <SectionLabel id="kb-gaps">{t('hub.gapsTitle', 'Searched for but not found')}</SectionLabel>
                  <div className="rounded-2xl border border-ds-warning/30 bg-ds-warning-soft/40 p-4">
                    <p className="text-sm text-ds-ink-secondary">{t('hub.gapsHint', 'Your team looked for these in the last 30 days and found nothing. Each one is an article worth writing.')}</p>
                    <ul className="mt-3 divide-y divide-ds-border">
                      {(gaps.data ?? []).map((g) => (
                        <li key={g.term} className="flex flex-wrap items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ds-ink">"{g.term}"</span>
                            <span className="block text-xs text-ds-muted">{t('hub.gapsCount', '{{searches}} searches by {{people}} people', { searches: g.searches, people: g.distinct_users })}</span>
                          </span>
                          {can('content.author') && (
                            <Link to={`/studio/articles/new?title=${encodeURIComponent(g.term)}`} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-ds-border bg-ds-surface px-3 text-xs font-semibold text-ds-ink hover:border-ds-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                              {t('hub.writeThis', 'Write this article')}
                              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {(trending.data ?? []).length > 0 && (
                <section aria-labelledby="kb-trending" className="space-y-3">
                  <SectionLabel id="kb-trending">{t('hub.trendingTitle', 'Trending this week')}</SectionLabel>
                  <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                    {(trending.data ?? []).map((a, i) => (
                      <li key={a.id} className="w-56 shrink-0 snap-start">
                        <Link to={`/knowledge/${a.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-surface hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                          <CourseCover course={{ id: a.id, title: a.title }} className="h-24 w-full rounded-none">
                            <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-ds-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ds-ink">
                              {i === 0 && <Flame aria-hidden="true" className="h-3 w-3 text-ds-warning" />}#{i + 1}
                            </span>
                          </CourseCover>
                          <span className="flex flex-1 flex-col gap-1.5 p-3">
                            <span className="line-clamp-2 text-sm font-semibold leading-snug text-ds-ink group-hover:underline">{titleOf(a)}</span>
                            <span className="mt-auto inline-flex items-center gap-1 text-xs text-ds-muted"><Users aria-hidden="true" className="h-3.5 w-3.5" />{t('hub.readers', '{{count}} readers', { count: a.readers })}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {can('content.publish') && needsReview.length > 0 && (
                <section aria-labelledby="kb-review" className="space-y-3">
                  <SectionLabel id="kb-review" action={<Link to="/studio/review/articles" className="text-xs font-semibold text-ds-accent hover:underline">{t('hub.openReview', 'Open review queue')}</Link>}>
                    {t('hub.reviewTitle', 'Past their review date')}
                  </SectionLabel>
                  <ul className="divide-y divide-ds-border overflow-hidden rounded-xl border border-ds-border bg-ds-surface">
                    {needsReview.map((a) => <ArticleTrustRow key={a.id} article={a} now={now} />)}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
