import { WorkspaceHeader, headerActionClass, StatusBadge } from '@/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateTrainingRule, useDeleteTrainingRule, useTrainingModulesList, useTrainingRules, useUpdateTrainingRule } from '@/hooks/useTrainingRules'
import { cn } from '@/lib/utils'
import { Pencil, Plus, Shield, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Job-title-based rules were removed: the UI let an admin pick a job_titles.id,
// but assignments has no job_title_id column and profiles only
// stores job_title as free text (not linked by id) - there was no data path
// that could ever resolve who a "by job title" rule applied to. Role-based
// rules are backed by a real relationship (user_roles) end to end.
export default function TrainingAssignmentRules() {
    const { t } = useTranslation(['training', 'common'])
    const { data: rules, isLoading } = useTrainingRules()
    const { data: modules } = useTrainingModulesList()

    const createMutation = useCreateTrainingRule()
    const deleteMutation = useDeleteTrainingRule()
    const updateMutation = useUpdateTrainingRule()

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<any>(null)
    const [newRule, setNewRule] = useState({
        training_module_id: '',
        target_role: '',
        is_active: true
    })

    // Must match the roles exposed by the user_roles view (membership_app_roles()),
    // which is what learners' assignment lists are matched against.
    const roles = [
        'administrator',
        'training_manager',
        'knowledge_manager',
        'author',
        'learner'
    ]

    const resetForm = () => {
        setNewRule({
            training_module_id: '',
            target_role: '',
            is_active: true
        })
        setEditingRule(null)
    }

    const handleSave = async () => {
        try {
            if (!newRule.training_module_id || !newRule.target_role) return

            const payload = {
                training_module_id: newRule.training_module_id,
                target_role: newRule.target_role,
                is_active: newRule.is_active,
                target_type: 'role',
                target_id: newRule.target_role,
                content_type: 'module',
                content_id: newRule.training_module_id
            }

            if (editingRule?.id) {
                await updateMutation.mutateAsync({ id: editingRule.id, updates: payload })
            } else {
                await createMutation.mutateAsync(payload as any)
            }

            setIsCreateOpen(false)
            resetForm()
        } catch (error) {
            console.error('Failed to create rule:', error)
        }
    }

    const startEdit = (rule) => {
        setEditingRule(rule)
        setNewRule({
            training_module_id: rule.training_module_id || '',
            target_role: rule.target_role || '',
            is_active: rule.is_active ?? true
        })
        setIsCreateOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm(t('rules.confirm_delete'))) {
            try {
                await deleteMutation.mutateAsync(id)
            } catch (error) {
                console.error('Failed to delete rule:', error)
            }
        }
    }

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await updateMutation.mutateAsync({
                id,
                updates: { is_active: !currentStatus }
            })
        } catch (error) {
            console.error('Failed to update rule:', error)
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <WorkspaceHeader
                eyebrow={t('rulesPage.eyebrow', 'Manage · Assignments')}
                title={t('rulesPage.title', 'Automatic rules')}
                context={t('rulesPage.context', 'Assign a course to everyone with a role, including people who join later.')}
                actions={
                <Dialog
                    open={isCreateOpen}
                    onOpenChange={(open) => {
                        setIsCreateOpen(open)
                        if (!open) resetForm()
                    }}
                >
                    <DialogTrigger asChild>
                        <button type="button" className={headerActionClass.primary}>
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            {t('rules.new_rule')}
                        </button>
                    </DialogTrigger>
                    <DialogContent className="bg-ds-surface border-ds-border text-ds-ink sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-ds-ink">{editingRule ? t('rules.edit_title', { defaultValue: 'Edit Rule' }) : t('rules.create_title')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-ds-ink">{t('rules.target_role')}</label>
                                <Select
                                    value={newRule.target_role}
                                    onValueChange={(val) => setNewRule(prev => ({ ...prev, target_role: val }))}
                                >
                                    <SelectTrigger className="border-ds-border bg-ds-surface text-ds-ink">
                                        <SelectValue placeholder={t('rules.select_role')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-ds-surface border-ds-border text-ds-ink">
                                        {roles.map(role => (
                                            <SelectItem key={role} value={role}>{t(`common:roles.${role}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-ds-ink">{t('module')}</label>
                                <Select
                                    value={newRule.training_module_id}
                                    onValueChange={(val) => setNewRule(prev => ({ ...prev, training_module_id: val }))}
                                >
                                    <SelectTrigger className="border-ds-border bg-ds-surface text-ds-ink">
                                        <SelectValue placeholder={t('rules.select_module')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-ds-surface border-ds-border text-ds-ink">
                                        {modules?.map(module => (
                                            <SelectItem key={module.id} value={module.id}>{module.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleSave}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
                                disabled={(createMutation.isPending || updateMutation.isPending) || !newRule.target_role || !newRule.training_module_id}
                            >
                                {(createMutation.isPending || updateMutation.isPending)
                                    ? t('rules.creating')
                                    : editingRule
                                        ? t('common:action.save', { defaultValue: 'Save' })
                                        : t('rules.create_rule')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
                }
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full text-center py-12 text-ds-muted">{t('loading')}</div>
                ) : rules?.map((rule) => (
                    <Card key={rule.id} className={cn("bg-ds-surface border border-ds-border rounded-[8px] shadow-2xs transition-all hover:border-amber-500/40 hover:shadow-xs", !rule.is_active && "opacity-60")}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-ds-ink">
                                        <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                        {rule.target_role ? t(`common:roles.${rule.target_role}`) : t('unknown')}
                                    </CardTitle>
                                    <p className="text-xs text-ds-muted">{t('rules.auto_assigns_to')} {t('rules.by_role')}</p>
                                </div>
                                <StatusBadge
                                    variant={rule.is_active ? 'success' : 'neutral'}
                                    label={rule.is_active ? t('common:status_options.active') : t('common:status_options.inactive')}
                                    size="sm"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="font-medium text-sm text-ds-ink line-clamp-2">
                                    {modules?.find(m => m.id === rule.training_module_id)?.title || rule.training_module_id}
                                </p>
                                <div className="flex items-center gap-2 pt-3 border-t border-ds-border mt-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 text-xs text-ds-muted hover:text-ds-ink hover:bg-ds-surface-subtle"
                                        onClick={() => handleToggle(rule.id, rule.is_active)}
                                    >
                                        {rule.is_active ? t('rules.deactivate') : t('rules.activate')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('accessibility.edit_rule', 'Edit Rule')}
                                        className="h-8 w-8 text-ds-muted hover:text-ds-ink hover:bg-ds-surface-subtle"
                                        onClick={() => startEdit(rule)}
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t('accessibility.delete_rule', 'Delete Rule')}
                                        className="h-8 w-8 text-ds-muted hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(rule.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {!isLoading && rules?.length === 0 && (
                    <div className="col-span-full text-center py-12 text-ds-muted border border-dashed border-ds-border rounded-[8px] bg-ds-surface-subtle/30">
                        <p>{t('rules.no_rules')}</p>
                        <Button variant="link" onClick={() => setIsCreateOpen(true)} className="text-amber-600 dark:text-amber-400 font-semibold">{t('rules.create_first')}</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
