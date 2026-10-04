/**
 * Learn > Explore - the course catalog.
 *
 * Search first, then narrow by status, topic, level, duration and whether the
 * course awards a certificate. Cards and rows show only facts the course has
 * (duration, level, certificate) and the learner's real progress. The side
 * column links into the learner's own work and groups the catalog by its
 * real categories.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Award, BookOpen, CheckCircle2, ChevronRight, Clock, Layers, PlayCircle, Search, X } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useMyAssignments } from '@/hooks/useTraining'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '@/ui'

import { useCatalog } from '../catalogHooks'
import { LearningPageHero } from '../components/LearningPageHero'
import { VerticalCourseCard } from '../components/CourseCards'
import { CourseCover } from '../gamification/components/CourseCover'
import type { CatalogCourse } from '../catalogApi'

type StateFilter = 'all' | 'not_started' | 'in_progress' | 'completed'
type SortKey = 'newest' | 'shortest' | 'title'
type DurationFilter = 'any' | 'short' | 'medium' | 'long'

const selectCls = 'h-10 rounded-full border border-ds-border bg-ds-surface ps-3.5 pe-8 text-sm text-ds-ink hover:border-ds-border-strong focus:outline-none focus:ring-2 focus:ring-ds-accent'

export default function ExplorePage() {
  const { t, i18n } = useTranslation('training')
  const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-GB'
  const collator = useMemo(() => new Intl.Collator(i18n.language), [i18n.language])
  const { user } = useAuth()
  const catalog = useCatalog()
  const progress = useLearningProgress({ userId: user?.id ?? null })
  const assignments = useMyAssignments()

  const [text, setText] = useState('')
  const [state, setState] = useState<StateFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [duration, setDuration] = useState<DurationFilter>('any')
  const [certOnly, setCertOnly] = useState(false)

  const progressById = useMemo(() => {
    const map = new Map<string, { status: string; pct: number }>()
    for (const p of progress.data ?? []) {
      if (p.content_type === 'module') map.set(p.content_id, { status: p.status, pct: p.progress_percentage ?? 0 })
    }
    return map
  }, [progress.data])

  const stateOf = (c: CatalogCourse): Exclude<StateFilter, 'all'> => {
    const p = progressById.get(c.id)
    if (!p) return 'not_started'
    if (p.status === 'completed') return 'completed'
    return p.pct > 0 || p.status === 'in_progress' ? 'in_progress' : 'not_started'
  }

  const inDuration = (c: CatalogCourse) => {
    const m = c.estimated_duration_minutes
    if (duration === 'any') return true
    if (!m) return false
    if (duration === 'short') return m <= 15
    if (duration === 'medium') return m > 15 && m <= 45
    return m > 45
  }

  const courses = useMemo(() => {
    const q = text.trim().toLowerCase()
    const list = (catalog.data ?? []).filter((c) =>
      (!q || c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)) &&
      (state === 'all' || stateOf(c) === state) &&
      (!category || c.category === category) &&
      (!level || (c.difficulty_level ?? '').toLowerCase() === level) &&
      inDuration(c) &&
      (!certOnly || !!c.certificate_enabled))
    return list.sort((a, b) => {
      if (sort === 'title') return collator.compare(a.title, b.title)
      if (sort === 'shortest') return (a.estimated_duration_minutes ?? Infinity) - (b.estimated_duration_minutes ?? Infinity)
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateOf/inDuration depend only on listed state
  }, [catalog.data, text, state, sort, category, level, duration, certOnly, progressById, collator])

  const counts = useMemo(() => {
    const all = catalog.data ?? []
    return {
      all: all.length,
      not_started: all.filter((c) => stateOf(c) === 'not_started').length,
      in_progress: all.filter((c) => stateOf(c) === 'in_progress').length,
      completed: all.filter((c) => stateOf(c) === 'completed').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateOf depends only on progressById
  }, [catalog.data, progressById])

  const categories = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of catalog.data ?? []) if (c.category) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))
  }, [catalog.data, collator])
  const levels = useMemo(
    () => [...new Set((catalog.data ?? []).map((c) => (c.difficulty_level ?? '').toLowerCase()).filter(Boolean))],
    [catalog.data],
  )

  // Required work for the side panel: open mandatory or overdue assignments.
  const requiredOpen = useMemo(() => {
    const now = Date.now()
    return (assignments.data ?? [])
      .filter((a) => a.progress?.status !== 'completed' && (a.priority === 'compliance' || (a.due_date && Date.parse(a.due_date) < now)))
      .sort((x, y) => (x.due_date ? Date.parse(x.due_date) : Infinity) - (y.due_date ? Date.parse(y.due_date) : Infinity))
  }, [assignments.data])

  const isFiltered = !!text.trim() || state !== 'all' || !!category || !!level || duration !== 'any' || certOnly
  const featuredCount = isFiltered ? 0 : Math.min(courses.length, 3)
  const resetFilters = () => { setText(''); setState('all'); setCategory(''); setLevel(''); setDuration('any'); setCertOnly(false) }

  const pills: { id: StateFilter; label: string; icon?: typeof PlayCircle }[] = [
    { id: 'all', label: t('explore.filter.all', 'All'), icon: Layers },
    { id: 'not_started', label: t('explore.filter.not_started', 'Not started'), icon: PlayCircle },
    { id: 'in_progress', label: t('explore.filter.in_progress', 'In progress'), icon: Clock },
    { id: 'completed', label: t('explore.filter.completed', 'Completed'), icon: CheckCircle2 },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <LearningPageHero
        eyebrow={t('explore.eyebrow', 'Learn')}
        title={t('explore.heroTitle', 'Discover your next skill.')}
        description={t('explore.heroDescription', 'Explore courses designed to help you perform, grow and lead in hospitality.')}
        quote={<>Elevate<br />People.<br />Performance.<br />Hospitality.</>}
      >
        <div role="search" className="relative max-w-3xl">
          <label htmlFor="explore-search" className="sr-only">{t('explore.searchLabel', 'Search courses')}</label>
          <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ds-muted" />
          <input
            id="explore-search"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('explore.searchPlaceholder', 'Search courses, skills or topics…')}
            className="h-14 w-full rounded-[8px] border border-ds-border bg-ds-surface ps-12 pe-12 text-base text-ds-ink shadow-sm placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30"
          />
          {text && (
            <button type="button" onClick={() => setText('')} aria-label={t('explore.clear', 'Clear search')} className="absolute end-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-ds-muted hover:bg-ds-surface-subtle">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </LearningPageHero>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('explore.statusFilter', 'Filter by status')} className="contents">
        {pills.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={state === f.id}
            onClick={() => setState(f.id)}
            className={cn(
              'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
              state === f.id ? 'border-ds-ink bg-ds-ink text-ds-on-ink' : 'border-ds-border bg-ds-surface text-ds-ink hover:border-ds-border-strong',
            )}
          >
            {f.icon && <f.icon aria-hidden="true" className="h-4 w-4" />}
            {f.label}
            <span className={cn('rounded-full px-1.5 font-mono text-xs tabular-nums', state === f.id ? 'bg-ds-on-ink/15' : 'text-ds-muted')}>{counts[f.id]}</span>
          </button>
        ))}
        </div>
        <span className="mx-1 hidden h-6 w-px bg-ds-border md:block" aria-hidden="true" />
        {categories.length > 0 && (
          <select aria-label={t('explore.topic', 'Topic')} value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
            <option value="">{t('explore.topic', 'Topic')}</option>
            {categories.map(([name]) => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        {levels.length > 0 && (
          <select aria-label={t('explore.levelLabel', 'Level')} value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
            <option value="">{t('explore.levelLabel', 'Level')}</option>
            {levels.map((l) => <option key={l} value={l}>{t(`explore.level.${l}`, l.charAt(0).toUpperCase() + l.slice(1))}</option>)}
          </select>
        )}
        <select aria-label={t('explore.duration', 'Duration')} value={duration} onChange={(e) => setDuration(e.target.value as DurationFilter)} className={selectCls}>
          <option value="any">{t('explore.duration', 'Duration')}</option>
          <option value="short">{t('explore.durationShort', 'Up to 15 min')}</option>
          <option value="medium">{t('explore.durationMedium', '15–45 min')}</option>
          <option value="long">{t('explore.durationLong', 'Over 45 min')}</option>
        </select>
        <select aria-label={t('explore.certificate', 'Certificate')} value={certOnly ? 'yes' : 'any'} onChange={(e) => setCertOnly(e.target.value === 'yes')} className={selectCls}>
          <option value="any">{t('explore.certificate', 'Certificate')}</option>
          <option value="yes">{t('explore.withCertificate', 'With certificate')}</option>
        </select>
        <label className="ms-auto flex items-center gap-2 text-sm text-ds-muted">
          <span className="sr-only">{t('explore.sort', 'Sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
            <option value="newest">{t('explore.sortNewestLabel', 'Sort: Newest')}</option>
            <option value="shortest">{t('explore.sortShortestLabel', 'Sort: Shortest')}</option>
            <option value="title">{t('explore.sortTitleLabel', 'Sort: A–Z')}</option>
          </select>
        </label>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-9 lg:col-span-8">
          {catalog.isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="grid gap-3 md:grid-cols-3"><Skeleton variant="card" className="h-72" /><Skeleton variant="card" className="h-72" /><Skeleton variant="card" className="h-72" /></div>
              <Skeleton variant="card" className="h-24" />
            </div>
          ) : catalog.isError ? (
            <ErrorState title={t('explore.errorTitle', 'Courses could not be loaded')} message={t('explore.errorHint', 'Check your connection and try again.')} onRetry={() => void catalog.refetch()} />
          ) : courses.length === 0 ? (
            <EmptyState
              illustration={counts.all === 0 ? 'courses' : 'search'}
              title={counts.all === 0 ? t('explore.emptyTitle', 'No courses published yet') : t('explore.noMatch', 'No courses match')}
              description={counts.all === 0 ? t('explore.emptyBody', 'Your training team has not published any courses yet.') : t('explore.noMatchBody', 'Try other words or another filter.')}
              action={counts.all > 0 ? <button type="button" onClick={resetFilters} className="text-sm font-semibold text-ds-accent hover:underline">{t('explore.reset', 'Clear search and filters')}</button> : undefined}
            />
          ) : (
            <>
              {featuredCount > 0 && (
                <section aria-labelledby="explore-featured" className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <h2 id="explore-featured" className="font-editorial text-[23px] font-semibold leading-tight text-ds-ink">{t('explore.recommended', 'Recommended for you')}</h2>
                    <a href="#explore-all" className="inline-flex items-center gap-1 text-sm font-semibold text-ds-brass hover:underline">{t('myDay.viewAll', 'View all')}<ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" /></a>
                  </div>
                  <ul className="grid gap-3 md:grid-cols-3">
                    {courses.slice(0, featuredCount).map((c) => {
                      const s = stateOf(c)
                      return (
                        <li key={c.id}>
                          <VerticalCourseCard
                            href={`/learn/courses/${c.id}`}
                            course={{ id: c.id, title: c.title, category: c.category, description: c.description, durationMinutes: c.estimated_duration_minutes, level: c.difficulty_level, certificate: c.certificate_enabled }}
                            badge={{
                              label: s === 'in_progress' ? t('explore.filter.in_progress', 'In progress') : s === 'completed' ? t('explore.done', 'Completed') : t('explore.recommendedBadge', 'Recommended'),
                              tone: s === 'in_progress' ? 'progress' : s === 'completed' ? 'done' : 'recommended',
                            }}
                            progress={s === 'in_progress' ? progressById.get(c.id)?.pct : undefined}
                            actionLabel={s === 'in_progress' ? t('explore.continue', 'Continue learning') : t('explore.start', 'Start course')}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {courses.length > featuredCount && (
                <section id="explore-all" aria-labelledby="explore-all-title" className="scroll-mt-24 space-y-3">
                  <div>
                    <h2 id="explore-all-title" className="font-editorial text-[23px] font-semibold leading-tight text-ds-ink">{featuredCount ? t('explore.allCourses', 'All courses') : t('explore.results', 'Course results')}</h2>
                    <p className="mt-0.5 text-sm text-ds-muted">{t('explore.available', '{{count}} courses available', { count: courses.length })}</p>
                  </div>
                  <ul className="divide-y divide-ds-border overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
                    {courses.slice(featuredCount).map((c) => {
                      const s = stateOf(c)
                      const p = progressById.get(c.id)
                      return (
                        <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5">
                          <CourseCover course={c} className="h-36 w-full rounded-lg sm:h-20 sm:w-32">
                            {s === 'completed' && (
                              <span className="absolute bottom-1.5 start-1.5 inline-flex items-center gap-1 rounded bg-ds-surface/90 px-1.5 py-0.5 text-[11px] font-semibold text-ds-success">
                                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />{t('explore.done', 'Completed')}
                              </span>
                            )}
                          </CourseCover>
                          <div className="min-w-0 flex-1 space-y-1">
                            <Link to={`/learn/courses/${c.id}`} className="text-[15px] font-semibold text-ds-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">{c.title}</Link>
                            {c.description && <p className="line-clamp-2 text-sm text-ds-ink-secondary">{c.description}</p>}
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-ds-muted">
                              {c.estimated_duration_minutes ? <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{t('explore.minutes', '{{count}} min', { count: c.estimated_duration_minutes })}</span> : null}
                              {c.difficulty_level && <span>{t(`explore.level.${c.difficulty_level.toLowerCase()}`, c.difficulty_level)}</span>}
                              {c.certificate_enabled && <span className="inline-flex items-center gap-1 rounded bg-ds-success-soft px-1.5 py-0.5 text-ds-success"><Award aria-hidden="true" className="h-3.5 w-3.5" />{t('explore.certificate', 'Certificate')}</span>}
                            </p>
                            {s === 'in_progress' && <div className="max-w-xs pt-1"><ProgressBar value={p?.pct ?? 0} label={t('explore.progress', 'Progress')} showPercentage size="sm" /></div>}
                          </div>
                          <Link
                            to={`/learn/courses/${c.id}`}
                            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ds-brass/60 px-4 text-sm font-semibold text-ds-brass hover:bg-ds-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
                          >
                            {s === 'in_progress' ? t('explore.continue', 'Continue learning') : t('explore.view', 'View course')}
                            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section aria-labelledby="explore-yours" className="rounded-[8px] border border-ds-border bg-ds-surface p-5 shadow-[0_12px_32px_rgb(21_33_46/0.04)]">
            <div className="flex items-center justify-between">
              <h2 id="explore-yours" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('explore.yourLearning', 'Your learning')}</h2>
              <Link to="/learn/my" className="inline-flex items-center gap-1 text-xs font-semibold text-ds-brass hover:underline">{t('myDay.viewAll', 'View all')}<ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" /></Link>
            </div>
            <ul className="mt-4 space-y-2">
              <li>
                <button type="button" onClick={() => setState('in_progress')} aria-pressed={state === 'in_progress'} className="flex min-h-[60px] w-full items-center gap-3 rounded-[8px] border border-ds-border px-3 text-start hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ds-info font-mono text-sm font-semibold text-ds-info">{counts.in_progress}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ds-ink">{t('explore.filter.in_progress', 'In progress')}</span><span className="block text-xs text-ds-muted">{t('explore.continueHint', 'Continue your learning')}</span></span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-ds-muted rtl:rotate-180" />
                </button>
              </li>
              <li>
                <Link to="/learn/my" className="flex min-h-[60px] items-center gap-3 rounded-[8px] border border-ds-border px-3 hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-warning-soft text-ds-warning"><BookOpen aria-hidden="true" className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ds-ink">{t('explore.requiredForYou', 'Required for you')}</span>
                    <span className="block truncate text-xs text-ds-muted">
                      {requiredOpen[0]?.due_date
                        ? t('explore.completeBy', 'Complete by {{date}}', { date: new Date(requiredOpen[0].due_date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })
                        : requiredOpen.length > 0 ? t('explore.requiredHint', 'Mandatory training assigned to you') : t('explore.nothingRequired', 'Nothing required right now')}
                    </span>
                  </span>
                  {requiredOpen.length > 0 && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ds-danger px-1.5 text-xs font-bold text-white">{requiredOpen.length}</span>}
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-ds-muted rtl:rotate-180" />
                </Link>
              </li>
              <li>
                <Link to="/learn/certificates" className="flex min-h-[60px] items-center gap-3 rounded-[8px] border border-ds-border px-3 hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-success-soft text-ds-success"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ds-ink">{t('explore.filter.completed', 'Completed')}</span><span className="block text-xs text-ds-muted">{t('explore.viewCertificates', 'View your certificates')}</span></span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-ds-muted rtl:rotate-180" />
                </Link>
              </li>
            </ul>
          </section>

          {categories.length > 0 && (
            <section aria-labelledby="explore-capability" className="space-y-3">
              <h2 id="explore-capability" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('explore.byCapability', 'Explore by capability')}</h2>
              <ul className="grid grid-cols-2 gap-2.5">
                {categories.slice(0, 8).map(([name, count]) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => { setCategory(name === category ? '' : name); setState('all') }}
                      aria-pressed={category === name}
                      className={cn(
                        'flex h-full min-h-[68px] w-full items-center gap-2.5 rounded-[8px] border px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
                        category === name ? 'border-ds-brass bg-ds-brass/10' : 'border-ds-border bg-ds-surface hover:border-ds-border-strong',
                      )}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ds-accent-soft text-ds-accent"><Layers aria-hidden="true" className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-xs font-semibold leading-snug text-ds-ink">{name}</span>
                        <span className="block text-[11px] text-ds-muted">{t('explore.count', '{{count}} courses', { count })}</span>
                      </span>
                      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ds-muted rtl:rotate-180" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
