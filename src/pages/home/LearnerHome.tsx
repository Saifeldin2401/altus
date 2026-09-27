/**
 * My day - the Learn workspace home.
 *
 * Answers one question: "What must I do now?" Continue where you left off,
 * what is required (overdue or mandatory), then something new to learn; the
 * side column shows momentum (level, points, streak) and the leaderboard.
 * Every number and every course comes from the member's own data - nothing
 * decorative or invented. Points, levels and the leaderboard are derived on
 * the server from the same learning records.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Award, BookOpen, CheckCircle2, ChevronRight, FileCheck2, FileQuestion } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useMyCertificates } from '@/hooks/useCertificates'
import { useRequiredReading } from '@/hooks/useKnowledge'
import { useTenant } from '@/contexts/TenantContext'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { useMyAssignments } from '@/hooks/useTraining'
import type { LearningAssignment } from '@/types/learning'
import { Celebration, useMilestones } from '@/features/learn/gamification/components/Celebration'
import { FirstRunWelcomeModal } from '@/features/learn/gamification/components/FirstRunWelcomeModal'
import { LeaderboardPanel } from '@/features/learn/gamification/components/LeaderboardPanel'
import { useMyLearningStats, useWelcomeSeen } from '@/features/learn/gamification/gamificationHooks'
import { LearningPageHero } from '@/features/learn/components/LearningPageHero'
import { LearningStatusCard } from '@/features/learn/components/LearningStatusCard'
import { CompactCourseCard, FeatureCourseCard, RichCourseCard } from '@/features/learn/components/CourseCards'
import { TodaysFocusCard, YourProgressCard } from '@/features/learn/components/ProgressSidebarCards'
import { selectRecommended, useCatalog } from '@/features/learn/catalogHooks'
import { ActionQueue, EmptyState, ErrorState, Skeleton, type ActionQueueItem } from '@/ui'

function assignmentHref(a: LearningAssignment): string {
    return a.content_type === 'quiz'
        ? `/learn/quizzes/${a.content_id}?assignment=${a.id}`
        : `/learn/player/${a.content_id}?assignment=${a.id}`
}

function SectionTitle({ id, title, subtitle, href, linkLabel }: { id: string; title: string; subtitle?: string; href?: string; linkLabel?: string }) {
    return (
        <div className="flex items-end justify-between gap-4">
            <div>
                <h2 id={id} className="font-editorial text-[23px] font-semibold leading-tight text-ds-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-ds-muted">{subtitle}</p>}
            </div>
            {href && linkLabel && (
                <Link to={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ds-brass hover:underline">
                    {linkLabel}
                    <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                </Link>
            )}
        </div>
    )
}

export default function LearnerHome() {
    const { t, i18n } = useTranslation(['training', 'common'])
    const { user, profile } = useAuth()
    const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-GB'

    // Captured once so "overdue" does not shift during a render pass.
    const [now] = useState(() => Date.now())

    const progressQuery = useLearningProgress({ userId: user?.id ?? null })
    const assignmentsQuery = useMyAssignments()
    const certificatesQuery = useMyCertificates()
    const readingQuery = useRequiredReading()
    const catalogQuery = useCatalog()
    const { currentOrganization } = useTenant()
    const statsQuery = useMyLearningStats()
    const milestones = useMilestones(statsQuery.data, user?.id, currentOrganization?.id)
    const welcomeSeenQuery = useWelcomeSeen()
    const [welcomeDismissed, setWelcomeDismissed] = useState(false)
    const showWelcome = !welcomeDismissed && welcomeSeenQuery.isSuccess && welcomeSeenQuery.data === false

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

    const catalogById = useMemo(() => new Map((catalogQuery.data ?? []).map((c) => [c.id, c])), [catalogQuery.data])
    const open = useMemo(
        () => (assignmentsQuery.data ?? []).filter((a) => a.progress?.status !== 'completed'),
        [assignmentsQuery.data],
    )

    // Required: overdue, or mandatory for compliance - most urgent first.
    const required = useMemo(
        () => open
            .filter((a) => (a.due_date && Date.parse(a.due_date) < now) || a.priority === 'compliance')
            .sort((x, y) => (x.due_date ? Date.parse(x.due_date) : Infinity) - (y.due_date ? Date.parse(y.due_date) : Infinity)),
        [open, now],
    )

    const readingToAcknowledge = useMemo<ActionQueueItem[]>(
        () => (readingQuery.data ?? [])
            .filter((r) => !r.is_acknowledged)
            .map((r) => ({
                id: `read-${r.document_id}`,
                title: r.title,
                description: t('training:myDay.readRequired', 'Required reading'),
                tone: 'attention',
                icon: FileCheck2,
                href: `/knowledge/${r.document_id}`,
                actionLabel: t('training:myDay.readAndAcknowledge', 'Read and acknowledge'),
            } satisfies ActionQueueItem)),
        [readingQuery.data, t],
    )
    const requiredCount = required.length + readingToAcknowledge.length

    // Continue: the course touched most recently and not yet finished.
    const continueLearning = useMemo(() => {
        return [...(progressQuery.data ?? [])]
            .filter((p) => p.status === 'in_progress' && p.content_type === 'module')
            .sort((a, b) => Date.parse(b.last_accessed_at ?? '0') - Date.parse(a.last_accessed_at ?? '0'))[0]
    }, [progressQuery.data])

    const completedCount = useMemo(() => (progressQuery.data ?? []).filter((p) => p.status === 'completed').length, [progressQuery.data])
    const inProgressCount = useMemo(() => (progressQuery.data ?? []).filter((p) => p.status === 'in_progress').length, [progressQuery.data])

    const recommended = useMemo(() => {
        const touched = new Set<string>([
            ...(progressQuery.data ?? []).map((p) => p.content_id),
            ...(assignmentsQuery.data ?? []).map((a) => a.content_id),
        ])
        return selectRecommended(catalogQuery.data, touched, 3)
    }, [catalogQuery.data, progressQuery.data, assignmentsQuery.data])

    const firstName = profile?.full_name?.split(' ')[0]
    const hour = new Date(now).getHours()
    const greeting = hour < 12
        ? t('training:myDay.goodMorning', 'Good morning')
        : hour < 18
            ? t('training:myDay.goodAfternoon', 'Good afternoon')
            : t('training:myDay.goodEvening', 'Good evening')
    const today = new Date(now).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
    const certificates = certificatesQuery.data ?? []

    const continueCourse = continueLearning ? catalogById.get(continueLearning.content_id) : undefined
    const continuePct = continueLearning?.progress_percentage ?? 0
    const remainingMinutes = continueCourse?.estimated_duration_minutes
        ? Math.max(1, Math.round(continueCourse.estimated_duration_minutes * (1 - continuePct / 100)))
        : null

    return (
        <div className="mx-auto max-w-7xl">
            <LearningPageHero
                eyebrow={today}
                title={firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
                description={<span className="font-editorial text-[22px] text-ds-ink sm:text-[26px]">{t('training:myDay.heroSubtitle', "Here's what matters today.")}</span>}
                quote={<>Learn.<br />Perform.<br />Grow.<br />Belong.</>}
                className="pb-24 sm:pb-28"
            />

            {/* Summary - overlaps the hero's lower edge as in the design */}
            <section aria-label={t('training:myDay.learningSummary', 'Your learning summary')} className="relative z-10 -mt-16 grid gap-3 px-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
                <LearningStatusCard title={t('training:myDay.inProgress', 'In progress')} value={progressQuery.isLoading ? '–' : inProgressCount} detail={t('training:myDay.courses', 'courses')} href="/learn/my" icon={BookOpen} tone="gold" />
                <LearningStatusCard title={t('training:myDay.required', 'Required')} value={assignmentsQuery.isLoading ? '–' : requiredCount} detail={t('training:myDay.courses', 'courses')} href="/learn/my" icon={FileQuestion} tone="rose" />
                <LearningStatusCard title={t('training:completed', 'Completed')} value={progressQuery.isLoading ? '–' : completedCount} detail={t('training:myDay.courses', 'courses')} href="/learn/my" icon={CheckCircle2} tone="green" />
                <LearningStatusCard title={t('training:certificates', 'Certificates')} value={certificatesQuery.isLoading ? '–' : certificates.length} detail={t('training:myDay.earned', 'earned')} href="/learn/certificates" icon={Award} tone="gold" />
            </section>

            <div className="mt-8 grid items-start gap-8 lg:grid-cols-12">
                <div className="space-y-9 lg:col-span-8">
                    {/* 1. Continue where you left off */}
                    <section aria-labelledby="my-day-continue" className="space-y-3">
                        <SectionTitle id="my-day-continue" title={t('training:myDay.continue', 'Continue where you left off')} href="/learn/my" linkLabel={t('training:myDay.viewAll', 'View all')} />
                        {progressQuery.isLoading ? (
                            <Skeleton variant="card" className="h-60" />
                        ) : continueLearning ? (
                            <FeatureCourseCard
                                href={`/learn/player/${continueLearning.content_id}`}
                                course={{
                                    id: continueLearning.content_id,
                                    title: continueLearning.courses?.title ?? continueCourse?.title ?? t('training:untitledAssignment', 'Untitled item'),
                                    description: continueCourse?.description,
                                    durationMinutes: continueCourse?.estimated_duration_minutes,
                                    level: continueCourse?.difficulty_level,
                                    certificate: continueCourse?.certificate_enabled,
                                    category: continueCourse?.category,
                                }}
                                progress={continuePct}
                                badgeLabel={t('training:explore.filter.in_progress', 'In progress')}
                                remainingLabel={remainingMinutes ? t('training:myDay.minutesRemaining', '{{count}} min remaining', { count: remainingMinutes }) : undefined}
                                actionLabel={t('training:explore.continue', 'Continue learning')}
                            />
                        ) : (
                            <EmptyState
                                illustration="courses"
                                title={t('training:myDay.nothingInProgress', 'Nothing in progress')}
                                description={t('training:myDay.nothingInProgressHint', 'Start a required course below, or explore the catalog.')}
                                action={<Link to="/learn/courses" className="text-sm font-semibold text-ds-accent hover:underline">{t('training:plan.explore', 'Explore courses')}</Link>}
                            />
                        )}
                    </section>

                    {/* 2. Required for you */}
                    <section aria-labelledby="my-day-required" className="space-y-3">
                        <SectionTitle
                            id="my-day-required"
                            title={t('training:myDay.requiredForYou', 'Required for you ({{count}})', { count: requiredCount })}
                            href="/learn/my"
                            linkLabel={t('training:myDay.viewAll', 'View all')}
                        />
                        {assignmentsQuery.isLoading ? (
                            <div className="grid gap-3 xl:grid-cols-2"><Skeleton variant="card" className="h-44" /><Skeleton variant="card" className="h-44" /></div>
                        ) : assignmentsQuery.isError ? (
                            <ErrorState message={t('training:myDay.loadError', 'Your assignments could not be loaded.')} onRetry={() => void assignmentsQuery.refetch()} />
                        ) : requiredCount === 0 ? (
                            <p className="flex items-center gap-2 rounded-xl border border-ds-border bg-ds-surface px-4 py-5 text-sm text-ds-ink-secondary">
                                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-ds-success" />
                                {t('training:myDay.nothingRequiredHint', 'You have no overdue or mandatory training.')}
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {required.length > 0 && (
                                    <ul className="grid gap-3 xl:grid-cols-2">
                                        {required.slice(0, 4).map((a) => {
                                            const course = catalogById.get(a.content_id)
                                            const overdue = !!a.due_date && Date.parse(a.due_date) < now
                                            return (
                                                <li key={a.id}>
                                                    <RichCourseCard
                                                        href={assignmentHref(a)}
                                                        course={{
                                                            id: a.content_id,
                                                            title: a.content_title ?? t('training:untitledAssignment', 'Untitled item'),
                                                            description: course?.description ?? a.content_metadata?.description,
                                                            durationMinutes: course?.estimated_duration_minutes ?? a.content_metadata?.duration,
                                                            level: course?.difficulty_level,
                                                            certificate: course?.certificate_enabled,
                                                            category: course?.category,
                                                        }}
                                                        badge={{ label: t('training:myDay.requiredBadge', 'Required'), tone: 'required' }}
                                                        due={a.due_date ? {
                                                            label: overdue
                                                                ? t('training:myDay.overdueSince', 'Overdue since {{date}}', { date: formatDate(a.due_date) })
                                                                : t('training:myDay.dueOn', 'Due {{date}}', { date: formatDate(a.due_date) }),
                                                            overdue,
                                                        } : undefined}
                                                        actionLabel={a.progress?.status === 'in_progress' ? t('training:explore.continue', 'Continue learning') : t('training:explore.start', 'Start course')}
                                                    />
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                                {readingToAcknowledge.length > 0 && <ActionQueue items={readingToAcknowledge} emptyTitle="" emptyDescription="" />}
                            </div>
                        )}
                    </section>

                    {/* 3. Recommended for you */}
                    {recommended.length > 0 && (
                        <section aria-labelledby="my-day-recommended" className="space-y-3">
                            <SectionTitle
                                id="my-day-recommended"
                                title={t('training:explore.recommended', 'Recommended for you')}
                                subtitle={t('training:myDay.recommendedHint', 'Based on your role, department and learning activity.')}
                                href="/learn/courses"
                                linkLabel={t('training:myDay.viewAll', 'View all')}
                            />
                            <ul className="grid gap-3 md:grid-cols-3">
                                {recommended.map((c) => (
                                    <li key={c.id}>
                                        <CompactCourseCard href={`/learn/courses/${c.id}`} course={{ id: c.id, title: c.title, category: c.category, description: c.description, durationMinutes: c.estimated_duration_minutes, level: c.difficulty_level }} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                <aside className="space-y-5 lg:col-span-4">
                    {!statsQuery.isError && <YourProgressCard stats={statsQuery.data} isLoading={statsQuery.isLoading} />}
                    <TodaysFocusCard
                        urgentTitle={required[0]?.content_title}
                        urgentHref={required[0] ? assignmentHref(required[0]) : undefined}
                        streak={statsQuery.data?.streak_current}
                    />
                    <section aria-labelledby="my-day-board" className="space-y-3 rounded-2xl border border-ds-border bg-ds-surface p-5 shadow-[0_12px_32px_rgb(21_33_46/0.04)]">
                        <div className="flex items-center justify-between">
                            <h2 id="my-day-board" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('training:game.board.title', 'Leaderboard')}</h2>
                            <Link to="/learn/achievements" className="inline-flex items-center gap-1 text-xs font-semibold text-ds-accent hover:underline">
                                {t('training:game.board.seeAll', 'See all')}
                                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
                            </Link>
                        </div>
                        <LeaderboardPanel compact />
                    </section>
                </aside>
            </div>

            <Celebration milestone={milestones.current} onClose={milestones.dismiss} />
            <FirstRunWelcomeModal isOpen={showWelcome} onClose={() => setWelcomeDismissed(true)} />
        </div>
    )
}
