/**
 * Studio > Quizzes & questions.
 *
 * Three jobs, one level of navigation:
 *  - Quizzes: what learners take. Edit, assign, or build one (by hand or from an SOP).
 *  - Question bank: every reusable question, filterable, with a warning when
 *    learners keep getting one wrong. Archiving keeps history; nothing here
 *    hard-deletes a question.
 *  - Review queue: drafted questions (by authors or AI) waiting to be approved.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Archive, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Clock, Eye, FileEdit, FileText, ListChecks, MoreVertical, Plus, RotateCcw, Search, Sparkles, Target, X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useTenant } from '@/contexts/TenantContext'
import {
  useApproveQuestion, usePendingReviewQuestions, useQuestions, useQuestionsPassRates, useRejectQuestion, useSetQuestionStatus,
} from '@/hooks/useQuestions'
import { cn } from '@/lib/utils'
import { learningService } from '@/services/learningService'
import type { QuestionPassRate } from '@/services/questionService'
import type { KnowledgeQuestion, QuestionDifficulty, QuestionStatus, QuestionType } from '@/types/questions'
import { DIFFICULTY_CONFIG, QUESTION_TYPE_CONFIG } from '@/types/questions'
import { EmptyState, WorkspaceHeader, headerActionClass } from '@/ui'

import { GenerateQuizDialog } from './components/GenerateQuizDialog'
import { QuestionPreviewSheet } from './components/QuestionPreviewSheet'
import { questionLabels } from './components/questionLabels'

type View = 'quizzes' | 'questions' | 'review'
const PAGE_SIZE = 25
const MIN_ATTEMPTS_FOR_FLAG = 5
const LEGACY_SECTION: Record<string, View> = { questions: 'questions', assessments: 'quizzes' }

const chip = (active: boolean) => cn(
  'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
  active ? 'border-ds-ink bg-ds-ink text-ds-on-ink' : 'border-ds-border bg-ds-surface text-ds-ink hover:border-ds-border-strong',
)
const selectCls = 'h-9 rounded-full border border-ds-border bg-ds-surface ps-3 pe-8 text-sm text-ds-ink hover:border-ds-border-strong focus:outline-none focus:ring-2 focus:ring-ds-accent'

const STATUS_PILL: Record<string, string> = {
  published: 'bg-ds-success-soft text-ds-success',
  draft: 'bg-ds-surface-subtle text-ds-ink-secondary',
  pending_review: 'bg-ds-warning-soft text-ds-warning',
  archived: 'bg-ds-surface-subtle text-ds-muted line-through decoration-1',
}

export function QuestionBank() {
  const { t } = useTranslation(['knowledge', 'common'])
  const labels = questionLabels(t)
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentOrganization } = useTenant()
  const orgId = currentOrganization?.id ?? null
  const legacy = searchParams.get('section')
  const view: View = (searchParams.get('view') as View) || (legacy ? LEGACY_SECTION[legacy] : undefined) || 'quizzes'

  const setView = (next: View) => {
    const p = new URLSearchParams()
    p.set('view', next)
    setSearchParams(p)
  }

  const [generateOpen, setGenerateOpen] = useState(false)
  const [preview, setPreview] = useState<KnowledgeQuestion | null>(null)

  // Totals for the summary and tab counts - whole bank, not just a page.
  const quizzes = useQuery({
    queryKey: ['quizzes', 'studio', orgId],
    enabled: !!orgId,
    queryFn: () => learningService.getQuizzes(undefined, orgId),
  })
  const bankTotal = useQuestions({}, 1, 1)
  const draftTotal = useQuestions({ status: 'draft' }, 1, 1)
  const pending = usePendingReviewQuestions()
  const approve = useApproveQuestion()

  const quizList = quizzes.data ?? []
  const quizPublished = quizList.filter((q) => q.status === 'published').length
  const pendingCount = pending.data?.total ?? 0

  const summary: { view: View; label: string; value: number | undefined; detail: string; icon: typeof ListChecks; tone: string }[] = [
    { view: 'quizzes', label: t('quizBank.summary.quizzes', 'Quizzes'), value: quizzes.isLoading ? undefined : quizList.length, detail: t('quizBank.summary.published', '{{count}} published', { count: quizPublished }), icon: ListChecks, tone: 'bg-ds-brass/15 text-ds-brass' },
    { view: 'questions', label: t('quizBank.summary.questions', 'Questions in the bank'), value: bankTotal.data?.total, detail: t('quizBank.summary.drafts', '{{count}} drafts', { count: draftTotal.data?.total ?? 0 }), icon: ClipboardList, tone: 'bg-ds-info-soft text-ds-info' },
    { view: 'review', label: t('quizBank.summary.review', 'Waiting for review'), value: pending.isLoading ? undefined : pendingCount, detail: pendingCount > 0 ? t('quizBank.summary.reviewHint', 'Approve before learners see them') : t('quizBank.summary.reviewNone', 'Nothing waiting'), icon: Clock, tone: pendingCount > 0 ? 'bg-ds-warning-soft text-ds-warning' : 'bg-ds-success-soft text-ds-success' },
  ]

  const tabs: { id: View; label: string; count?: number }[] = [
    { id: 'quizzes', label: t('quizBank.tabs.quizzes', 'Quizzes'), count: quizzes.isLoading ? undefined : quizList.length },
    { id: 'questions', label: t('quizBank.tabs.questions', 'Question bank'), count: bankTotal.data?.total },
    { id: 'review', label: t('quizBank.tabs.review', 'Review queue'), count: pendingCount || undefined },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkspaceHeader
        eyebrow={t('quizBank.eyebrow', 'Studio')}
        title={t('quizBank.title', 'Quizzes & questions')}
        context={t('quizBank.context', 'Write questions once, reuse them across quizzes and course checkpoints, and see which ones learners struggle with.')}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={headerActionClass.secondary}>
                  <Sparkles aria-hidden="true" className="h-4 w-4 text-ds-brass" />
                  {t('quizBank.generate', 'Generate with AI')}
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setGenerateOpen(true)} className="flex-col items-start gap-0.5 py-2">
                  <span className="font-medium">{t('quizBank.generateQuiz', 'A quiz from an SOP')}</span>
                  <span className="text-xs text-ds-muted">{t('quizBank.generateQuizHint', 'Pick a published document; get a ready-to-review quiz')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex-col items-start gap-0.5 py-2">
                  <Link to="/studio/quizzes/generate">
                    <span className="font-medium">{t('quizBank.generateQuestions', 'Questions from text')}</span>
                    <span className="text-xs text-ds-muted">{t('quizBank.generateQuestionsHint', 'Paste any procedure; questions go to the review queue')}</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/studio/questions/new" className={`${headerActionClass.secondary} hidden sm:inline-flex`}>
              {t('quizBank.newQuestion', 'New question')}
            </Link>
            <Link to="/studio/quizzes/new" className={headerActionClass.primary}>
              <Plus aria-hidden="true" className="h-4 w-4" />{t('quizBank.newQuiz', 'New quiz')}
            </Link>
          </>
        }
      />

      <section aria-label={t('quizBank.summary.label', 'Summary')} className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <button
            key={s.view}
            type="button"
            onClick={() => setView(s.view)}
            className={cn(
              'flex items-center gap-3 rounded-[8px] border bg-ds-surface p-4 text-start transition-[border-color,box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
              view === s.view ? 'border-ds-ink' : 'border-ds-border hover:border-ds-border-strong',
            )}
          >
            <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px]', s.tone)}><s.icon aria-hidden="true" className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-ds-muted">{s.label}</span>
              <span className="block font-editorial text-[28px] font-semibold leading-none text-ds-ink tabular-nums">{s.value ?? '–'}</span>
              <span className="mt-1 block truncate text-xs text-ds-muted">{s.detail}</span>
            </span>
          </button>
        ))}
      </section>

      <div role="tablist" aria-label={t('quizBank.tabs.label', 'Quizzes and questions')} className="flex gap-1 overflow-x-auto border-b border-ds-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className={cn(
              '-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent',
              view === tab.id ? 'border-ds-ink text-ds-ink' : 'border-transparent text-ds-muted hover:text-ds-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('rounded-full px-1.5 font-mono text-xs tabular-nums', tab.id === 'review' && tab.count ? 'bg-ds-warning text-white dark:text-ds-on-ink' : 'bg-ds-surface-subtle text-ds-muted')}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {view === 'quizzes' && <QuizzesView quizzes={quizList} isLoading={quizzes.isLoading} isError={quizzes.isError} onRetry={() => void quizzes.refetch()} onGenerate={() => setGenerateOpen(true)} onChanged={() => void quizzes.refetch()} />}
        {view === 'questions' && <QuestionsView onPreview={setPreview} labels={labels} />}
        {view === 'review' && <ReviewView onPreview={setPreview} labels={labels} />}
      </div>

      <GenerateQuizDialog open={generateOpen} onOpenChange={setGenerateOpen} onGenerated={() => { void quizzes.refetch(); setView('quizzes') }} />
      <QuestionPreviewSheet
        question={preview}
        onClose={() => setPreview(null)}
        onApprove={(id) => { approve.mutate({ id }); setPreview(null) }}
        approving={approve.isPending}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Quizzes                                                                   */
/* ------------------------------------------------------------------------ */

interface QuizRow {
  id: string
  title: string
  description?: string | null
  status: string
  question_count?: number
  time_limit_minutes?: number | null
  passing_score_percentage?: number | null
  updated_at?: string | null
  created_at?: string | null
}

function QuizzesView({ quizzes, isLoading, isError, onRetry, onGenerate, onChanged }: {
  quizzes: QuizRow[]; isLoading: boolean; isError: boolean; onRetry: () => void; onGenerate: () => void; onChanged: () => void
}) {
  const { t, i18n } = useTranslation(['knowledge', 'common'])
  const { toast } = useToast()
  const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-GB'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all')
  const [toDelete, setToDelete] = useState<QuizRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const counts = useMemo(() => ({
    all: quizzes.length,
    published: quizzes.filter((q) => q.status === 'published').length,
    draft: quizzes.filter((q) => q.status === 'draft').length,
    archived: quizzes.filter((q) => q.status === 'archived').length,
  }), [quizzes])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quizzes.filter((quiz) =>
      (status === 'all' || quiz.status === status) &&
      (!q || quiz.title.toLowerCase().includes(q) || (quiz.description ?? '').toLowerCase().includes(q)))
  }, [quizzes, search, status])

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await learningService.deleteQuiz(toDelete.id)
      toast({ title: t('quizBank.quizDeleted', 'Quiz deleted') })
      onChanged()
    } catch {
      toast({ title: t('quizBank.quizDeleteError', 'The quiz could not be deleted'), variant: 'destructive' })
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  if (isError) {
    return (
      <EmptyState
        title={t('quizBank.loadError', 'Quizzes could not be loaded')}
        description={t('quizBank.loadErrorHint', 'Check your connection and try again.')}
        action={<Button variant="outline" onClick={onRetry}>{t('common:tryAgain', 'Try again')}</Button>}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="search" className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
          <input
            type="search"
            aria-label={t('quizBank.searchQuizzes', 'Search quizzes')}
            placeholder={t('quizBank.searchQuizzes', 'Search quizzes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-ds-border bg-ds-surface ps-9 pe-3 text-sm text-ds-ink placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30"
          />
        </div>
        <div role="group" aria-label={t('quizBank.filterStatus', 'Filter by status')} className="flex flex-wrap gap-2">
          {(['all', 'published', 'draft', 'archived'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === 'all' ? t('quizBank.all', 'All') : t(`quizBank.status.${s}`, s)}
              <span className="font-mono text-xs tabular-nums opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-[8px]" />)}</div>
      ) : quizzes.length === 0 ? (
        <EmptyState
          illustration="courses"
          title={t('quizBank.noQuizzes', 'No quizzes yet')}
          description={t('quizBank.noQuizzesHint', 'Build one from questions in your bank, or let the AI draft one from an SOP for you to review.')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={onGenerate}><Sparkles aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.generateQuiz', 'A quiz from an SOP')}</Button>
              <Button asChild><Link to="/studio/quizzes/new"><Plus aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.newQuiz', 'New quiz')}</Link></Button>
            </div>
          }
        />
      ) : shown.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-ds-border p-6 text-center text-sm text-ds-muted">{t('quizBank.noMatch', 'Nothing matches. Try another search or filter.')}</p>
      ) : (
        <ul className="divide-y divide-ds-border overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
          {shown.map((quiz) => (
            <li key={quiz.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/studio/quizzes/${quiz.id}`} className="text-[15px] font-semibold text-ds-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">{quiz.title}</Link>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[quiz.status] ?? STATUS_PILL.draft)}>{t(`quizBank.status.${quiz.status}`, quiz.status)}</span>
                </div>
                {quiz.description && <p className="line-clamp-1 text-sm text-ds-ink-secondary">{quiz.description}</p>}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ds-muted">
                  <span className="inline-flex items-center gap-1"><ClipboardList aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.questionCount', '{{count}} questions', { count: quiz.question_count ?? 0 })}</span>
                  <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{quiz.time_limit_minutes ? t('quizBank.minutes', '{{count}} min', { count: quiz.time_limit_minutes }) : t('quizBank.noTimeLimit', 'No time limit')}</span>
                  {quiz.passing_score_percentage != null && <span className="inline-flex items-center gap-1"><Target aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.passMark', 'Pass mark {{percent}}%', { percent: quiz.passing_score_percentage })}</span>}
                  {(quiz.updated_at || quiz.created_at) && <span>{t('quizBank.updated', 'Updated {{date}}', { date: new Date((quiz.updated_at || quiz.created_at) as string).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>}
                </p>
                {(quiz.question_count ?? 0) === 0 && (
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-ds-warning"><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.emptyQuiz', 'Has no questions yet - learners cannot take it')}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" asChild><Link to={`/studio/quizzes/${quiz.id}`}><FileEdit aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.edit', 'Edit')}</Link></Button>
                {quiz.status === 'published' && (
                  <Button size="sm" asChild><Link to={`/manage/assignments/quizzes?quiz=${quiz.id}`}>{t('quizBank.assign', 'Assign')}</Link></Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common:a11y.moreActions', 'More actions')}><MoreVertical aria-hidden="true" className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-ds-danger" onClick={() => setToDelete(quiz)}>{t('quizBank.deleteQuiz', 'Delete quiz')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmationDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        variant="danger"
        title={t('quizBank.deleteTitle', 'Delete "{{title}}"?', { title: toDelete?.title ?? '' })}
        description={t('quizBank.deleteBody', 'Learners will no longer be able to take it and it disappears from assignments. Its questions stay in the question bank.')}
        confirmText={t('quizBank.deleteQuiz', 'Delete quiz')}
        cancelText={t('common:cancel', 'Cancel')}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Question bank                                                             */
/* ------------------------------------------------------------------------ */

type Labels = ReturnType<typeof questionLabels>

function QuestionRow({ q, passRate, labels, onPreview, actions }: {
  q: KnowledgeQuestion; passRate?: QuestionPassRate; labels: Labels; onPreview: () => void; actions: React.ReactNode
}) {
  const { t } = useTranslation(['knowledge', 'common'])
  const struggling = !!passRate && passRate.totalAttempts >= MIN_ATTEMPTS_FOR_FLAG && passRate.accuracyRate < 50
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
      <button type="button" onClick={onPreview} className="min-w-0 flex-1 space-y-1.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
        <span className="line-clamp-2 block text-[15px] font-medium leading-snug text-ds-ink hover:underline">{q.question_text}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ds-muted">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_PILL[q.status] ?? STATUS_PILL.draft)}>{labels.status(q.status)}</span>
          <span>{labels.type(q.question_type)}</span>
          <span>{labels.difficulty(q.difficulty_level)}</span>
          <span>{t('quizBank.points', '{{count}} pts', { count: q.points })}</span>
          {q.linked_sop && <span className="inline-flex max-w-[16rem] items-center gap-1 truncate"><FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ds-brass" /><span className="truncate">{q.linked_sop.title}</span></span>}
          {q.ai_generated && <span className="inline-flex items-center gap-1 text-ds-accent"><Sparkles aria-hidden="true" className="h-3 w-3" />{t('quizBank.ai', 'AI draft')}</span>}
          {passRate && passRate.totalAttempts > 0 && (
            <span className={cn('inline-flex items-center gap-1', struggling && 'font-semibold text-ds-danger')}>
              {struggling && <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />}
              {t('quizBank.passRateShort', '{{rate}}% correct', { rate: Math.round(passRate.accuracyRate) })}
            </span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </li>
  )
}

function QuestionsView({ onPreview, labels }: { onPreview: (q: KnowledgeQuestion) => void; labels: Labels }) {
  const { t } = useTranslation(['knowledge', 'common'])
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(search)
  useEffect(() => { const id = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(id) }, [search])

  const status = (params.get('status') as QuestionStatus | null) ?? null
  const type = (params.get('type') as QuestionType | null) ?? null
  const difficulty = (params.get('difficulty') as QuestionDifficulty | null) ?? null
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  useEffect(() => { if (page !== 1 && debounced !== (params.get('q') ?? '')) update('page', null) }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useQuestions({ status: status ?? undefined, type: type ?? undefined, difficulty: difficulty ?? undefined, search: debounced || undefined }, page, PAGE_SIZE)
  const ids = useMemo(() => (list.data?.questions ?? []).map((q) => q.id), [list.data])
  const passRates = useQuestionsPassRates(ids)
  const setStatus = useSetQuestionStatus()
  const [toArchive, setToArchive] = useState<KnowledgeQuestion | null>(null)

  const total = list.data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  const filtered = !!(status || type || difficulty || debounced)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div role="search" className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
          <input
            type="search"
            aria-label={t('quizBank.searchQuestions', 'Search questions')}
            placeholder={t('quizBank.searchQuestions', 'Search questions')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-ds-border bg-ds-surface ps-9 pe-3 text-sm text-ds-ink placeholder:text-ds-muted focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('quizBank.filterStatus', 'Filter by status')} className="flex flex-wrap gap-2">
            {([null, 'published', 'draft', 'archived'] as const).map((s) => (
              <button key={s ?? 'all'} type="button" aria-pressed={status === s} onClick={() => update('status', s)} className={chip(status === s)}>
                {s ? labels.status(s) : t('quizBank.all', 'All')}
              </button>
            ))}
          </div>
          <select aria-label={t('quizBank.filterType', 'Question type')} value={type ?? ''} onChange={(e) => update('type', e.target.value || null)} className={selectCls}>
            <option value="">{t('quizBank.allTypes', 'All types')}</option>
            {Object.keys(QUESTION_TYPE_CONFIG).map((k) => <option key={k} value={k}>{labels.type(k)}</option>)}
          </select>
          <select aria-label={t('quizBank.filterDifficulty', 'Difficulty')} value={difficulty ?? ''} onChange={(e) => update('difficulty', e.target.value || null)} className={selectCls}>
            <option value="">{t('quizBank.allDifficulties', 'All difficulties')}</option>
            {Object.keys(DIFFICULTY_CONFIG).map((k) => <option key={k} value={k}>{labels.difficulty(k)}</option>)}
          </select>
          {filtered && (
            <button type="button" onClick={() => { setSearch(''); setParams(new URLSearchParams({ view: 'questions' }), { replace: true }) }} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-medium text-ds-accent hover:underline">
              <X aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.clearFilters', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {list.isLoading ? (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-[8px]" />)}</div>
      ) : list.isError ? (
        <EmptyState
          title={t('quizBank.questionsError', 'Questions could not be loaded')}
          description={t('quizBank.loadErrorHint', 'Check your connection and try again.')}
          action={<Button variant="outline" onClick={() => void list.refetch()}>{t('common:tryAgain', 'Try again')}</Button>}
        />
      ) : total === 0 ? (
        <EmptyState
          illustration={filtered ? 'search' : 'courses'}
          title={filtered ? t('quizBank.noMatchTitle', 'No questions match') : t('quizBank.noQuestions', 'No questions yet')}
          description={filtered ? t('quizBank.noMatch', 'Nothing matches. Try another search or filter.') : t('quizBank.noQuestionsHint', 'Write your first question, or generate some from an SOP and review them.')}
          action={!filtered ? <Button asChild><Link to="/studio/questions/new"><Plus aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.newQuestion', 'New question')}</Link></Button> : undefined}
        />
      ) : (
        <>
          <ul className="divide-y divide-ds-border overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
            {(list.data?.questions ?? []).map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                labels={labels}
                passRate={passRates.data?.[q.id]}
                onPreview={() => onPreview(q)}
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => onPreview(q)}><Eye aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.preview', 'Preview')}</Button>
                    <Button variant="outline" size="sm" asChild><Link to={`/studio/questions/${q.id}/edit`}><FileEdit aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.edit', 'Edit')}</Link></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common:a11y.moreActions', 'More actions')}><MoreVertical aria-hidden="true" className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {q.status === 'archived' ? (
                          <DropdownMenuItem onClick={() => setStatus.mutate({ id: q.id, status: 'draft' })}>
                            <RotateCcw aria-hidden="true" className="me-2 h-4 w-4" />{t('quizBank.restore', 'Restore as draft')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setToArchive(q)}>
                            <Archive aria-hidden="true" className="me-2 h-4 w-4" />{t('quizBank.archive', 'Archive')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />
            ))}
          </ul>
          <nav aria-label={t('quizBank.pagination', 'Pages')} className="flex items-center justify-between gap-3 text-sm text-ds-muted">
            <span>{t('quizBank.showing', 'Showing {{from}}–{{to}} of {{total}}', { from, to, total })}</span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update('page', String(page - 1))}>
                <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" /><span className="sr-only sm:not-sr-only sm:ms-1">{t('quizBank.previous', 'Previous')}</span>
              </Button>
              <Button variant="outline" size="sm" disabled={to >= total} onClick={() => update('page', String(page + 1))}>
                <span className="sr-only sm:not-sr-only sm:me-1">{t('quizBank.next', 'Next')}</span><ChevronRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </span>
          </nav>
        </>
      )}

      <ConfirmationDialog
        open={!!toArchive}
        onOpenChange={(o) => !o && setToArchive(null)}
        onConfirm={() => { if (toArchive) setStatus.mutate({ id: toArchive.id, status: 'archived' }); setToArchive(null) }}
        variant="warning"
        title={t('quizBank.archiveTitle', 'Archive this question?')}
        description={t('quizBank.archiveBody', 'It leaves the active bank and cannot be added to new quizzes. Quizzes that already use it and past attempts are kept. You can restore it any time.')}
        confirmText={t('quizBank.archive', 'Archive')}
        cancelText={t('common:cancel', 'Cancel')}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Review queue                                                              */
/* ------------------------------------------------------------------------ */

function ReviewView({ onPreview, labels }: { onPreview: (q: KnowledgeQuestion) => void; labels: Labels }) {
  const { t } = useTranslation(['knowledge', 'common'])
  const pending = usePendingReviewQuestions()
  const approve = useApproveQuestion()
  const reject = useRejectQuestion()
  const [rejecting, setRejecting] = useState<KnowledgeQuestion | null>(null)
  const [notes, setNotes] = useState('')
  const items = pending.data?.questions ?? []

  if (pending.isLoading) return <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-[8px]" />)}</div>
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('quizBank.reviewEmpty', 'Nothing waiting for review')}
        description={t('quizBank.reviewEmptyHint', 'Questions drafted by authors or the AI appear here until someone approves them.')}
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-ink-secondary">{t('quizBank.reviewIntro', 'Check each question and its answer key. Approved questions become available for quizzes; rejected ones go back to the author with your note.')}</p>
      <ul className="divide-y divide-ds-border overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface">
        {items.map((q) => (
          <QuestionRow
            key={q.id}
            q={q}
            labels={labels}
            onPreview={() => onPreview(q)}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => onPreview(q)}><Eye aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.check', 'Check')}</Button>
                <Button variant="outline" size="sm" onClick={() => { setRejecting(q); setNotes('') }}>{t('quizBank.reject', 'Send back')}</Button>
                <Button size="sm" onClick={() => approve.mutate({ id: q.id })} disabled={approve.isPending} className="bg-ds-success text-white dark:text-ds-on-ink hover:bg-ds-success/90">
                  <CheckCircle aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.approveShort', 'Approve')}
                </Button>
              </>
            }
          />
        ))}
      </ul>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('quizBank.rejectTitle', 'Send back to the author')}</DialogTitle>
            <DialogDescription className="line-clamp-2">{rejecting?.question_text}</DialogDescription>
          </DialogHeader>
          <label htmlFor="reject-notes" className="text-sm font-medium text-ds-ink">{t('quizBank.rejectNotes', 'What needs to change?')}</label>
          <Textarea id="reject-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={t('quizBank.rejectPlaceholder', 'e.g. Two answers could be correct; option C contradicts the SOP.')} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>{t('common:cancel', 'Cancel')}</Button>
            <Button
              disabled={!notes.trim() || reject.isPending}
              onClick={() => { if (rejecting) reject.mutate({ id: rejecting.id, notes: notes.trim() }); setRejecting(null) }}
            >
              {t('quizBank.reject', 'Send back')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default QuestionBank
