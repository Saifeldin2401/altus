/**
 * Learn > My learning.
 *
 * Top: continue where you left off, what is required, and what to learn next,
 * with an overview, goal progress and recent completions beside it. Below: the
 * full plan on a timeline of obligations (overdue, this week, later, undated)
 * with search and filters. Every number is the member's own data; the "goals"
 * are progress against what is actually assigned, not targets we invent.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Award, BookOpen, CheckCircle2, ChevronDown, ChevronRight, FileQuestion, PlayCircle, Search, Target, X } from 'lucide-react'

import { useMyCertificates } from '@/hooks/useCertificates'
import { useMyAssignments } from '@/hooks/useTraining'
import { cn } from '@/lib/utils'
import type { LearningAssignment } from '@/types/learning'
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '@/ui'

import { CourseCover } from '../gamification/components/CourseCover'
import { LearningPageHero } from '../components/LearningPageHero'
import { FeatureCourseCard, RichCourseCard, VerticalCourseCard } from '../components/CourseCards'
import { selectRecommended, useCatalog } from '../catalogHooks'

type Filter = 'all' | 'mandatory' | 'courses' | 'quizzes'
type Bucket = 'overdue' | 'week' | 'later' | 'undated'
const DAY = 24 * 60 * 60 * 1000

const hrefOf = (a: LearningAssignment) =>
  a.content_type === 'quiz' ? `/learn/quizzes/${a.content_id}?assignment=${a.id}` : `/learn/player/${a.content_id}?assignment=${a.id}`

function SectionTitle({ id, title, href, linkLabel }: { id: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="font-editorial text-[23px] font-semibold leading-tight text-ds-ink">{title}</h2>
      {href && linkLabel && (
        <Link to={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ds-brass hover:underline">
          {linkLabel}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  )
}

export default function MyLearningPage() {
  const { t, i18n } = useTranslation('training')
  const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-GB'
  const query = useMyAssignments()
  const catalog = useCatalog()
  const certificates = useMyCertificates()
  const [now] = useState(() => Date.now())
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const catalogById = useMemo(() => new Map((catalog.data ?? []).map((c) => [c.id, c])), [catalog.data])
  const cardData = (a: LearningAssignment) => {
    const c = catalogById.get(a.content_id)
    return {
      id: a.content_id,
      title: a.content_title ?? t('untitledAssignment', 'Untitled item'),
      description: c?.description ?? a.content_metadata?.description,
      durationMinutes: c?.estimated_duration_minutes ?? a.content_metadata?.duration,
      level: c?.difficulty_level,
      certificate: c?.certificate_enabled,
      category: c?.category,
    }
  }

  const all = useMemo(() => query.data ?? [], [query.data])
  const isDone = (a: LearningAssignment) => a.progress?.status === 'completed'
  const openItems = useMemo(() => all.filter((a) => !isDone(a)), [all])
  const doneItems = useMemo(
    () => all.filter(isDone).sort((x, y) => Date.parse(y.progress?.completed_at ?? '0') - Date.parse(x.progress?.completed_at ?? '0')),
    [all],
  )
  const inProgress = useMemo(
    () => openItems.filter((a) => a.progress?.status === 'in_progress' || (a.progress?.progress_percentage ?? 0) > 0),
    [openItems],
  )
  const required = useMemo(
    () => openItems
      .filter((a) => a.priority === 'compliance' || (a.due_date && Date.parse(a.due_date) < now))
      .sort((x, y) => (x.due_date ? Date.parse(x.due_date) : Infinity) - (y.due_date ? Date.parse(y.due_date) : Infinity)),
    [openItems, now],
  )
  const resume = useMemo(
    () => [...inProgress].sort((x, y) =>
      Date.parse(y.progress?.last_accessed_at ?? y.progress?.updated_at ?? '0') - Date.parse(x.progress?.last_accessed_at ?? x.progress?.updated_at ?? '0'))[0],
    [inProgress],
  )
  const recommended = useMemo(
    () => selectRecommended(catalog.data, new Set(all.map((a) => a.content_id)), 3),
    [catalog.data, all],
  )

  // Goals = progress against what is actually assigned.
  const mandatory = all.filter((a) => a.priority === 'compliance')
  const goals = [
    { id: 'mandatory', label: t('plan.goalMandatory', 'Complete your mandatory training'), done: mandatory.filter(isDone).length, total: mandatory.length },
    { id: 'assigned', label: t('plan.goalAssigned', 'Complete everything assigned to you'), done: doneItems.length, total: all.length },
  ].filter((g) => g.total > 0)

  // ---- full plan (timeline) --------------------------------------------------
  const matches = (a: LearningAssignment) => {
    const q = text.trim().toLowerCase()
    if (q && !(a.content_title ?? '').toLowerCase().includes(q)) return false
    if (filter === 'mandatory') return a.priority === 'compliance'
    if (filter === 'quizzes') return a.content_type === 'quiz'
    if (filter === 'courses') return a.content_type !== 'quiz'
    return true
  }
  const { buckets, done, openCount } = useMemo(() => {
    const list = all.filter(matches)
    const open = list.filter((a) => !isDone(a))
    const b: Record<Bucket, LearningAssignment[]> = { overdue: [], week: [], later: [], undated: [] }
    for (const a of open) {
      if (!a.due_date) b.undated.push(a)
      else {
        const due = Date.parse(a.due_date)
        b[due < now ? 'overdue' : due - now < 7 * DAY ? 'week' : 'later'].push(a)
      }
    }
    for (const key of Object.keys(b) as Bucket[]) {
      b[key].sort((x, y) => (x.due_date ? Date.parse(x.due_date) : Infinity) - (y.due_date ? Date.parse(y.due_date) : Infinity))
    }
    return { buckets: b, done: list.filter(isDone), openCount: open.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches depends on filter and text
  }, [all, filter, text, now])

  const bucketTitle: Record<Bucket, string> = {
    overdue: t('plan.overdue', 'Overdue'),
    week: t('plan.week', 'Due this week'),
    later: t('plan.later', 'Later'),
    undated: t('plan.undated', 'No due date'),
  }
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('plan.filter.all', 'Everything') },
    { id: 'mandatory', label: t('plan.filter.mandatory', 'Mandatory') },
    { id: 'courses', label: t('plan.filter.courses', 'Courses') },
    { id: 'quizzes', label: t('plan.filter.quizzes', 'Quizzes') },
  ]

  const Row = ({ a }: { a: LearningAssignment }) => {
    const pct = Math.round(a.progress?.progress_percentage ?? 0)
    const completed = isDone(a)
    const started = !completed && (a.progress?.status === 'in_progress' || pct > 0)
    const Icon = a.content_type === 'quiz' ? FileQuestion : BookOpen
    const overdue = !completed && !!a.due_date && Date.parse(a.due_date) < now
    return (
      <li>
        <Link to={hrefOf(a)} className="group grid gap-3 px-4 py-4 hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center sm:gap-6">
          <span className="flex min-w-0 items-center gap-3">
            <CourseCover course={{ id: a.content_id, title: a.content_title, category: catalogById.get(a.content_id)?.category }} className="h-12 w-[72px]">
              <span className="absolute bottom-1 start-1 inline-flex h-5 w-5 items-center justify-center rounded bg-ds-surface/90 text-ds-ink">
                <Icon aria-hidden="true" className="h-3 w-3" />
              </span>
            </CourseCover>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-ds-ink group-hover:underline">{a.content_title ?? t('untitledAssignment', 'Untitled item')}</span>
              <span className="block truncate text-xs text-ds-muted">
                {[
                  a.content_type === 'quiz' ? t('plan.quiz', 'Quiz') : t('plan.course', 'Course'),
                  a.priority === 'compliance' ? t('mandatory', 'Mandatory') : null,
                  completed && a.progress?.completed_at ? t('plan.completedOn', 'Completed {{date}}', { date: date(a.progress.completed_at) }) : a.due_date ? t('plan.due', 'Due {{date}}', { date: date(a.due_date) }) : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
          <span className="hidden sm:block">
            {completed ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-ds-success"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />{t('plan.done', 'Done')}</span>
            ) : started ? (
              <ProgressBar value={pct} label={t('plan.progress', 'Progress')} showPercentage size="sm" />
            ) : (
              <span className="text-sm text-ds-muted">{t('plan.notStarted', 'Not started')}</span>
            )}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', overdue ? 'text-ds-danger' : 'text-ds-accent')}>
            {completed ? t('plan.review', 'Review') : started ? t('myDay.resume', 'Resume') : t('myDay.start', 'Start')}
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
          </span>
        </Link>
      </li>
    )
  }

  const overview = [
    { id: 'progress', value: inProgress.length, label: t('explore.filter.in_progress', 'In progress'), icon: PlayCircle, tone: 'bg-ds-info-soft text-ds-info', href: '#plan-all' },
    { id: 'required', value: required.length, label: t('myDay.required', 'Required'), icon: BookOpen, tone: 'bg-ds-danger-soft text-ds-danger', href: '#plan-all' },
    { id: 'completed', value: doneItems.length, label: t('completed', 'Completed'), icon: CheckCircle2, tone: 'bg-ds-success-soft text-ds-success', href: '#plan-all' },
    { id: 'certificates', value: (certificates.data ?? []).length, label: t('certificates', 'Certificates'), icon: Award, tone: 'bg-ds-brass/15 text-ds-brass', href: '/learn/certificates' },
  ]

  if (query.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState title={t('plan.errorTitle', 'Your learning could not be loaded')} message={t('plan.errorHint', 'Check your connection and try again.')} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <LearningPageHero
        eyebrow={t('plan.eyebrow', 'Learn')}
        title={t('plan.heroTitle', 'Continue your learning')}
        description={t('plan.heroDescription', 'Pick up where you left off and keep building your capabilities.')}
        quote={<>Better<br />People.<br />Brighter<br />Experiences.</>}
        className="pb-24 sm:pb-28"
      />

      <div className="relative z-10 -mt-16 grid items-start gap-8 px-3 sm:px-5 lg:grid-cols-12">
        <div className="space-y-9 lg:col-span-8">
          {query.isLoading ? (
            <Skeleton variant="card" className="h-60" />
          ) : resume ? (
            <FeatureCourseCard
              href={hrefOf(resume)}
              course={cardData(resume)}
              progress={resume.progress?.progress_percentage ?? 0}
              badgeLabel={t('explore.filter.in_progress', 'In progress')}
              actionLabel={t('explore.continue', 'Continue learning')}
            />
          ) : null}

          {required.length > 0 && (
            <section aria-labelledby="plan-required" className="space-y-3">
              <SectionTitle id="plan-required" title={t('myDay.requiredForYou', 'Required for you ({{count}})', { count: required.length })} href="#plan-all" linkLabel={t('myDay.viewAll', 'View all')} />
              <ul className="grid gap-3 xl:grid-cols-2">
                {required.slice(0, 4).map((a) => {
                  const overdue = !!a.due_date && Date.parse(a.due_date) < now
                  return (
                    <li key={a.id}>
                      <RichCourseCard
                        href={hrefOf(a)}
                        course={cardData(a)}
                        badge={{ label: t('myDay.requiredBadge', 'Required'), tone: 'required' }}
                        due={a.due_date ? { label: overdue ? t('myDay.overdueSince', 'Overdue since {{date}}', { date: date(a.due_date) }) : t('myDay.dueOn', 'Due {{date}}', { date: date(a.due_date) }), overdue } : undefined}
                        actionLabel={a.progress?.status === 'in_progress' ? t('explore.continue', 'Continue learning') : t('explore.start', 'Start course')}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {recommended.length > 0 && (
            <section aria-labelledby="plan-recommended" className="space-y-3">
              <SectionTitle id="plan-recommended" title={t('explore.recommended', 'Recommended for you')} href="/learn/courses" linkLabel={t('myDay.viewAll', 'View all')} />
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recommended.map((c) => (
                  <li key={c.id}>
                    <VerticalCourseCard
                      href={`/learn/courses/${c.id}`}
                      course={{ id: c.id, title: c.title, category: c.category, description: c.description, durationMinutes: c.estimated_duration_minutes, level: c.difficulty_level, certificate: c.certificate_enabled }}
                      badge={{ label: t('explore.recommendedBadge', 'Recommended'), tone: 'recommended' }}
                      actionLabel={t('explore.start', 'Start course')}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:col-span-4">
          <section aria-labelledby="plan-overview" className="rounded-[8px] border border-ds-border bg-ds-surface p-5 shadow-[0_12px_32px_rgb(21_33_46/0.05)]">
            <h2 id="plan-overview" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('plan.learningOverview', 'Your learning overview')}</h2>
            <ul className="mt-4 grid grid-cols-2 gap-2.5">
              {overview.map((o) => {
                const inner = (
                  <>
                    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full', o.tone)}><o.icon aria-hidden="true" className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-editorial text-[22px] font-semibold leading-none text-ds-ink tabular-nums">{query.isLoading ? '–' : o.value}</span>
                      <span className="mt-1 block truncate text-xs text-ds-muted">{o.label}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-muted rtl:rotate-180" />
                  </>
                )
                const cls = 'flex min-h-[76px] items-center gap-2.5 rounded-[8px] border border-ds-border px-3 hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent'
                return <li key={o.id}>{o.href.startsWith('#') ? <a href={o.href} className={cls}>{inner}</a> : <Link to={o.href} className={cls}>{inner}</Link>}</li>
              })}
            </ul>
          </section>

          {goals.length > 0 && (
            <section aria-labelledby="plan-goals" className="rounded-[8px] border border-ds-border bg-ds-surface p-5">
              <h2 id="plan-goals" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('plan.goalsTitle', 'Your learning goals')}</h2>
              <ul className="mt-4 space-y-4">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-brass/15 text-ds-brass"><Target aria-hidden="true" className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="flex items-center justify-between gap-2 text-sm text-ds-ink">
                        <span>{g.label}</span>
                        <span className="font-mono text-xs tabular-nums text-ds-muted">{g.done}/{g.total}</span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-ds-surface-subtle" aria-hidden="true">
                        <span className="block h-full rounded-full bg-ds-brass" style={{ width: `${Math.round((g.done / g.total) * 100)}%` }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {doneItems.length > 0 && (
            <section aria-labelledby="plan-recent" className="rounded-[8px] border border-ds-border bg-ds-surface p-5">
              <div className="flex items-center justify-between">
                <h2 id="plan-recent" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('plan.recentlyCompleted', 'Recently completed ({{count}})', { count: doneItems.length })}</h2>
                <Link to="/learn/certificates" className="text-xs font-semibold text-ds-brass hover:underline">{t('myDay.viewAll', 'View all')}</Link>
              </div>
              <ul className="mt-4 space-y-3">
                {doneItems.slice(0, 2).map((a) => (
                  <li key={a.id} className="space-y-3 rounded-[8px] border border-ds-border p-3">
                    <div className="flex items-center gap-3">
                      <CourseCover course={{ id: a.content_id, title: a.content_title, category: catalogById.get(a.content_id)?.category }} className="h-14 w-20 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('myDay.course', 'Course')}</p>
                        <p className="truncate text-sm font-semibold text-ds-ink">{a.content_title ?? t('untitledAssignment', 'Untitled item')}</p>
                        {a.progress?.completed_at && <p className="text-xs text-ds-muted">{t('plan.completedOnDate', 'Completed on {{date}}', { date: date(a.progress.completed_at) })}</p>}
                      </div>
                      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-ds-success" />
                    </div>
                    <Link to="/learn/certificates" className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-ds-border text-sm font-semibold text-ds-brass hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
                      <Award aria-hidden="true" className="h-4 w-4" />
                      {t('myDay.viewCertificate', 'View certificate')}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* Everything assigned, on a timeline */}
      <section id="plan-all" aria-labelledby="plan-all-title" className="mt-12 space-y-4 scroll-mt-24">
        <SectionTitle id="plan-all-title" title={t('plan.allTitle', 'All my learning')} />
        <div className="flex flex-col gap-3 rounded-[8px] border border-ds-border bg-ds-surface p-3 sm:flex-row sm:items-center sm:p-4">
          <div role="search" className="relative flex-1">
            <label htmlFor="plan-search" className="sr-only">{t('plan.searchLabel', 'Search my learning')}</label>
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
            <input id="plan-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('plan.searchPlaceholder', 'Find a course or quiz')}
              className="h-11 w-full rounded-md border border-ds-border-strong bg-ds-surface ps-10 pe-10 text-sm text-ds-ink placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30" />
            {text && <button type="button" onClick={() => setText('')} aria-label={t('plan.clear', 'Clear search')} className="absolute end-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center text-ds-muted"><X aria-hidden="true" className="h-4 w-4" /></button>}
          </div>
          <div role="group" aria-label={t('plan.filterLabel', 'Filter')} className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                className={cn('min-h-[40px] rounded-full border px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
                  filter === f.id ? 'border-ds-ink bg-ds-ink text-ds-on-ink' : 'border-ds-border bg-ds-surface text-ds-ink hover:border-ds-border-strong')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {query.isLoading ? (
          <div className="space-y-3" aria-busy="true"><Skeleton variant="card" className="h-20" /><Skeleton variant="card" className="h-40" /></div>
        ) : openCount === 0 && done.length === 0 ? (
          <EmptyState
            illustration={text || filter !== 'all' ? 'search' : 'courses'}
            title={text || filter !== 'all' ? t('plan.noMatch', 'Nothing matches') : t('plan.emptyTitle', 'Nothing assigned to you yet')}
            description={text || filter !== 'all' ? t('plan.noMatchBody', 'Try another search or filter.') : t('plan.emptyBody', 'When your manager assigns training it appears here with its due date. You can also explore courses yourself.')}
            action={<Link to="/learn/courses" className="text-sm font-semibold text-ds-accent hover:underline">{t('plan.explore', 'Explore courses')}</Link>}
          />
        ) : (
          <div className="space-y-8">
            {openCount === 0 && (
              <p className="flex items-center gap-2 text-[15px] text-ds-success"><CheckCircle2 aria-hidden="true" className="h-5 w-5" />{t('plan.allDone', 'You are up to date. Everything assigned to you is complete.')}</p>
            )}
            {(['overdue', 'week', 'later', 'undated'] as Bucket[]).map((key) => buckets[key].length > 0 && (
              <section key={key} aria-labelledby={`plan-${key}`} className="space-y-2">
                <h3 id={`plan-${key}`} className={cn('flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]', key === 'overdue' ? 'text-ds-danger' : 'text-ds-muted')}>
                  {bucketTitle[key]} <span className="font-mono tabular-nums">{buckets[key].length}</span>
                </h3>
                <ul className={cn('divide-y divide-ds-border overflow-hidden rounded-[8px] border bg-ds-surface', key === 'overdue' ? 'border-ds-danger/40' : 'border-ds-border')}>
                  {buckets[key].map((a) => <Row key={a.id} a={a} />)}
                </ul>
              </section>
            ))}
            {done.length > 0 && (
              <section aria-labelledby="plan-done" className="space-y-2">
                <h3 id="plan-done">
                  <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-ds-ink hover:underline">
                    <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', showDone && 'rotate-180')} />
                    {t('plan.completedTitle', 'Completed ({{count}})', { count: done.length })}
                  </button>
                </h3>
                {showDone && <ul className="divide-y divide-ds-border overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">{done.map((a) => <Row key={a.id} a={a} />)}</ul>}
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
