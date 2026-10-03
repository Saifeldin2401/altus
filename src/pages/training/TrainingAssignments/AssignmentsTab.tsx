import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
    BookOpen,
    CheckCircle2,
    Filter,
    Grid3X3,
    LayoutList,
    Loader2,
    MapPin,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    Users,
    X,
    Building
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTrainingAssignmentsContext } from '../contexts/TrainingAssignmentsContext'

export function AssignmentsTab() {
  const {
    isLoadingAssignments,
    hideCreateButton,
    search,
    setSearch,
    assignmentsViewMode,
    setAssignmentsViewMode,
    assignmentsSortBy,
    setAssignmentsSortBy,
    showFilters,
    setShowFilters,
    assignmentsFilterPriority,
    setAssignmentsFilterPriority,
    assignmentsFilterTargetType,
    setAssignmentsFilterTargetType,
    assignmentsFilterDueStatus,
    setAssignmentsFilterDueStatus,
    resetOrganizationState,
    assignmentStats,
    groupedAssignments,
    exemptionCountByModule,
    getTargetDetails,
    formatDate,
    handleDelete,
    openManageAssignees,
    setShowAssignmentDialog,
  } = useTrainingAssignmentsContext()

  const { t } = useTranslation('training')

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'all':
      case 'everyone': return <Users className="w-4 h-4" />
      case 'user': return <Users className="w-4 h-4" />
      case 'department': return <Building className="w-4 h-4" />
      case 'property': return <MapPin className="w-4 h-4" />
      default: return <Users className="w-4 h-4" />
    }
  }

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'all':
      case 'everyone': return t('allUsers')
      case 'user': return t('specificUser')
      case 'department': return t('department')
      case 'property': return t('property')
      default: return t('allUsers')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-muted uppercase tracking-wider">{t('totalAssignments', 'Total')}</span>
            <span className="font-mono text-xl font-bold text-ds-ink">{assignmentStats.total}</span>
          </div>
        </div>
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-danger uppercase tracking-wider">{t('compliancePriority', 'Compliance')}</span>
            <span className="font-mono text-xl font-bold text-ds-danger">{assignmentStats.byPriority.compliance}</span>
          </div>
        </div>
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-warning uppercase tracking-wider">{t('highPriority', 'High')}</span>
            <span className="font-mono text-xl font-bold text-ds-warning">{assignmentStats.byPriority.high}</span>
          </div>
        </div>
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-danger uppercase tracking-wider">{t('overdue', 'Overdue')}</span>
            <span className="font-mono text-xl font-bold text-ds-danger">{assignmentStats.overdue}</span>
          </div>
        </div>
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-accent uppercase tracking-wider">{t('dueSoon', 'Due Soon')}</span>
            <span className="font-mono text-xl font-bold text-ds-accent">{assignmentStats.dueSoon}</span>
          </div>
        </div>
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-3 transition-colors hover:border-ds-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ds-muted uppercase tracking-wider">{t('everyone', 'Everyone')}</span>
            <span className="font-mono text-xl font-bold text-ds-ink">{assignmentStats.byTargetType.everyone}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[8px] border border-ds-border bg-ds-surface p-4 shadow-none">
        <div className={cn(
          "flex flex-col sm:flex-row items-stretch sm:items-center gap-3",
          hideCreateButton ? "justify-start" : "justify-between"
        )}>
          <div className="relative flex-1 max-w-none sm:max-w-md">
            <div className={cn(
              "absolute inset-y-0 flex items-center pointer-events-none",
              "start-0 ps-3.5"
            )}>
              <Search className="w-4 h-4 text-ds-muted" />
            </div>
            <Input
              placeholder={t('searchAssignments')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "h-9 bg-ds-surface-subtle border-ds-border text-ds-ink placeholder:text-ds-muted focus:border-ds-border-strong transition-all text-xs",
                "ps-9"
              )}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className={cn(
                  "absolute inset-y-0 flex items-center text-ds-muted hover:text-ds-ink transition-colors",
                  "end-0 pe-3"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-ds-surface-subtle rounded-md p-0.5 border border-ds-border">
              <button
                onClick={() => setAssignmentsViewMode('grid')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all",
                  assignmentsViewMode === 'grid'
                    ? "bg-ds-surface text-ds-ink shadow-2xs font-semibold"
                    : "text-ds-muted hover:text-ds-ink"
                )}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                {t('grid', 'Grid')}
              </button>
              <button
                onClick={() => setAssignmentsViewMode('list')}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all",
                  assignmentsViewMode === 'list'
                    ? "bg-ds-surface text-ds-ink shadow-2xs font-semibold"
                    : "text-ds-muted hover:text-ds-ink"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                {t('list', 'List')}
              </button>
            </div>

            <Select value={assignmentsSortBy} onValueChange={(v) => setAssignmentsSortBy(v as 'date' | 'priority' | 'module' | 'dueDate')}>
              <SelectTrigger className="w-[140px] h-9 bg-ds-surface-subtle border-ds-border text-ds-ink text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 me-1.5 text-ds-muted" />
                <SelectValue placeholder={t('sortBy', 'Sort by')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t('dateCreated', 'Date Created')}</SelectItem>
                <SelectItem value="priority">{t('priority', 'Priority')}</SelectItem>
                <SelectItem value="module">{t('moduleName', 'Module Name')}</SelectItem>
                <SelectItem value="dueDate">{t('dueDate', 'Due Date')}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-9 px-3 border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle text-xs transition-all",
                showFilters && "bg-ds-surface-subtle border-ds-border-strong"
              )}
            >
              <Filter className="w-3.5 h-3.5 me-1.5 text-ds-muted" />
              {t('filters', 'Filters')}
              {(assignmentsFilterPriority !== 'all' || assignmentsFilterTargetType !== 'all' || assignmentsFilterDueStatus !== 'all') && (
                <span className="ms-1.5 w-2 h-2 rounded-full bg-ds-accent" />
              )}
            </Button>

            {!hideCreateButton && (
              <Button
                onClick={() => setShowAssignmentDialog(true)}
                className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 h-9 px-3.5 text-xs font-semibold shadow-none transition-all rounded-md"
              >
                <Plus className={cn("w-3.5 h-3.5", "me-1.5")} />
                {t('create')}
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-ds-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-ds-muted font-medium">{t('filterBy', 'Filter by')}:</span>

              <Select value={assignmentsFilterPriority} onValueChange={setAssignmentsFilterPriority}>
                <SelectTrigger className="w-[130px] h-8 bg-ds-surface-subtle border-ds-border text-xs text-ds-ink">
                  <SelectValue placeholder={t('priority', 'Priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allPriorities', 'All Priorities')}</SelectItem>
                  <SelectItem value="compliance">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-ds-danger" />
                      {t('compliance', 'Compliance')}
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-ds-warning" />
                      {t('high', 'High')}
                    </span>
                  </SelectItem>
                  <SelectItem value="normal">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-ds-muted" />
                      {t('normal', 'Normal')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={assignmentsFilterTargetType} onValueChange={setAssignmentsFilterTargetType}>
                <SelectTrigger className="w-[130px] h-8 bg-ds-surface-subtle border-ds-border text-xs text-ds-ink">
                  <SelectValue placeholder={t('targetType', 'Target')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTargets', 'All Targets')}</SelectItem>
                  <SelectItem value="everyone">{t('everyone', 'Everyone')}</SelectItem>
                  <SelectItem value="user">{t('specificUser', 'Specific User')}</SelectItem>
                  <SelectItem value="department">{t('department', 'Department')}</SelectItem>
                  <SelectItem value="property">{t('property', 'Property')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assignmentsFilterDueStatus} onValueChange={setAssignmentsFilterDueStatus}>
                <SelectTrigger className="w-[130px] h-8 bg-ds-surface-subtle border-ds-border text-xs text-ds-ink">
                  <SelectValue placeholder={t('dueStatus', 'Due Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatuses', 'All Statuses')}</SelectItem>
                  <SelectItem value="active">{t('active', 'Active')}</SelectItem>
                  <SelectItem value="due_soon">{t('dueSoon', 'Due Soon')}</SelectItem>
                  <SelectItem value="overdue">{t('overdue', 'Overdue')}</SelectItem>
                  <SelectItem value="completed">{t('completed', 'Completed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(assignmentsFilterPriority !== 'all' || assignmentsFilterTargetType !== 'all' || assignmentsFilterDueStatus !== 'all' || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetOrganizationState}
                className="text-xs text-ds-muted hover:text-ds-danger hover:bg-ds-danger-soft ms-auto h-8 px-2"
              >
                <X className="w-3 h-3 me-1" />
                {t('clearAll', 'Clear All')}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-ds-muted">
        <span>
          {t('showing', 'Showing')} <strong className="text-ds-ink">{groupedAssignments.length}</strong> {t('assignmentGroups', 'assignment groups')}
        </span>
        {(assignmentsFilterPriority !== 'all' || assignmentsFilterTargetType !== 'all' || assignmentsFilterDueStatus !== 'all') && (
          <div className="flex items-center gap-2">
            <span>{t('activeFilters', 'Active filters')}:</span>
            {assignmentsFilterPriority !== 'all' && (
              <Badge variant="outline" className="text-xs border-ds-border bg-ds-surface-subtle text-ds-ink font-normal">
                {t('priority')}: {t(assignmentsFilterPriority)}
                <button onClick={() => setAssignmentsFilterPriority('all')} className="ms-1 hover:text-ds-danger"><X className="w-3 h-3" /></button>
              </Badge>
            )}
            {assignmentsFilterTargetType !== 'all' && (
              <Badge variant="outline" className="text-xs border-ds-border bg-ds-surface-subtle text-ds-ink font-normal">
                {t('target')}: {t(assignmentsFilterTargetType)}
                <button onClick={() => setAssignmentsFilterTargetType('all')} className="ms-1 hover:text-ds-danger"><X className="w-3 h-3" /></button>
              </Badge>
            )}
            {assignmentsFilterDueStatus !== 'all' && (
              <Badge variant="outline" className="text-xs border-ds-border bg-ds-surface-subtle text-ds-ink font-normal">
                {t('status')}: {t(assignmentsFilterDueStatus)}
                <button onClick={() => setAssignmentsFilterDueStatus('all')} className="ms-1 hover:text-ds-danger"><X className="w-3 h-3" /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className={cn(
        assignmentsViewMode === 'grid'
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          : "flex flex-col gap-3"
      )}>
        {isLoadingAssignments ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-ds-accent" />
            <p className="mt-3 text-xs text-ds-muted">{t('loadingAssignments', 'Loading assignments...')}</p>
          </div>
        ) : groupedAssignments.length > 0 ? (
          groupedAssignments.map((group) => {
            const primaryAssignment = group.assignments[0]
            const targetType = primaryAssignment.target_type
            const targetTypeLabel = getTargetLabel(targetType)
            const exemptedCount = exemptionCountByModule.get(primaryAssignment.content_id) || 0
            const targets = group.assignments.map((assignment) => ({
              assignmentId: assignment.id,
              ...getTargetDetails(assignment)
            }))

            return (
              <Card key={group.key} className="group overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface transition-all duration-200 hover:border-ds-border-strong shadow-none flex flex-col justify-between">
                <div>
                  <div className={cn(
                    "h-1 w-full",
                    primaryAssignment.priority === 'compliance' && "bg-ds-danger",
                    primaryAssignment.priority === 'high' && "bg-ds-warning",
                    (!primaryAssignment.priority || primaryAssignment.priority === 'normal') && "bg-ds-border"
                  )} />

                  <CardHeader className="pb-3 pt-3.5 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="border-ds-border bg-ds-surface-subtle text-ds-muted font-medium text-[11px] px-1.5 py-0.5">
                          <BookOpen className="w-3 h-3 me-1" />
                          {t('module')}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium text-[11px] px-1.5 py-0.5",
                            primaryAssignment.priority === 'compliance' && "border-ds-danger/30 bg-ds-danger-soft text-ds-danger",
                            primaryAssignment.priority === 'high' && "border-ds-warning/30 bg-ds-warning-soft text-ds-warning",
                            (!primaryAssignment.priority || primaryAssignment.priority === 'normal') && "border-ds-border bg-ds-surface-subtle text-ds-muted"
                          )}
                        >
                          {t(primaryAssignment.priority || 'normal', primaryAssignment.priority || 'normal')}
                        </Badge>
                        {primaryAssignment.requires_acknowledgement && (
                          <Badge variant="outline" className="border-ds-warning/30 bg-ds-warning-soft text-ds-warning font-medium text-[11px] px-1.5 py-0.5">
                            <CheckCircle2 className="w-3 h-3 me-1" />
                            {t('ackRequired', 'Ack required')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {targets.length > 1 && (
                          <Badge variant="outline" className="border-ds-border bg-ds-surface-subtle text-ds-ink font-medium text-[11px] px-1.5 py-0.5">
                            <Users className="w-3 h-3 me-1" />
                            {targets.length} {t('targets', 'targets')}
                          </Badge>
                        )}
                        {exemptedCount > 0 && (
                          <Badge variant="outline" className="border-ds-danger/30 bg-ds-danger-soft text-ds-danger font-medium text-[11px] px-1.5 py-0.5">
                            <X className="w-3 h-3 me-1" />
                            {exemptedCount} {t('exempted', 'exempted')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base font-semibold mt-2.5 line-clamp-2 leading-snug text-ds-ink group-hover:text-ds-accent transition-colors" title={primaryAssignment.courses?.title}>
                      {primaryAssignment.courses?.title || t('unknownModule')}
                    </CardTitle>
                  </CardHeader>
                </div>

                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      {targets.length === 1 ? (
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="text-xs font-semibold text-ds-ink truncate">
                              {targets[0].label}
                            </div>
                            {targets[0].meta && targets[0].meta !== targets[0].label && (
                              <div className="text-[11px] text-ds-muted truncate">
                                {targets[0].meta}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 text-ds-muted hover:text-ds-danger hover:bg-ds-danger-soft -me-1"
                            onClick={() => handleDelete(targets[0].assignmentId)}
                            aria-label={t('accessibility.deleteAssignment', 'Delete assignment')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-ds-muted">{getTargetIcon(targetType)}</span>
                            <span className="text-ds-ink font-medium">{targetTypeLabel}</span>
                            <Badge variant="outline" className="text-[11px] px-1.5 py-0 shrink-0 whitespace-nowrap bg-ds-surface-subtle border-ds-border text-ds-muted">
                              {targets.length}
                            </Badge>
                          </div>
                          <div className="ps-5 space-y-1">
                            {targets.slice(0, 3).map((target) => (
                              <div key={target.assignmentId} className="flex items-start justify-between gap-2">
                                <div className="text-xs text-ds-ink truncate min-w-0 flex-1">
                                  {target.label}
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 shrink-0 text-ds-muted hover:text-ds-danger hover:bg-ds-danger-soft -me-1"
                                  onClick={() => handleDelete(target.assignmentId)}
                                  aria-label={t('accessibility.deleteAssignment', 'Delete assignment')}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            {targets.length > 3 && (
                              <div className="text-[11px] text-ds-muted">
                                +{targets.length - 3} {t('more', 'more')}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-ds-muted pt-2 border-t border-ds-border">
                      <span>{formatDate(primaryAssignment.created_at)}</span>
                      {primaryAssignment.due_date && (
                        <>
                          <span className="text-ds-border">|</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-medium",
                            new Date(primaryAssignment.due_date) < new Date()
                              ? "bg-ds-danger-soft text-ds-danger"
                              : "bg-ds-surface-subtle text-ds-muted"
                          )}>
                            {t('due')}: {formatDate(primaryAssignment.due_date)}
                          </span>
                        </>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-ds-border hover:bg-ds-surface-subtle text-ds-ink text-xs font-semibold h-8 rounded-md"
                      onClick={() => openManageAssignees(primaryAssignment.content_id, primaryAssignment.courses?.title)}
                    >
                      <Users className={cn("h-3.5 w-3.5 text-ds-muted", "me-1.5")} />
                      {t('manageAssignees', 'Manage assignees')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full rounded-[8px] border border-dashed border-ds-border bg-ds-surface-subtle p-12 text-center">
            <div className="h-12 w-12 rounded-[8px] bg-ds-surface border border-ds-border flex items-center justify-center text-ds-muted mx-auto mb-3 shadow-2xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ds-ink">{t('noAssignments')}</h3>
            <p className="mt-1 text-xs text-ds-muted max-w-sm mx-auto">{t('startAssigning', 'Get started by creating your first training assignment. Assign modules to individuals, departments, or entire properties.')}</p>
            {!hideCreateButton && (
              <Button
                onClick={() => setShowAssignmentDialog(true)}
                className="mt-4 bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 text-xs font-semibold px-4 h-9 shadow-none rounded-md"
              >
                <Plus className={cn("w-3.5 h-3.5", "me-1.5")} />
                {t('createAssignment')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
