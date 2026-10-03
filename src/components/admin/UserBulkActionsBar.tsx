import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUserBulkOperations } from '@/hooks/useUserBulkOperations'
import { ROLES, type AppRole } from '@/lib/constants'
import { KeyRound, Loader2, ShieldCheck, ShieldOff, UserCog, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface UserBulkActionsBarProps {
    selectedIds: Set<string>
    onClearSelection: () => void
    userNames?: Map<string, string> // userId ? displayName for confirmation
    resetRequiredCount?: number
}

export function UserBulkActionsBar({ selectedIds, onClearSelection, userNames, resetRequiredCount = 0 }: UserBulkActionsBarProps) {
    const { t } = useTranslation(['users', 'common'])
    const { bulkAssignRole, bulkDeactivate, bulkActivate, bulkForcePasswordReset, bulkCancelPasswordReset, isLoading } = useUserBulkOperations()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogAction, setDialogAction] = useState<'assign_role' | 'deactivate' | 'activate' | 'reset_password' | 'cancel_reset' | null>(null)
    const [selectedRole, setSelectedRole] = useState<AppRole | ''>('')
    const [bulkReason, setBulkReason] = useState('')
    const [suspendUntil, setSuspendUntil] = useState('')
    const [notifyUser, setNotifyUser] = useState(true)
    const [actionNote, setActionNote] = useState('')

    const count = selectedIds.size
    if (count === 0) return null

    const openDialog = (action: typeof dialogAction) => {
        setDialogAction(action)
        setSelectedRole('')
        setBulkReason('')
        setSuspendUntil('')
        setNotifyUser(true)
        setActionNote('')
        setDialogOpen(true)
    }

    const executeAction = async () => {
        const ids = Array.from(selectedIds)

        switch (dialogAction) {
            case 'assign_role':
                if (!selectedRole) return
                await bulkAssignRole.mutateAsync({ userIds: ids, role: selectedRole as AppRole })
                break
            case 'deactivate':
                await bulkDeactivate.mutateAsync({
                    userIds: ids,
                    reason: bulkReason || undefined,
                    suspendUntil: suspendUntil ? new Date(suspendUntil).toISOString() : undefined,
                    notifyUser,
                    note: actionNote || undefined
                })
                break
            case 'activate':
                await bulkActivate.mutateAsync({ userIds: ids, notifyUser, note: actionNote || undefined })
                break
            case 'reset_password':
                await bulkForcePasswordReset.mutateAsync({ userIds: ids, notifyUser, note: actionNote || undefined })
                break
            case 'cancel_reset':
                await bulkCancelPasswordReset.mutateAsync({ userIds: ids, notifyUser, note: actionNote || undefined })
                break
        }

        setDialogOpen(false)
        onClearSelection()
    }

    return (
        <TooltipProvider>
            <div role="toolbar" aria-label={t('bulk.toolbar', 'Actions for selected people')} className="flex flex-wrap items-center gap-3 rounded-[8px] border border-ds-border bg-ds-surface-subtle p-3">
                <div className="flex items-center gap-2">
                    <Badge variant="navy">
                        {t('bulk.selected', { count })}
                    </Badge>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-ds-muted hover:text-ds-ink"
                                onClick={onClearSelection}
                                aria-label={t('common:clearselection')}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {t('common:clearselection')}
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-2 ms-auto flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('assign_role')}
                        disabled={isLoading}
                    >
                        <UserCog className="w-3.5 h-3.5" />
                        {t('bulk.assign_role')}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('activate')}
                        disabled={isLoading}
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {t('bulk.activate')}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('reset_password')}
                        disabled={isLoading}
                    >
                        <KeyRound className="w-3.5 h-3.5" />
                        {t('bulk.reset_password')}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('cancel_reset')}
                        disabled={isLoading || resetRequiredCount === 0}
                    >
                        <X className="w-3.5 h-3.5" />
                        {t('bulk.cancel_reset')}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="text-ds-danger hover:border-ds-danger/40 hover:bg-ds-danger-soft hover:text-ds-danger"
                        onClick={() => openDialog('deactivate')}
                        disabled={isLoading}
                    >
                        <ShieldOff className="w-3.5 h-3.5" />
                        {t('bulk.deactivate')}
                    </Button>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {dialogAction && t(`bulk.${dialogAction}`)}
                        </DialogTitle>
                        <DialogDescription>
                            {t('bulk.confirm_bulk', { count })}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* User list preview */}
                        {userNames && userNames.size > 0 && (
                            <div className="max-h-32 overflow-y-auto rounded-[6px] border border-ds-border bg-ds-surface-subtle p-3">
                                <p className="text-xs font-medium text-ds-muted mb-1">{t('bulk.affected', 'People affected')}</p>
                                <div className="flex flex-wrap gap-1">
                                    {Array.from(selectedIds).slice(0, 10).map(id => (
                                        <Badge key={id} variant="outline" className="text-[10px]">
                                            {userNames.get(id) || id.slice(0, 8)}
                                        </Badge>
                                    ))}
                                    {selectedIds.size > 10 && (
                                        <Badge variant="outline" className="text-[10px]">
                                            {t('bulk.more', '+{{count}} more', { count: selectedIds.size - 10 })}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {dialogAction === 'assign_role' && (
                            <div>
                                <Label className="mb-1.5 block">{t('bulk.assign_role')}</Label>
                                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('form.select_role', 'Select a role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(ROLES).map(([key, val]) => (
                                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {dialogAction === 'deactivate' && (
                            <div>
                                <Label htmlFor="bulk-reason" className="mb-1.5 block">{t('account_actions.suspend_reason')}</Label>
                                <Textarea
                                    id="bulk-reason"
                                    value={bulkReason}
                                    onChange={(e) => setBulkReason(e.target.value)}
                                    placeholder={t('account_actions.suspend_reason_placeholder')}
                                    className="resize-none"
                                    rows={3}
                                />
                            </div>
                        )}

                        {(dialogAction === 'deactivate') && (
                            <div>
                                <Label htmlFor="bulk-suspend-until" className="mb-1.5 block">{t('bulk.suspend_until', 'Suspend until (optional)')}</Label>
                                <Input
                                    id="bulk-suspend-until"
                                    type="datetime-local"
                                    value={suspendUntil}
                                    onChange={(e) => setSuspendUntil(e.target.value)}
                                />
                            </div>
                        )}

                        {dialogAction !== 'assign_role' && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox id="notify-users" checked={notifyUser} onCheckedChange={(checked) => setNotifyUser(!!checked)} />
                                    <Label htmlFor="notify-users" className="text-sm">{t('bulk.notify', 'Tell the people affected by email')}</Label>
                                </div>
                                <div>
                                    <Label htmlFor="bulk-note" className="mb-1.5 block">{t('bulk.note', 'Internal note (optional)')}</Label>
                                    <Textarea
                                        id="bulk-note"
                                        value={actionNote}
                                        onChange={(e) => setActionNote(e.target.value)}
                                        placeholder={t('bulk.note_placeholder', 'Saved in the audit log')}
                                        className="resize-none"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isLoading}>
                            {t('common:cancel', 'Cancel')}
                        </Button>
                        <Button
                            onClick={executeAction}
                            disabled={isLoading || (dialogAction === 'assign_role' && !selectedRole)}
                            variant={dialogAction === 'deactivate' ? 'destructive' : 'default'}
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                            {dialogAction && t(`bulk.${dialogAction}`)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
