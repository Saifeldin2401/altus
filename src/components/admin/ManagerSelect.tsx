import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePotentialManagers } from '@/hooks/useOrganization'
import { User, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ManagerSelectProps {
    value: string | null
    onChange: (value: string | null) => void
    excludeUserId?: string
    disabled?: boolean
    placeholder?: string
    allowClear?: boolean
}

export function ManagerSelect({
    value,
    onChange,
    excludeUserId,
    disabled = false,
    placeholder,
    allowClear = true
}: ManagerSelectProps) {
    const { t } = useTranslation('admin')
    const { data: managers, isLoading } = usePotentialManagers(excludeUserId)

    const getRoleBadge = (role: string) => {
        const roleColors: Record<string, string> = {
            regional_admin: 'bg-ds-accent-soft text-ds-accent',
            regional_hr: 'bg-ds-surface-subtle text-ds-ink-secondary',
            property_manager: 'bg-info/10 text-info',
            property_hr: 'bg-ds-surface-subtle text-ds-ink-secondary',
            department_head: 'bg-ds-surface-subtle text-ds-ink-secondary'
        }
        return roleColors[role] || 'bg-ds-surface-subtle text-ds-ink-secondary'
    }

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            regional_admin: 'Regional Admin',
            regional_hr: 'Regional HR',
            property_manager: 'Property Manager',
            property_hr: 'Property HR',
            department_head: 'Dept. Head'
        }
        return labels[role] || role
    }

    return (
        <Select
            value={value || ''}
            onValueChange={(v) => onChange(v === '__none__' ? null : v)}
            disabled={disabled || isLoading}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder || t('organization.select_manager', 'Select manager...')} />
            </SelectTrigger>
            <SelectContent>
                {allowClear && (
                    <SelectItem value="__none__">
                        <span className="flex items-center gap-2 text-ds-muted">
                            <Users className="h-4 w-4" />
                            {t('organization.no_manager', 'No Manager (Top Level)')}
                        </span>
                    </SelectItem>
                )}

                {managers?.map((manager) => {
                    const role = manager.user_roles?.[0]?.role || 'staff'
                    return (
                        <SelectItem key={manager.id} value={manager.id}>
                            <span className="flex items-center gap-2">
                                <User className="h-4 w-4 text-ds-muted" />
                                <span>{manager.full_name}</span>
                                {manager.job_title && (
                                    <span className="text-ds-muted text-xs">({manager.job_title})</span>
                                )}
                                <Badge className={`${getRoleBadge(role)} text-xs px-1.5 py-0`}>
                                    {getRoleLabel(role)}
                                </Badge>
                            </span>
                        </SelectItem>
                    )
                })}

                {!isLoading && managers?.length === 0 && (
                    <div className="p-2 text-sm text-ds-muted text-center">
                        {t('organization.no_managers_found', 'No managers found')}
                    </div>
                )}
            </SelectContent>
        </Select>
    )
}
