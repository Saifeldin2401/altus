/**
 * Right-column cards on My day: "Your progress" and "Today's focus".
 * Level, points and streak come from the server-derived learning stats
 * (useMyLearningStats); nothing is estimated on the client.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Award, ChevronRight, Flame, Sun, Target } from 'lucide-react'

import { Skeleton } from '@/ui'

import type { LearningStats } from '../gamification/gamificationApi'
import { LEVEL_TITLES, levelFromPoints } from '../gamification/levels'
import { ProgressRing } from '../gamification/components/ProgressRing'

export function YourProgressCard({ stats, isLoading }: { stats: LearningStats | undefined; isLoading: boolean }) {
  const { t, i18n } = useTranslation('training')
  const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-GB'
  const fmt = (n: number) => n.toLocaleString(locale)

  return (
    <section aria-labelledby="your-progress" className="rounded-[8px] border border-ds-border bg-ds-surface p-5 shadow-[0_12px_32px_rgb(21_33_46/0.04)]">
      <div className="flex items-center justify-between">
        <h2 id="your-progress" className="font-editorial text-[21px] font-semibold text-ds-ink">{t('myDay.yourProgress', 'Your progress')}</h2>
        <Link to="/learn/achievements" className="inline-flex items-center gap-1 text-xs font-semibold text-ds-accent hover:underline">
          {t('myDay.viewAchievements', 'View achievements')}
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {isLoading || !stats ? (
        <Skeleton variant="card" className="mt-4 h-40" />
      ) : (() => {
        const level = levelFromPoints(stats.points_total)
        const levelTitle = t(`game.levels.${level.titleKey}`, LEVEL_TITLES[level.titleKey])
        return (
          <>
            <div className="mt-4 flex items-center gap-5">
              <ProgressRing value={level.percent} size={96} stroke={8} tone="text-ds-brass" label={t('game.levelProgress', 'Level progress')}>
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('myDay.lvl', 'Lvl')}</span>
                  <span className="font-editorial text-[30px] font-semibold text-ds-ink">{level.level}</span>
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-editorial text-lg font-semibold text-ds-ink">{levelTitle}</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-editorial text-[34px] font-semibold leading-none text-ds-ink tabular-nums">{fmt(stats.points_total)}</span>
                  <span className="text-sm text-ds-muted">{t('myDay.points', 'points')}</span>
                </p>
                <p className="text-xs text-ds-brass">
                  {t('myDay.pointsToLevel', '{{points}} points to Level {{level}}', { points: fmt(level.toNext), level: level.level + 1 })}
                </p>
                <span className="block h-1.5 overflow-hidden rounded-full bg-ds-surface-subtle" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ds-brass" style={{ width: `${level.percent}%` }} />
                </span>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-ds-border border-t border-ds-border pt-4 rtl:divide-x-reverse">
              {[
                { icon: Flame, value: stats.streak_current, label: t('myDay.dayStreak', 'day streak'), tone: 'text-ds-warning' },
                { icon: Target, value: stats.counts.courses, label: t('myDay.coursesCompleted', 'courses completed'), tone: 'text-ds-success' },
                { icon: Award, value: stats.counts.certificates, label: t('myDay.certificatesEarned', 'certificates earned'), tone: 'text-ds-brass' },
              ].map((s) => (
                <div key={s.label} className="flex items-start gap-2 px-2 first:ps-0 last:pe-0">
                  <s.icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${s.tone}`} />
                  <div className="min-w-0">
                    <dd className="font-editorial text-xl font-semibold leading-none text-ds-ink tabular-nums">{fmt(s.value)}</dd>
                    <dt className="mt-1 text-[11px] leading-tight text-ds-muted">{s.label}</dt>
                  </div>
                </div>
              ))}
            </dl>
          </>
        )
      })()}
    </section>
  )
}

/**
 * One sentence about today, derived from the member's own work: the most
 * urgent required item if there is one, otherwise their streak.
 */
export function TodaysFocusCard({ urgentTitle, urgentHref, streak }: { urgentTitle?: string; urgentHref?: string; streak?: number }) {
  const { t } = useTranslation('training')
  const message = urgentTitle
    ? t('myDay.focusUrgent', 'Finish "{{title}}" first - it is the most urgent item on your list.', { title: urgentTitle })
    : streak && streak > 0
      ? t('myDay.focusStreak', 'Keep your {{count}}-day streak going with one lesson today.', { count: streak })
      : t('myDay.focusStart', 'Nothing is due. A short lesson today starts a new streak.')
  const body = (
    <>
      <Sun aria-hidden="true" className="h-7 w-7 shrink-0 text-ds-brass" />
      <span className="min-w-0">
        <span className="block font-editorial text-[17px] font-semibold text-ds-ink">{t('myDay.todaysFocus', "Today's focus")}</span>
        <span className="block text-sm text-ds-ink-secondary">{message}</span>
      </span>
    </>
  )
  const cls = 'flex items-start gap-4 rounded-[8px] border border-ds-brass/30 bg-ds-brass/10 p-5'
  return urgentHref
    ? <Link to={urgentHref} className={`${cls} hover:border-ds-brass/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent`}>{body}</Link>
    : <section className={cls}>{body}</section>
}
