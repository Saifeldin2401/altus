import { GroupedDepartmentSelector } from '@/components/shared/GroupedDepartmentSelector'
import { EmployeeProgressTracker } from '@/components/training/EmployeeProgressTracker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Download, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTrainingAssignmentsContext } from '../contexts/TrainingAssignmentsContext'

export function OverviewTab() {
  const {
    isRTL,
    overviewSearch,
    setOverviewSearch,
    overviewFilterDept,
    setOverviewFilterDept,
    overviewFilterStatus,
    setOverviewFilterStatus,
    departments,
    progressMetrics,
    employeeTrackingSummary,
    employeeProgressGroups,
    followUpQueue,
    isLoadingProgress,
    setSelectedProgressId,
    handleExport,
    submitResetProgress,
    submitExemptUser,
    formatDate,
    formatDuration,
    getProgressStatusMeta,
    describeFollowUp,
  } = useTrainingAssignmentsContext()

  const { t } = useTranslation('training')

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative w-full md:w-64 min-w-0">
            <Search className={cn("absolute top-2.5 h-4 w-4 text-ds-muted", "start-3")} />
            <Input
              placeholder={t('searchEmployeeOrModule')}
              value={overviewSearch}
              onChange={(e) => setOverviewSearch(e.target.value)}
              className={cn("ps-9", "bg-ds-surface border-ds-border text-ds-ink")}
            />
          </div>
          <GroupedDepartmentSelector
            departments={departments}
            value={overviewFilterDept}
            onValueChange={setOverviewFilterDept}
            placeholder={t('filterByDept')}
            generalLabel={t('allDepartments')}
            generalValue="all"
            className="w-full sm:w-[180px] bg-ds-surface border-ds-border text-ds-ink"
          />
          <Select value={overviewFilterStatus} onValueChange={setOverviewFilterStatus}>
            <SelectTrigger className="w-full sm:w-[150px] bg-ds-surface border-ds-border text-ds-ink text-xs font-medium">
              <SelectValue placeholder={t('filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="completed">{t('completed')}</SelectItem>
              <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
              <SelectItem value="overdue">{t('overdue')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          {(overviewSearch || overviewFilterDept !== 'all' || overviewFilterStatus !== 'all') && (
            <Button
              variant="ghost"
              onClick={() => {
                setOverviewSearch('')
                setOverviewFilterDept('all')
                setOverviewFilterStatus('all')
              }}
              className="text-ds-danger hover:text-ds-danger hover:bg-ds-danger-soft text-xs"
            >
              <X className="w-3.5 h-3.5 me-1.5" />
              {t('clearFilters')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle text-xs">
            <Download className={cn("w-4 h-4 text-ds-muted", "me-2")} />
            {t('export')}
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-ds-border bg-ds-border sm:grid-cols-5">
        {[
          { label: t('people.statPeople', 'People'), value: employeeTrackingSummary.employeeCount },
          { label: t('people.statAssigned', 'Courses assigned'), value: progressMetrics.total },
          { label: t('people.statInProgress', 'In progress'), value: progressMetrics.in_progress },
          {
            label: t('people.statOverdue', 'Overdue'),
            value: progressMetrics.overdue,
            hint: employeeTrackingSummary.employeesNeedingFollowUp > 0
              ? t('people.statOverdueHint', '{{count}} people to follow up', { count: employeeTrackingSummary.employeesNeedingFollowUp })
              : undefined,
            tone: progressMetrics.overdue > 0 ? 'danger' : undefined,
          },
          {
            label: t('people.statCompleted', 'Finished'),
            value: progressMetrics.completed,
            hint: t('people.statCompletedHint', '{{rate}}% of assigned', { rate: employeeTrackingSummary.completionRate }),
          },
        ].map((s) => (
          <div key={s.label} className="bg-ds-surface px-4 py-3">
            <dt className="text-xs text-ds-muted">{s.label}</dt>
            <dd className={cn('mt-0.5 font-mono text-2xl font-semibold tabular-nums', s.tone === 'danger' ? 'text-ds-danger' : 'text-ds-ink')}>{s.value}</dd>
            {s.hint && <dd className="text-xs text-ds-muted">{s.hint}</dd>}
          </div>
        ))}
      </dl>

      <EmployeeProgressTracker
        describeFollowUp={describeFollowUp}
        followUpQueue={followUpQueue}
        formatDate={formatDate}
        formatDuration={formatDuration}
        getProgressStatusMeta={getProgressStatusMeta}
        groups={employeeProgressGroups}
        isLoading={isLoadingProgress}
        isRTL={isRTL}
        metrics={progressMetrics}
        onViewDetails={setSelectedProgressId}
        summary={employeeTrackingSummary}
        isAdmin={true}
        onResetProgress={(userId, moduleId) => submitResetProgress(moduleId, userId)}
        onExemptUser={(userId, moduleId) => submitExemptUser(moduleId, userId)}
      />
    </div>
  )
}
