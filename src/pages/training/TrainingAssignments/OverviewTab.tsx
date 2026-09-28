import { GroupedDepartmentSelector } from '@/components/shared/GroupedDepartmentSelector'
import { EmployeeProgressTracker } from '@/components/training/EmployeeProgressTracker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
    AlertTriangle,
    BookOpen,
    CheckCircle2,
    Clock,
    Download,
    Search,
    TrendingUp,
    Users,
    X
} from 'lucide-react'
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
    moduleLoadLeaders,
    isLoadingProgress,
    setSelectedProgressId,
    handleExport,
    submitResetProgress,
    submitExemptUser,
    submitRestoreUser,
    formatDate,
    formatDuration,
    getProgressStatusMeta,
    describeFollowUp,
    toast,
    t: tCtx,
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

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none hover:border-ds-border-strong transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-ds-accent-soft text-ds-accent">
              <BookOpen className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{progressMetrics.uniqueModules}</p>
              <p className="truncate text-xs text-ds-muted">{t('modules', 'Modules')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none hover:border-ds-border-strong transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-ds-accent-soft text-ds-accent">
              <Users className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{employeeTrackingSummary.employeeCount}</p>
              <p className="truncate text-xs text-ds-muted">{t('staff', 'Staff')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none hover:border-ds-border-strong transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-ds-accent-soft text-ds-accent">
              <TrendingUp className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{progressMetrics.total}</p>
              <p className="truncate text-xs text-ds-muted">{t('totalEnrollments', 'Total Enrollments')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none hover:border-ds-border-strong transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-ds-accent-soft text-ds-accent">
              <Clock className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{progressMetrics.in_progress}</p>
              <p className="truncate text-xs text-ds-muted">{t('inProgress')} · {employeeTrackingSummary.averageProgress}%</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-[8px] border p-4 shadow-none transition-colors",
          progressMetrics.overdue > 0 ? "border-ds-danger/40 bg-ds-danger-soft/20 hover:border-ds-danger" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-[6px]",
              progressMetrics.overdue > 0 ? "bg-ds-danger-soft text-ds-danger" : "bg-ds-surface-subtle text-ds-muted"
            )}>
              <AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-2xl font-bold font-mono tracking-tight", progressMetrics.overdue > 0 ? "text-ds-danger" : "text-ds-ink")}>
                {progressMetrics.overdue}
              </p>
              <p className="truncate text-xs text-ds-muted">{t('overdue')} · {employeeTrackingSummary.employeesNeedingFollowUp} {t('followUpFlag', 'follow-up')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none hover:border-ds-border-strong transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-ds-success-soft text-ds-success">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{progressMetrics.completed}</p>
              <p className="truncate text-xs text-ds-muted">{t('completed')} · {employeeTrackingSummary.completionRate}%</p>
            </div>
          </div>
        </div>
      </div>

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
        moduleLoadLeaders={moduleLoadLeaders}
        onViewDetails={setSelectedProgressId}
        summary={employeeTrackingSummary}
        isAdmin={true}
        onResetProgress={(userId, moduleId) => submitResetProgress(moduleId, userId)}
        onRevokeCertificate={(userId, moduleId) => {
          toast({
            title: tCtx('certificateRevoked', 'Certificate Revoked'),
            description: tCtx('certificateRevokedDesc', 'The certificate has been revoked successfully.')
          })
        }}
        onExemptUser={(userId, moduleId) => submitExemptUser(moduleId, userId)}
        onRestoreUser={(userId, moduleId) => submitRestoreUser(moduleId, userId)}
      />
    </div>
  )
}
