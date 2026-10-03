import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CheckCircle2, Copy, Edit, Eye, MoreVertical, RefreshCw, RotateCcw, SendHorizonal, Trash2, Users, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TrainingModule {
  id: string
  title: string
}

interface ModuleQuickActionsProps {
  module: TrainingModule
  onEdit: () => void
  onView: () => void
  onAssign: () => void
  onClone: () => void
  onDelete: () => void
  onSubmitForReview?: () => void
  onApprove?: () => void
  onReject?: () => void
  onSyncWithMaster?: () => void
  isMaster?: boolean
  hasUpdate?: boolean
  isTrash?: boolean
  onRestore?: () => void
  onPurge?: () => void
}

export function ModuleQuickActions({
  module,
  onEdit,
  onView,
  onAssign,
  onClone,
  onDelete,
  onSubmitForReview,
  onApprove,
  onReject,
  onSyncWithMaster,
  isMaster,
  hasUpdate,
  isTrash = false,
  onRestore,
  onPurge,
}: ModuleQuickActionsProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'

  if (isTrash) {
    return (
      <div className={cn("grid grid-cols-2 gap-2")}>
        <Button
          variant="default"
          size="sm"
          onClick={onRestore}
          className={cn("bg-ds-accent hover:bg-ds-accent-hover text-white dark:text-ds-on-ink font-medium")}
          title={t('trash.restore_btn', 'Restore Course')}
        >
          <RotateCcw className={cn("h-4 w-4", "me-1.5")} />
          {t('trash.restore_btn', 'Restore')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-full border-ds-danger/30 hover:border-ds-danger/30 text-ds-danger")}>
              <MoreVertical className={cn("h-4 w-4", "me-1")} />
              {t('common:action.more')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isRTL ? 'start' : 'end'} className={cn("text-start")}>
            <DropdownMenuItem onClick={onRestore} className="text-ds-success focus:text-ds-success">
              <RotateCcw className={cn("h-4 w-4", "me-2")} />
              {t('trash.restore_btn', 'Restore Course')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onPurge || onDelete}
              className={cn("text-ds-danger focus:text-ds-danger font-semibold")}
            >
              <Trash2 className={cn("h-4 w-4", "me-2")} />
              {t('trash.purge_btn', 'Permanently Purge')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2")}>
      <Button
        variant="default"
        size="sm"
        onClick={onEdit}
        className={cn("bg-ds-accent hover:bg-ds-accent-hover")}
      >
        <Edit className={cn("h-4 w-4", "me-2")} />
        {t('common:action.edit')}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-full")}>
            <MoreVertical className={cn("h-4 w-4", "me-2")} />
            {t('common:action.more')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isRTL ? 'start' : 'end'} className={cn("text-start")}>
          <DropdownMenuItem onClick={onView} className={cn('')}>
            <Eye className={cn("h-4 w-4", "me-2")} />
            {t('common:action.view')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAssign} className={cn('')}>
            <Users className={cn("h-4 w-4", "me-2")} />
            {t('assign')}
          </DropdownMenuItem>

          {onSyncWithMaster && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSyncWithMaster}
                className={cn(
                  hasUpdate ? "text-ds-warning font-bold focus:text-ds-warning bg-ds-warning-soft/50" : "text-ds-info"
                )}
              >
                <RefreshCw className={cn("h-4 w-4", "me-2", hasUpdate ? "animate-spin" : "")} />
                {hasUpdate ? t('syncWithMaster', 'Sync with Master 🔔') : t('syncWithMaster', 'Sync with Master')}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClone} className={cn('')}>
            <Copy className={cn("h-4 w-4", "me-2")} />
            {t('clone')}
          </DropdownMenuItem>
          {(onSubmitForReview || onApprove || onReject) && <DropdownMenuSeparator />}
          {onSubmitForReview && (
            <DropdownMenuItem onClick={onSubmitForReview} className={cn('')}>
              <SendHorizonal className={cn("h-4 w-4", "me-2")} />
              {t('review.submitForReview')}
            </DropdownMenuItem>
          )}
          {onApprove && (
            <DropdownMenuItem onClick={onApprove} className={cn("text-ds-success focus:text-ds-success")}>
              <CheckCircle2 className={cn("h-4 w-4", "me-2")} />
              {t('review.approve')}
            </DropdownMenuItem>
          )}
          {onReject && (
            <DropdownMenuItem onClick={onReject} className={cn("text-ds-warning focus:text-ds-warning")}>
              <XCircle className={cn("h-4 w-4", "me-2")} />
              {t('review.reject')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className={cn("text-ds-danger focus:text-ds-danger")}
          >
            <Trash2 className={cn("h-4 w-4", "me-2")} />
            {t('common:action.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
