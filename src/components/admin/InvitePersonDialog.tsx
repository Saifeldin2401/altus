/**
 * The one way to invite someone to the current organization. Used by
 * Organization > People and Organization > Invitations so both pages send the
 * same invitation, with the same checks (no duplicate pending invite, not
 * already a member) and the same wording.
 */

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Building, Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTenant } from '@/contexts/TenantContext'
import { useDepartments } from '@/hooks/useDepartments'
import { useInvitations } from '@/hooks/useInvitations'
import { ROLE_HIERARCHY, ROLES } from '@/lib/constants'
import type { AppRole } from '@/lib/types'

/** Radix Select cannot hold an empty value, so "no department" needs a token. */
const NO_DEPARTMENT = '__none__'

const ROLE_HINTS: Record<string, string> = {
  administrator: 'Manages people, structure and settings for the organization.',
  training_manager: 'Assigns training and follows up on progress and compliance.',
  knowledge_manager: 'Reviews and publishes articles and courses.',
  author: 'Writes courses, quizzes and articles for review.',
  learner: 'Takes assigned training and reads articles.',
}

interface InvitePersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the server confirms the invitation was sent. */
  onInvited?: () => void
  /** Use the caller's invitation list (Invitations page) so it refreshes in place. */
  createInvitation?: ReturnType<typeof useInvitations>['createInvitation']
  isCreating?: boolean
}

export function InvitePersonDialog({ open, onOpenChange, onInvited, createInvitation, isCreating }: InvitePersonDialogProps) {
  const { t, i18n } = useTranslation(['users', 'nav', 'common'])
  const isRTL = i18n.language === 'ar'
  const { currentOrganization } = useTenant()
  const { departments = [], isLoading: departmentsLoading } = useDepartments()
  const own = useInvitations({ autoLoad: false })
  const create = createInvitation ?? own.createInvitation
  const busy = isCreating ?? own.isCreating

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('learner')
  const [departmentId, setDepartmentId] = useState(NO_DEPARTMENT)
  const [emailError, setEmailError] = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setRole('learner')
    setDepartmentId(NO_DEPARTMENT)
    setEmailError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const roleLabel = (r: AppRole) => t(`nav:shell.roles.${r}`, { defaultValue: ROLES[r]?.label ?? r })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('invite.email_invalid', 'Enter a valid email address.'))
      return
    }
    const ok = await create({
      email: trimmed,
      role,
      departmentId: departmentId === NO_DEPARTMENT ? undefined : departmentId,
    })
    if (ok) {
      reset()
      onOpenChange(false)
      onInvited?.()
    }
  }

  const orgName = currentOrganization
    ? (isRTL && (currentOrganization as { name_ar?: string | null }).name_ar) || currentOrganization.name
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('invite.title', 'Invite someone')}</DialogTitle>
            <DialogDescription>
              {t('invite.description', 'They get an email with a link, choose their own password and join straight away.')}
            </DialogDescription>
          </DialogHeader>

          {orgName && (
            <p className="flex items-center gap-1.5 rounded-[6px] border border-ds-border bg-ds-surface-subtle px-3 py-2 text-sm text-ds-ink-secondary">
              <Building aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-muted" />
              {t('invite.joins', 'Joins {{org}}', { org: orgName })}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-person-email">{t('invite.email', 'Email')}</Label>
            <Input
              id="invite-person-email"
              type="email"
              autoComplete="off"
              dir="ltr"
              placeholder="name@hotel.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'invite-person-email-error' : undefined}
              disabled={busy}
              className={emailError ? 'border-ds-danger' : undefined}
            />
            {emailError && <p id="invite-person-email-error" className="text-sm text-ds-danger">{emailError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-person-role">{t('invite.role', 'Role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={busy}>
              <SelectTrigger id="invite-person-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_HIERARCHY.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-ds-muted">{t(`invite.role_hint.${role}`, ROLE_HINTS[role] ?? '')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-person-department">{t('invite.department', 'Department (optional)')}</Label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={busy || departmentsLoading}>
              <SelectTrigger id="invite-person-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEPARTMENT}>{t('invite.no_department', 'Decide later')}</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {(isRTL && (d as { name_ar?: string | null }).name_ar) || d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-ds-muted">
              {t('invite.department_hint', 'Training assigned to a department reaches them automatically.')}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
              {t('common:cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" className="rtl:-scale-x-100" />}
              {t('invite.send', 'Send invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
