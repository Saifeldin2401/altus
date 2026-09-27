/**
 * Course cards shared by My day, My learning and Explore.
 *
 * Both render only facts the record actually has: a missing duration, level or
 * due date is simply not shown - never a placeholder number.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Award, BarChart3, ChevronRight, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CourseCover } from '../gamification/components/CourseCover'

export interface CourseCardData {
  id: string
  title: string
  description?: string | null
  durationMinutes?: number | null
  level?: string | null
  certificate?: boolean | null
  /** Picks a topic-matched cover photo (see gamification/covers.ts). */
  category?: string | null
}

function CourseMeta({ course, className }: { course: CourseCardData; className?: string }) {
  const { t } = useTranslation('training')
  const items = [
    course.durationMinutes ? (
      <span key="d" className="inline-flex items-center gap-1">
        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
        {t('explore.minutes', '{{count}} min', { count: course.durationMinutes })}
      </span>
    ) : null,
    course.level ? (
      <span key="l" className="inline-flex items-center gap-1">
        <BarChart3 aria-hidden="true" className="h-3.5 w-3.5" />
        {t(`explore.level.${course.level.toLowerCase()}`, course.level)}
      </span>
    ) : null,
    course.certificate ? (
      <span key="c" className="inline-flex items-center gap-1 text-ds-brass">
        <Award aria-hidden="true" className="h-3.5 w-3.5" />
        {t('explore.certificate', 'Certificate')}
      </span>
    ) : null,
  ].filter(Boolean)
  if (items.length === 0) return null
  return <span className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ds-muted', className)}>{items}</span>
}

interface RichCourseCardProps {
  course: CourseCardData
  href: string
  badge?: { label: string; tone: 'required' | 'progress' | 'recommended' | 'done' }
  /** e.g. "Due 30 Sep" - rendered as a pill; `overdue` turns it red. */
  due?: { label: string; overdue?: boolean }
  progress?: number
  actionLabel: string
}

const BADGE_TONE = {
  required: 'bg-ds-danger',
  progress: 'bg-ds-success',
  recommended: 'bg-ds-brass',
  done: 'bg-ds-ink',
} as const

/** Image-led card: "Required for you" and featured courses. */
export function RichCourseCard({ course, href, badge, due, progress, actionLabel }: RichCourseCardProps) {
  const { t } = useTranslation('training')
  return (
    <Link
      to={href}
      className="group flex h-full flex-col gap-4 rounded-xl border border-ds-border bg-ds-surface p-3 shadow-[0_12px_32px_rgb(21_33_46/0.04)] transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-ds-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent motion-reduce:hover:translate-y-0 sm:flex-row"
    >
      <CourseCover course={{ id: course.id, title: course.title, category: course.category, description: course.description }} className="h-40 w-full rounded-lg sm:h-auto sm:min-h-[152px] sm:w-40">
        {badge && (
          <span className={cn('absolute start-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white', BADGE_TONE[badge.tone])}>
            {badge.label}
          </span>
        )}
      </CourseCover>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('myDay.course', 'Course')}</span>
          {due && (
            <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium', due.overdue ? 'bg-ds-danger-soft text-ds-danger' : 'bg-ds-warning-soft text-ds-warning')}>
              {due.label}
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-[17px] font-semibold leading-snug text-ds-ink group-hover:underline">{course.title}</span>
        {course.description && <span className="line-clamp-2 text-sm leading-snug text-ds-ink-secondary">{course.description}</span>}
        {typeof progress === 'number' && progress > 0 && (
          <span className="flex items-center gap-2" aria-label={t('myDay.progress', 'Progress') + ` ${Math.round(progress)}%`}>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ds-surface-subtle">
              <span className="block h-full rounded-full bg-ds-brass" style={{ width: `${Math.min(100, Math.round(progress))}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums text-ds-ink">{Math.round(progress)}%</span>
          </span>
        )}
        <CourseMeta course={course} />
        <span className="mt-auto inline-flex min-h-[40px] w-full items-center justify-between rounded-lg bg-ds-ink px-4 text-sm font-semibold text-ds-on-ink sm:w-auto sm:self-start sm:gap-6">
          {actionLabel}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </span>
      </span>
    </Link>
  )
}

/** Small horizontal card for "Recommended for you" rows. */
export function CompactCourseCard({ course, href }: { course: CourseCardData; href: string }) {
  const { t } = useTranslation('training')
  return (
    <Link
      to={href}
      className="group flex h-full items-center gap-3 rounded-xl border border-ds-border bg-ds-surface p-2.5 transition-colors hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
    >
      <CourseCover course={{ id: course.id, title: course.title, category: course.category, description: course.description }} className="h-16 w-20 rounded-lg" />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('myDay.course', 'Course')}</span>
        <span className="line-clamp-2 block text-sm font-semibold leading-snug text-ds-ink group-hover:underline">{course.title}</span>
        <CourseMeta course={{ ...course, certificate: false }} />
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-muted rtl:rotate-180" />
    </Link>
  )
}

interface FeatureCourseCardProps {
  course: CourseCardData
  href: string
  progress: number
  badgeLabel: string
  actionLabel: string
  /** e.g. "18 min remaining" - only when it can be computed. */
  remainingLabel?: string
}

/** The large "Continue where you left off" card: photo on one side, details on the other. */
export function FeatureCourseCard({ course, href, progress, badgeLabel, actionLabel, remainingLabel }: FeatureCourseCardProps) {
  const { t } = useTranslation('training')
  const pct = Math.min(100, Math.max(0, Math.round(progress)))
  return (
    <div className="grid overflow-hidden rounded-2xl border border-ds-border bg-ds-surface shadow-[0_16px_40px_rgb(21_33_46/0.06)] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <CourseCover course={{ id: course.id, title: course.title, category: course.category, description: course.description }} className="h-52 w-full rounded-none md:h-full md:min-h-[236px]">
        <span className="absolute start-3 top-3 rounded-md bg-ds-success px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{badgeLabel}</span>
      </CourseCover>
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('myDay.course', 'Course')}</span>
        <Link to={href} className="font-editorial text-[24px] font-semibold leading-tight text-ds-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
          {course.title}
        </Link>
        {course.description && <p className="line-clamp-2 text-sm leading-relaxed text-ds-ink-secondary">{course.description}</p>}
        <div className="flex items-center gap-3" aria-label={`${t('myDay.progress', 'Progress')} ${pct}%`}>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-ds-surface-subtle">
            <span className="block h-full rounded-full bg-ds-brass" style={{ width: `${pct}%` }} />
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ds-ink">{pct}%</span>
        </div>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ds-muted">
          {remainingLabel && <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{remainingLabel}</span>}
          <CourseMeta course={{ ...course, durationMinutes: remainingLabel ? null : course.durationMinutes }} />
        </span>
        <Link
          to={href}
          className="mt-auto inline-flex min-h-[44px] items-center justify-between gap-8 self-start rounded-lg bg-ds-ink px-5 text-sm font-semibold text-ds-on-ink hover:bg-ds-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2"
        >
          {actionLabel}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  )
}

/** Photo-on-top card used for "Recommended for you" on Explore and My learning. */
export function VerticalCourseCard({
  course, href, badge, progress, actionLabel,
}: { course: CourseCardData; href: string; badge?: RichCourseCardProps['badge']; progress?: number; actionLabel: string }) {
  return (
    <Link
      to={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-surface shadow-[0_12px_32px_rgb(21_33_46/0.04)] transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-ds-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent motion-reduce:hover:translate-y-0"
    >
      <CourseCover course={{ id: course.id, title: course.title, category: course.category, description: course.description }} className="h-36 w-full rounded-none">
        {badge && <span className={cn('absolute start-3 top-3 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white', BADGE_TONE[badge.tone])}>{badge.label}</span>}
      </CourseCover>
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="line-clamp-2 text-[17px] font-semibold leading-snug text-ds-ink group-hover:underline">{course.title}</span>
        {course.description && <span className="line-clamp-2 text-sm leading-snug text-ds-ink-secondary">{course.description}</span>}
        {typeof progress === 'number' && progress > 0 && (
          <span className="flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ds-surface-subtle"><span className="block h-full rounded-full bg-ds-brass" style={{ width: `${Math.min(100, Math.round(progress))}%` }} /></span>
            <span className="font-mono text-xs tabular-nums text-ds-ink">{Math.round(progress)}%</span>
          </span>
        )}
        <CourseMeta course={course} className="mt-auto pt-1" />
        <span className="mt-1 inline-flex min-h-[40px] items-center justify-between rounded-lg bg-ds-ink px-3.5 text-sm font-semibold text-ds-on-ink">
          {actionLabel}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </span>
      </span>
    </Link>
  )
}
