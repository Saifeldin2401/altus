import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, CheckCircle, FileEdit, FileText, HelpCircle, Lightbulb } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { QuestionPassRate } from '@/services/questionService'
import type { KnowledgeQuestion } from '@/types/questions'

import { questionLabels } from './questionLabels'

interface QuestionPreviewSheetProps {
  question: KnowledgeQuestion | null
  passRate?: QuestionPassRate
  onClose: () => void
  onApprove?: (id: string) => void
  approving?: boolean
}

/** Read-only look at a question as learners see it, with the answer key. */
export function QuestionPreviewSheet({ question, passRate, onClose, onApprove, approving }: QuestionPreviewSheetProps) {
  const { t, i18n } = useTranslation(['knowledge', 'common'])
  const labels = questionLabels(t)
  const isRTL = i18n.dir() === 'rtl'

  return (
    <Sheet open={!!question} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isRTL ? 'left' : 'right'} className="w-[92vw] space-y-6 overflow-y-auto p-6 sm:max-w-xl">
        {question && (
          <>
            <SheetHeader className="space-y-3 text-start">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ds-muted">
                <span className="rounded-full border border-ds-border px-2 py-0.5 font-medium text-ds-ink">{labels.type(question.question_type)}</span>
                <span>{labels.difficulty(question.difficulty_level)}</span>
                <span aria-hidden="true">·</span>
                <span>{t('quizBank.points', '{{count}} pts', { count: question.points })}</span>
                <span className="ms-auto">{labels.status(question.status)}</span>
              </div>
              <SheetTitle className="font-editorial text-xl font-semibold leading-snug text-ds-ink">{question.question_text}</SheetTitle>
              {question.question_text_ar && (
                <p className="border-t border-ds-border pt-2 text-sm font-medium text-ds-ink-secondary" dir="rtl">{question.question_text_ar}</p>
              )}
            </SheetHeader>

            <section aria-labelledby="qp-answers" className="space-y-2">
              <h3 id="qp-answers" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('quizBank.answerKey', 'Answers')}</h3>
              {question.options && question.options.length > 0 ? (
                <ol className="space-y-2">
                  {question.options.map((option, idx) => (
                    <li
                      key={option.id || idx}
                      className={cn('rounded-xl border p-3 text-sm', option.is_correct ? 'border-ds-success/40 bg-ds-success-soft text-ds-ink' : 'border-ds-border bg-ds-surface text-ds-ink')}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', option.is_correct ? 'bg-ds-success text-white' : 'border border-ds-border bg-ds-surface-subtle text-ds-muted')}>
                          {option.is_correct ? <Check aria-hidden="true" className="h-3 w-3" /> : String.fromCharCode(65 + idx)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="leading-relaxed">{option.option_text}</p>
                          {option.option_text_ar && <p className="mt-1 text-ds-muted" dir="rtl">{option.option_text_ar}</p>}
                          {option.feedback && <p className="mt-2 border-t border-ds-border pt-1.5 text-xs text-ds-muted">{option.feedback}</p>}
                        </div>
                        {option.is_correct && <span className="sr-only">{t('quizBank.correct', 'Correct answer')}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-xl border border-ds-border bg-ds-surface-subtle p-3 text-sm">
                  <span className="font-semibold text-ds-ink">{t('quizBank.correctAnswer', 'Correct answer')}: </span>
                  <span className="text-ds-success">{question.correct_answer || t('quizBank.noAnswerKey', 'No answer key recorded')}</span>
                </p>
              )}
            </section>

            {question.explanation && (
              <section className="space-y-1 rounded-xl border border-ds-warning/30 bg-ds-warning-soft p-4 text-sm">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-warning">
                  <Lightbulb aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.explanation', 'Why this is the answer')}
                </h3>
                <p className="leading-relaxed text-ds-ink">{question.explanation}</p>
                {question.explanation_ar && <p className="border-t border-ds-warning/30 pt-1 text-ds-ink-secondary" dir="rtl">{question.explanation_ar}</p>}
              </section>
            )}

            {question.hint && (
              <section className="space-y-1 rounded-xl border border-ds-accent/30 bg-ds-accent-soft p-4 text-sm">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ds-accent">
                  <HelpCircle aria-hidden="true" className="h-3.5 w-3.5" />{t('quizBank.hint', 'Hint shown to learners')}
                </h3>
                <p className="leading-relaxed text-ds-ink">{question.hint}</p>
              </section>
            )}

            {question.linked_sop && (
              <Link
                to={`/knowledge/${question.linked_sop.id}`}
                onClick={onClose}
                className="flex items-center gap-2 rounded-xl border border-ds-border p-3 text-sm font-medium text-ds-ink hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
              >
                <FileText aria-hidden="true" className="h-4 w-4 text-ds-brass" />
                <span className="min-w-0 flex-1 truncate">{question.linked_sop.title}</span>
                <span className="text-xs text-ds-muted">{t('quizBank.sourceSop', 'Source SOP')}</span>
              </Link>
            )}

            {passRate && passRate.totalAttempts > 0 && (
              <section className="space-y-2 rounded-xl border border-ds-border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ds-ink">{t('quizBank.passRate', 'Answered correctly')}</span>
                  <span className="font-mono tabular-nums text-ds-ink">
                    {t('quizBank.passRateValue', '{{rate}}% of {{count}} attempts', { rate: Math.round(passRate.accuracyRate), count: passRate.totalAttempts })}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ds-surface-subtle" aria-hidden="true">
                  <div
                    className={cn('h-full rounded-full', passRate.accuracyRate >= 70 ? 'bg-ds-success' : passRate.accuracyRate >= 50 ? 'bg-ds-warning' : 'bg-ds-danger')}
                    style={{ width: `${Math.min(100, passRate.accuracyRate)}%` }}
                  />
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ds-border pt-4">
              {question.status === 'pending_review' && onApprove && (
                <Button size="sm" onClick={() => onApprove(question.id)} disabled={approving} className="bg-ds-success text-white hover:bg-ds-success/90">
                  <CheckCircle aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.approve', 'Approve and publish')}
                </Button>
              )}
              <Button size="sm" asChild>
                <Link to={`/studio/questions/${question.id}/edit`}>
                  <FileEdit aria-hidden="true" className="me-1.5 h-4 w-4" />{t('quizBank.edit', 'Edit')}
                </Link>
              </Button>
            </div>
            {question.ai_generated && <Badge variant="outline" className="text-[10px]">{t('quizBank.aiDraft', 'Drafted with AI')}</Badge>}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
