/**
 * People and their assigned courses (Manage > Assignments > Overview).
 *
 * One question per region: who needs a follow-up now (top), then every
 * person as one readable row, which opens into their courses and the
 * actions that can be taken on each.
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LearningProgress } from '@/hooks/useLearningProgress'
import { cn } from '@/lib/utils'
import { EmptyState, SectionHeader, Skeleton } from '@/ui'
import { AlertTriangle, ChevronRight, MoreHorizontal, RotateCcw, Search, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TrackerStatusMeta {
  badgeClass: string
  label: string
  progressClass: string
}

interface TrackerRecord {
  id: string
  lastTouchedAt: string
  passed?: boolean
  completed_at?: string
  last_block_index?: number | null
  resolvedModuleTitle: string
  resolvedProgress: number
  resolvedScore: number | null
  status: LearningProgress['status']
  time_spent_seconds?: number | null
}

interface TrackerGroup {
  activeModules: number
  assignedModules: number
  attentionCount: number
  averageProgress: number
  averageScore: number | null
  completedModules: number
  departmentName: string
  highlightModule: TrackerRecord | null
  inProgressModules: number
  lastTouchedAt: string | null
  locationLabel: string
  overdueModules: number
  records: TrackerRecord[]
  totalModules: number
  userId: string
  userInitials: string
  userName: string
  avatarUrl?: string
}

interface TrackerMetrics {
  completed: number
  in_progress: number
  overdue: number
  total: number
  uniqueModules: number
}

interface TrackerSummary {
  averageModulesPerEmployee: number
  averageProgress: number
  averageScore: number | null
  completionRate: number
  employeeCount: number
  employeesNeedingFollowUp: number
}

interface EmployeeProgressTrackerProps {
  describeFollowUp: (group: TrackerGroup) => string
  followUpQueue: TrackerGroup[]
  formatDate: (value: string) => string
  formatDuration: (seconds?: number | null) => string
  getProgressStatusMeta: (status: LearningProgress['status']) => TrackerStatusMeta
  groups: TrackerGroup[]
  isLoading: boolean
  isRTL: boolean
  metrics: TrackerMetrics
  /** No longer shown: a "heaviest load" leaderboard did not lead to an action. */
  moduleLoadLeaders?: TrackerGroup[]
  onViewDetails: (id: string) => void
  summary: TrackerSummary
  onResetProgress?: (userId: string, courseId: string) => void
  onExemptUser?: (userId: string, courseId: string) => void
  isAdmin?: boolean
}

type CourseFilter = 'all' | 'open' | 'done'

const FOLLOW_UP_PREVIEW = 5

function rowId(userId: string) {
  return `person-${userId}`
}

/** A person's courses, filterable, with the actions an admin can take on each. */
function CourseList({
  group,
  getProgressStatusMeta,
  onViewDetails,
  formatDate,
  formatDuration,
  onResetProgress,
  onExemptUser,
  isAdmin,
}: {
  group: TrackerGroup
  getProgressStatusMeta: (status: LearningProgress['status']) => TrackerStatusMeta
  onViewDetails: (id: string) => void
  formatDate: (value: string) => string
  formatDuration: (seconds?: number | null) => string
  onResetProgress?: (userId: string, courseId: string) => void
  onExemptUser?: (userId: string, courseId: string) => void
  isAdmin?: boolean
}) {
  const { t } = useTranslation('training')
  const [filter, setFilter] = useState<CourseFilter>('open')

  const open = useMemo(() => group.records.filter((r) => r.status !== 'completed' && r.status !== 'excused'), [group.records])
  const done = useMemo(() => group.records.filter((r) => r.status === 'completed'), [group.records])
  const shown = filter === 'open' ? open : filter === 'done' ? done : group.records

  const filters: { id: CourseFilter; label: string; count: number }[] = [
    { id: 'open', label: t('people.notFinished', 'Not finished'), count: open.length },
    { id: 'done', label: t('people.done', 'Done'), count: done.length },
    { id: 'all', label: t('people.all', 'All'), count: group.records.length },
  ]

  return (
    <div className="space-y-3">
      <div role="group" aria-label={t('people.showCourses', 'Show courses')} className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
              filter === f.id
                ? 'border-ds-ink bg-ds-ink text-ds-on-ink'
                : 'border-ds-border bg-ds-surface text-ds-ink-secondary hover:border-ds-border-strong'
            )}
          >
            {f.label}
            <span className="font-mono tabular-nums opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[6px] border border-dashed border-ds-border px-4 py-6 text-center text-sm text-ds-muted">
          {filter === 'open'
            ? t('people.nothingOpen', 'Every assigned course is finished.')
            : filter === 'done'
              ? t('people.nothingDone', 'No courses finished yet.')
              : t('people.nothingAssigned', 'No courses assigned.')}
        </p>
      ) : (
        <ul className="divide-y divide-ds-border overflow-hidden rounded-[6px] border border-ds-border bg-ds-surface">
          {shown.map((record) => {
            const meta = getProgressStatusMeta(record.status)
            const isDone = record.status === 'completed'
            const detail = isDone && record.completed_at
              ? t('people.finishedOn', 'Finished {{date}}', { date: formatDate(record.completed_at) })
              : record.last_block_index != null
                ? t('people.atStep', 'At step {{step}}', { step: (record.last_block_index || 0) + 1 })
                : t('people.lastActive', 'Last active {{date}}', { date: formatDate(record.lastTouchedAt) })
            const time = record.time_spent_seconds ? formatDuration(record.time_spent_seconds) : null

            return (
              <li key={record.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_160px_64px_auto]">
                <div className="order-1 min-w-0">
                  <p className="truncate text-sm font-medium text-ds-ink"><bdi>{record.resolvedModuleTitle}</bdi></p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ds-muted">
                    <span className={cn('rounded-full border px-2 py-px font-medium', meta.badgeClass)}>{meta.label}</span>
                    <span>{detail}</span>
                    {time && <span>· {time}</span>}
                  </p>
                </div>

                <div className="order-3 col-span-2 flex items-center gap-2 sm:order-2 sm:col-span-1" aria-label={t('people.progressLabel', '{{value}}% through', { value: record.resolvedProgress })}>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ds-surface-subtle">
                    <div
                      className={cn('h-full rounded-full', isDone ? 'bg-ds-success' : record.status === 'overdue' ? 'bg-ds-danger' : 'bg-ds-ink')}
                      style={{ width: `${Math.max(0, Math.min(100, record.resolvedProgress))}%` }}
                    />
                  </div>
                  <span className="w-9 text-end font-mono text-xs tabular-nums text-ds-ink-secondary">{record.resolvedProgress}%</span>
                  {record.resolvedScore !== null && (
                    <span className="text-xs text-ds-muted sm:hidden">
                      · {t('people.score', 'Score')} <span className="font-mono tabular-nums">{Math.round(record.resolvedScore)}%</span>
                    </span>
                  )}
                </div>

                <div className="order-4 hidden text-end text-sm sm:order-3 sm:block">
                  <span className={cn(
                    'font-mono tabular-nums',
                    record.resolvedScore === null ? 'text-ds-muted' : record.passed ? 'text-ds-success' : 'text-ds-danger'
                  )}>
                    {record.resolvedScore !== null ? `${Math.round(record.resolvedScore)}%` : '—'}
                  </span>
                </div>

                <div className="order-2 flex items-center justify-end gap-1 sm:order-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onViewDetails(record.id)}>
                    {t('people.details', 'Details')}
                  </Button>
                  {isAdmin && (onResetProgress || onExemptUser) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('people.moreFor', 'More actions for {{course}}', { course: record.resolvedModuleTitle })}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {onResetProgress && (
                          <DropdownMenuItem onClick={() => onResetProgress(group.userId, record.id)}>
                            <RotateCcw aria-hidden="true" className="me-2 size-4" />
                            {t('people.resetProgress', 'Start this course again')}
                          </DropdownMenuItem>
                        )}
                        {onExemptUser && !isDone && (
                          <DropdownMenuItem onClick={() => onExemptUser(group.userId, record.id)}>
                            <UserX aria-hidden="true" className="me-2 size-4" />
                            {t('people.exempt', 'Excuse from this course')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function EmployeeProgressTracker({
  describeFollowUp,
  followUpQueue,
  formatDate,
  formatDuration,
  getProgressStatusMeta,
  groups,
  isLoading,
  onViewDetails,
  summary,
  onResetProgress,
  onExemptUser,
  isAdmin,
}: EmployeeProgressTrackerProps) {
  const { t } = useTranslation('training')
  const [openRows, setOpenRows] = useState<string[]>([])
  const [showAllFollowUp, setShowAllFollowUp] = useState(false)

  const openPerson = (userId: string) => {
    setOpenRows((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
    requestAnimationFrame(() => document.getElementById(rowId(userId))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const followUp = showAllFollowUp ? followUpQueue : followUpQueue.slice(0, FOLLOW_UP_PREVIEW)

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="card" className="h-16" />)}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-6 w-6" />}
        title={t('people.emptyTitle', 'Nobody matches these filters')}
        description={t('people.emptyBody', 'Clear the search or choose another department or status.')}
      />
    )
  }

  return (
    <div className="space-y-8">
      {followUpQueue.length > 0 && (
        <section aria-labelledby="people-follow-up" className="overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
          <div className="flex items-start gap-3 border-b border-ds-border px-4 py-3">
            <span aria-hidden="true" className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-ds-danger" />
            <div className="min-w-0 flex-1">
              <h2 id="people-follow-up" className="flex items-center gap-2 text-sm font-semibold text-ds-ink">
                {t('people.followUpTitle', 'Needs follow-up')}
                <span className="rounded-full bg-ds-danger-soft px-2 py-px font-mono text-xs tabular-nums text-ds-danger">{followUpQueue.length}</span>
              </h2>
              <p className="text-xs text-ds-muted">{t('people.followUpBody', 'Overdue courses, or several unfinished at once.')}</p>
            </div>
          </div>
          <ul className="divide-y divide-ds-border">
            {followUp.map((group) => (
              <li key={group.userId} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ds-ink"><bdi>{group.userName}</bdi></p>
                  <p className="truncate text-xs text-ds-muted">
                    {[group.departmentName || t('people.noDepartment', 'No department'), describeFollowUp(group)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openPerson(group.userId)}>
                  {t('people.open', 'Open')}
                  <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
                </Button>
              </li>
            ))}
          </ul>
          {followUpQueue.length > FOLLOW_UP_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllFollowUp((v) => !v)}
              className="w-full border-t border-ds-border px-4 py-2.5 text-start text-sm font-medium text-ds-accent hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent"
            >
              {showAllFollowUp
                ? t('people.showFewer', 'Show fewer')
                : t('people.showAll', 'Show all {{count}}', { count: followUpQueue.length })}
            </button>
          )}
        </section>
      )}

      <section aria-labelledby="people-list" className="space-y-3">
        <SectionHeader
          headingId="people-list"
          title={t('people.title', 'People')}
          subtitle={t('people.subtitle', '{{count}} people · {{rate}}% of assigned courses finished. Open a person to see each course.', {
            count: summary.employeeCount,
            rate: summary.completionRate,
          })}
        />

        <Accordion type="multiple" value={openRows} onValueChange={setOpenRows} className="overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
          {groups.map((group) => {
            const doneShare = group.totalModules > 0 ? Math.round((group.completedModules / group.totalModules) * 100) : 0
            return (
              <AccordionItem
                key={group.userId}
                value={group.userId}
                id={rowId(group.userId)}
                className="scroll-mt-24 border-b border-ds-border last:border-b-0"
              >
                <AccordionTrigger className="gap-3 px-4 py-3 hover:bg-ds-surface-subtle/60 hover:no-underline data-[state=open]:bg-ds-surface-subtle/60">
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <Avatar className="size-9 shrink-0 border border-ds-border">
                      <AvatarImage src={group.avatarUrl || ''} alt="" />
                      <AvatarFallback className="bg-ds-surface-subtle text-xs font-semibold text-ds-ink">{group.userInitials}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ds-ink"><bdi>{group.userName}</bdi></p>
                      <p className="truncate text-xs text-ds-muted">
                        {group.departmentName || t('people.noDepartment', 'No department')}
                        {' · '}
                        {t('people.doneOfTotal', '{{done}} of {{total}} courses finished', { done: group.completedModules, total: group.totalModules })}
                      </p>
                    </div>

                    {group.overdueModules > 0 && (
                      <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-ds-danger sm:inline-flex">
                        <AlertTriangle aria-hidden="true" className="size-3.5" />
                        {t('people.overdueCount', '{{count}} overdue', { count: group.overdueModules })}
                      </span>
                    )}

                    <div className="hidden w-36 shrink-0 items-center gap-2 md:flex" aria-hidden="true">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ds-border/70">
                        <div className="h-full rounded-full bg-ds-ink" style={{ width: `${doneShare}%` }} />
                      </div>
                      <span className="w-9 text-end font-mono text-xs tabular-nums text-ds-ink-secondary">{doneShare}%</span>
                    </div>

                    <div className="hidden w-20 shrink-0 text-end lg:block">
                      <p className="text-[11px] text-ds-muted">{t('people.avgScore', 'Avg score')}</p>
                      <p className="font-mono text-sm tabular-nums text-ds-ink">{group.averageScore !== null ? `${group.averageScore}%` : '—'}</p>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t border-ds-border bg-ds-background/40 px-4 pb-4 pt-4">
                  {group.overdueModules > 0 && (
                    <p className="mb-3 flex items-start gap-2 rounded-[6px] border-s-[3px] border-ds-danger bg-ds-danger-soft px-3 py-2 text-sm text-ds-ink">
                      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ds-danger" />
                      <span>{describeFollowUp(group)}</span>
                    </p>
                  )}
                  <CourseList
                    group={group}
                    getProgressStatusMeta={getProgressStatusMeta}
                    onViewDetails={onViewDetails}
                    formatDate={formatDate}
                    formatDuration={formatDuration}
                    onResetProgress={onResetProgress}
                    onExemptUser={onExemptUser}
                    isAdmin={isAdmin}
                  />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </section>
    </div>
  )
}
