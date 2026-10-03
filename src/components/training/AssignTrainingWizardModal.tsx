import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  UserPlus,
  Users,
  type LucideIcon
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { persistLearningAssignments } from '@/lib/learningAssignmentMutations'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface AssignTrainingWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultTargetType?: 'user' | 'department' | 'role' | 'new_hire'
}

type AudienceType = 'user' | 'department' | 'role' | 'new_hire'

interface ContentPackageItem {
  id: string
  title: string
  durationMinutes: number | null
}

/**
 * Role-targeted assignments are matched on the server against
 * organization_memberships.role, so only membership roles can be offered.
 */
const MEMBERSHIP_ROLES = [
  'learner',
  'department_manager',
  'instructor',
  'author',
  'training_manager',
  'knowledge_manager',
  'organization_admin',
] as const

const DUE_OPTIONS = [7, 14, 30, 60] as const

export function AssignTrainingWizardModal({
  open,
  onOpenChange,
  onSuccess,
  defaultTargetType = 'user'
}: AssignTrainingWizardModalProps) {
  const { t } = useTranslation(['dashboard', 'nav'])
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  // Wizard Step State (1 to 4)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: Audience Selection
  const [audienceType, setAudienceType] = useState<AudienceType>(defaultTargetType)
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Step 2: Course
  const [selectedPackage, setSelectedPackage] = useState<ContentPackageItem | null>(null)
  const [courseQuery, setCourseQuery] = useState('')

  // Step 3: Due Date & Schedule
  const [dueDays, setDueDays] = useState<number>(14)
  const [priority, setPriority] = useState<'normal' | 'high' | 'compliance'>('normal')

  // Loading state for submitting
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate Due Date String
  const calculatedDueDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + dueDays)
    return d.toISOString().split('T')[0]
  }, [dueDays])

  // Published courses only: learners cannot open a draft, so assigning one
  // creates work nobody can do (matches the Assignments page).
  const { data: dbModules } = useQuery({
    queryKey: ['real-training-modules-wizard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, estimated_duration_minutes')
        .eq('status', 'published')
        .not('is_deleted', 'is', true)
        .order('title')
        .limit(200)
      if (error) return []
      return data || []
    },
    enabled: open
  })

  // Search people on the server: the first 30 profiles alone left everyone
  // else in a larger organization unreachable.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250)
    return () => clearTimeout(id)
  }, [searchQuery])

  const { data: realProfiles, isFetching: isSearchingPeople } = useQuery({
    queryKey: ['real-profiles-wizard', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, job_title, avatar_url')
        .order('full_name', { ascending: true })
        .limit(30)
      if (debouncedSearch.length >= 2) {
        const term = debouncedSearch.replace(/[%_,()]/g, ' ')
        query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,job_title.ilike.%${term}%`)
      }
      const { data, error } = await query
      if (error) return []
      return data || []
    },
    enabled: open && audienceType === 'user'
  })

  const [selectedPersonName, setSelectedPersonName] = useState('')

  // Fetch real departments from Supabase
  const { data: dbDepartments } = useQuery({
    queryKey: ['real-departments-wizard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) return []
      return data || []
    },
    enabled: open
  })

  const filteredContentPackages = useMemo((): ContentPackageItem[] => {
    const q = courseQuery.trim().toLowerCase()
    return (dbModules ?? [])
      .filter((mod) => !q || (mod.title || '').toLowerCase().includes(q))
      .map((mod) => ({ id: mod.id, title: mod.title, durationMinutes: mod.estimated_duration_minutes ?? null }))
  }, [dbModules, courseQuery])

  const formattedDue = useMemo(
    () => new Date(calculatedDueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
    [calculatedDueDate]
  )

  const roleLabel = (r: string) => t(`nav:shell.roles.${r}`, { defaultValue: r.replace(/_/g, ' ') })

  const audienceLabel =
    audienceType === 'department'
      ? dbDepartments?.find((d) => d.id === selectedTargetId)?.name ?? ''
      : audienceType === 'user'
        ? selectedPersonName
        : audienceType === 'role'
          ? t('assignWizard.everyoneWithRole', 'Everyone with the role {{role}}', { role: roleLabel(selectedTargetId) })
          : t('assignWizard.newHires', 'New starters (joined in the last 30 days)')

  const resetWizard = () => {
    setStep(1)
    setAudienceType(defaultTargetType)
    setSelectedTargetId('')
    setSelectedPersonName('')
    setSearchQuery('')
    setSelectedPackage(null)
    setCourseQuery('')
    setDueDays(14)
    setPriority('normal')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && !isSubmitting) resetWizard()
    onOpenChange(next)
  }

  const handleNextStep = () => {
    if (step === 1 && !selectedTargetId && audienceType !== 'new_hire') {
      toast.error(t('assignWizard.pickWho', 'Choose who this is for.'))
      return
    }
    if (step === 2 && !selectedPackage) {
      toast.error(t('assignWizard.pickCourse', 'Choose a course.'))
      return
    }
    setStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4)
  }

  const handlePrevStep = () => {
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4)
  }

  const handleSubmitAssignment = async () => {
    if (!selectedPackage) return

    setIsSubmitting(true)
    try {
      const payload = [{
        target_type: audienceType,
        target_id: audienceType === 'new_hire' ? null : (selectedTargetId || null),
        content_type: 'module',
        content_id: selectedPackage.id,
        assigned_by: user?.id || null,
        due_date: calculatedDueDate,
        priority: priority,
        is_deleted: false
      }]

      const result = await persistLearningAssignments(payload)

      queryClient.invalidateQueries({ queryKey: ['learning-assignments'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-processes'] })
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['training-progress'] })

      toast.success(t('assignWizard.done', 'Training assigned'), {
        description: t('assignWizard.doneBody', '{{course}} for {{who}}, due {{date}}.', { course: selectedPackage.title, who: audienceLabel, date: formattedDue })
      })

      onSuccess?.()
      onOpenChange(false)
      resetWizard()
    } catch (err) {
      console.error('[AssignTrainingWizard] Submission error:', err)
      toast.error(t('assignWizard.failed', 'The assignment was not saved. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    t('assignWizard.stepWho', 'Who'),
    t('assignWizard.stepCourse', 'Course'),
    t('assignWizard.stepWhen', 'Due date'),
    t('assignWizard.stepReview', 'Review'),
  ]

  const audiences: { id: AudienceType; icon: LucideIcon; title: string; hint: string }[] = [
    { id: 'user', icon: Users, title: t('assignWizard.person', 'One person'), hint: t('assignWizard.personHint', 'Search by name or email') },
    { id: 'department', icon: Building2, title: t('assignWizard.department', 'A department'), hint: t('assignWizard.departmentHint', 'Everyone in it, including people who join later') },
    { id: 'role', icon: Briefcase, title: t('assignWizard.role', 'A role'), hint: t('assignWizard.roleHint', 'Everyone with that role') },
    { id: 'new_hire', icon: UserPlus, title: t('assignWizard.newHire', 'New starters'), hint: t('assignWizard.newHireHint', 'People who joined in the last 30 days') },
  ]

  const optionClass = (selected: boolean) =>
    cn(
      'rounded-[6px] border text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
      selected
        ? 'border-ds-ink bg-ds-surface-subtle ring-1 ring-ds-ink'
        : 'border-ds-border bg-ds-surface hover:border-ds-border-strong'
    )

  const priorityOptions: { id: 'normal' | 'high' | 'compliance'; label: string }[] = [
    { id: 'normal', label: t('assignWizard.priorityNormal', 'Normal') },
    { id: 'high', label: t('assignWizard.priorityHigh', 'High') },
    { id: 'compliance', label: t('assignWizard.priorityCompliance', 'Required for compliance') },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px]" bodyClassName="p-0">
        <div className="border-b border-ds-border px-5 pb-4 pt-5 pe-14 sm:px-6">
          <DialogHeader>
            <DialogTitle>{t('assignWizard.title', 'Assign training')}</DialogTitle>
            <DialogDescription>
              {t('assignWizard.stepOf', 'Step {{step}} of 4: {{name}}', { step, name: steps[step - 1] })}
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
            {steps.map((name, i) => (
              <li key={name} className={cn('h-1 rounded-full', i < step ? 'bg-ds-ink' : 'bg-ds-border')} />
            ))}
          </ol>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 1 && (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-ds-ink">{t('assignWizard.whoTitle', 'Who is this for?')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {audiences.map(({ id, icon: Icon, title, hint }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={audienceType === id}
                      onClick={() => {
                        setAudienceType(id)
                        setSelectedPersonName('')
                        setSelectedTargetId(
                          id === 'department' ? dbDepartments?.[0]?.id || '' : id === 'role' ? 'learner' : id === 'new_hire' ? 'new_hires' : ''
                        )
                      }}
                      className={cn(optionClass(audienceType === id), 'flex items-start gap-3 p-3')}
                    >
                      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ds-muted" />
                      <span>
                        <span className="block text-sm font-semibold text-ds-ink">{title}</span>
                        <span className="block text-xs text-ds-muted">{hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {audienceType === 'department' && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium text-ds-ink">{t('assignWizard.whichDepartment', 'Which department?')}</legend>
                  {dbDepartments && dbDepartments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {dbDepartments.map((dept) => (
                        <button
                          key={dept.id}
                          type="button"
                          aria-pressed={selectedTargetId === dept.id}
                          onClick={() => setSelectedTargetId(dept.id)}
                          className={cn(optionClass(selectedTargetId === dept.id), 'min-h-[44px] px-3 py-2 text-sm text-ds-ink')}
                        >
                          {dept.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ds-muted">
                      {t('assignWizard.noDepartments', 'There are no departments yet.')}{' '}
                      <Link to="/admin/structure?tab=departments" className="font-medium text-ds-accent hover:underline">
                        {t('assignWizard.addDepartments', 'Add departments')}
                      </Link>
                    </p>
                  )}
                </fieldset>
              )}

              {audienceType === 'role' && (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium text-ds-ink">{t('assignWizard.whichRole', 'Which role?')}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MEMBERSHIP_ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={selectedTargetId === r}
                        onClick={() => setSelectedTargetId(r)}
                        className={cn(optionClass(selectedTargetId === r), 'min-h-[44px] px-3 py-2 text-sm text-ds-ink')}
                      >
                        {roleLabel(r)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {audienceType === 'user' && (
                <div className="space-y-2">
                  <label htmlFor="assign-person-search" className="block text-sm font-medium text-ds-ink">
                    {t('assignWizard.whichPerson', 'Which person?')}
                  </label>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
                    <Input
                      id="assign-person-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('assignWizard.searchPeople', 'Name, email or job title')}
                      className="ps-9"
                    />
                  </div>
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto pe-1" aria-busy={isSearchingPeople}>
                    {(realProfiles ?? []).map((p) => {
                      const selected = selectedTargetId === p.id
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => { setSelectedTargetId(p.id); setSelectedPersonName(p.full_name || p.email || '') }}
                            className={cn(optionClass(selected), 'flex w-full items-center justify-between gap-3 px-3 py-2')}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-surface-subtle text-xs font-semibold uppercase text-ds-ink">
                                {(p.full_name || p.email || '?').charAt(0)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-ds-ink">{p.full_name || p.email}</span>
                                <span className="block truncate text-xs text-ds-muted">{[p.job_title, p.email].filter(Boolean).join(' · ')}</span>
                              </span>
                            </span>
                            {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-ink" />}
                          </button>
                        </li>
                      )
                    })}
                    {realProfiles && realProfiles.length === 0 && (
                      <li className="py-4 text-center text-sm text-ds-muted">{t('assignWizard.noPeople', 'Nobody matches that search.')}</li>
                    )}
                  </ul>
                </div>
              )}

              {audienceType === 'new_hire' && (
                <p className="rounded-[6px] border border-ds-border bg-ds-surface-subtle px-3 py-2 text-sm text-ds-ink-secondary">
                  {t('assignWizard.newHireNote', 'Goes to everyone who joined in the last 30 days. To assign a course to every future starter, use')}{' '}
                  <Link to="/manage/assignments/rules" className="font-medium text-ds-accent hover:underline">
                    {t('assignWizard.automaticRules', 'automatic rules')}
                  </Link>.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <label htmlFor="assign-course-search" className="block text-sm font-semibold text-ds-ink">
                {t('assignWizard.courseTitle', 'Which course?')}
              </label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
                <Input
                  id="assign-course-search"
                  type="search"
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder={t('assignWizard.searchCourses', 'Search published courses')}
                  className="ps-9"
                />
              </div>
              {filteredContentPackages.length === 0 ? (
                <p className="rounded-[6px] border border-dashed border-ds-border px-4 py-8 text-center text-sm text-ds-muted">
                  {(dbModules ?? []).length === 0
                    ? t('assignWizard.noCourses', 'There are no published courses yet. Publish one in Studio first.')
                    : t('assignWizard.noCourseMatch', 'No courses match that search.')}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {filteredContentPackages.map((pkg) => {
                    const selected = selectedPackage?.id === pkg.id
                    return (
                      <li key={pkg.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedPackage(pkg)}
                          className={cn(optionClass(selected), 'flex w-full items-center justify-between gap-3 px-3 py-2.5')}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ds-ink">{pkg.title}</span>
                            {pkg.durationMinutes ? (
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-ds-muted">
                                <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                                {t('assignWizard.minutes', '{{count}} min', { count: pkg.durationMinutes })}
                              </span>
                            ) : null}
                          </span>
                          {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-ds-ink" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-ds-ink">{t('assignWizard.dueTitle', 'When is it due?')}</legend>
                <div className="grid grid-cols-4 gap-2">
                  {DUE_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={dueDays === days}
                      onClick={() => setDueDays(days)}
                      className={cn(optionClass(dueDays === days), 'min-h-[44px] px-2 text-center text-sm text-ds-ink')}
                    >
                      {t('assignWizard.days', '{{count}} days', { count: days })}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-ds-muted">{t('assignWizard.dueOn', 'Due on {{date}}', { date: formattedDue })}</p>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-ds-ink">{t('assignWizard.priorityTitle', 'Priority')}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {priorityOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={priority === o.id}
                      onClick={() => setPriority(o.id)}
                      className={cn(optionClass(priority === o.id), 'min-h-[44px] px-3 text-center text-sm text-ds-ink')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-ds-ink">{t('assignWizard.reviewTitle', 'Check and assign')}</p>
              <dl className="divide-y divide-ds-border rounded-[6px] border border-ds-border bg-ds-surface text-sm">
                {[
                  { label: t('assignWizard.reviewWho', 'For'), value: audienceLabel },
                  { label: t('assignWizard.reviewCourse', 'Course'), value: selectedPackage?.title ?? '' },
                  { label: t('assignWizard.reviewDue', 'Due'), value: formattedDue },
                  { label: t('assignWizard.reviewPriority', 'Priority'), value: priorityOptions.find((o) => o.id === priority)?.label ?? '' },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="text-ds-muted">{row.label}</dt>
                    <dd className="text-end font-medium text-ds-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-ds-muted">
                {t('assignWizard.reviewNote', 'They are notified and the course appears in their learning straight away.')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 justify-between px-5 pb-5 sm:justify-between sm:px-6">
          <Button type="button" variant="outline" onClick={handlePrevStep} disabled={step === 1 || isSubmitting}>
            <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
            {t('assignWizard.back', 'Back')}
          </Button>
          {step < 4 ? (
            <Button type="button" onClick={handleNextStep}>
              {t('assignWizard.next', 'Next')}
              <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmitAssignment} disabled={isSubmitting}>
              {isSubmitting ? t('assignWizard.assigning', 'Assigning...') : t('assignWizard.assign', 'Assign training')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
