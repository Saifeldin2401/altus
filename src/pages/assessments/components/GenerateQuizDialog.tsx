import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useTenant } from '@/contexts/TenantContext'
import { useAIQuizGenerator } from '@/hooks/learning/useAIQuizGenerator'
import { supabase } from '@/lib/supabase'

type Difficulty = 'easy' | 'medium' | 'hard'

interface GenerateQuizDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: () => void
}

/**
 * Build a whole quiz from one published SOP. Only this organization's
 * published, current knowledge-base documents are offered as the source.
 */
export function GenerateQuizDialog({ open, onOpenChange, onGenerated }: GenerateQuizDialogProps) {
  const { t } = useTranslation(['knowledge', 'common'])
  const { currentOrganization } = useTenant()
  const { generateQuizFromSOP, generating } = useAIQuizGenerator()

  const [docs, setDocs] = useState<{ id: string; title: string }[]>([])
  const [docId, setDocId] = useState('')
  const [count, setCount] = useState(8)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [types, setTypes] = useState<string[]>(['mcq', 'true_false'])
  const [language, setLanguage] = useState('English')
  const [includeHints, setIncludeHints] = useState(false)
  const [includeExplanations, setIncludeExplanations] = useState(true)
  const [timeLimit, setTimeLimit] = useState(20)
  const [passingScore, setPassingScore] = useState(70)
  const [randomize, setRandomize] = useState(true)
  const [feedbackDuring, setFeedbackDuring] = useState(true)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')

  useEffect(() => {
    if (!open || !currentOrganization?.id) return
    let cancelled = false
    void supabase
      .from('documents')
      .select('id, title')
      .eq('status', 'PUBLISHED')
      .eq('is_deleted', false)
      .eq('is_active_kb_version', true)
      .or(`organization_id.eq.${currentOrganization.id},is_master_template.eq.true`)
      .order('title')
      .then(({ data }) => { if (!cancelled) setDocs(data ?? []) })
    return () => { cancelled = true }
  }, [open, currentOrganization?.id])

  const errors = useMemo(() => {
    const e: string[] = []
    if (!docId) e.push(t('quizBank.gen.errDoc', 'Choose the document to build the quiz from.'))
    if (count < 1 || count > 20) e.push(t('quizBank.gen.errCount', 'Choose between 1 and 20 questions.'))
    if (types.length === 0) e.push(t('quizBank.gen.errTypes', 'Choose at least one question type.'))
    return e
  }, [docId, count, types.length, t])

  const toggleType = (v: string) => setTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const generate = async () => {
    const doc = docs.find((d) => d.id === docId)
    await generateQuizFromSOP(docId, doc ? t('quizBank.gen.quizTitle', 'Quiz: {{title}}', { title: doc.title }) : undefined, count, language, {
      types,
      difficulty,
      includeHints,
      includeExplanations,
      timeLimitMinutes: timeLimit,
      passingScore,
      randomizeQuestions: randomize,
      showFeedbackDuring: feedbackDuring,
      status,
    })
    onOpenChange(false)
    onGenerated()
  }

  const field = 'space-y-1.5'
  const label = 'text-sm font-medium text-ds-ink'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('quizBank.gen.title', 'Generate a quiz from an SOP')}</DialogTitle>
          <DialogDescription>
            {t('quizBank.gen.description', 'The AI reads the document and writes the questions. The quiz is saved as a draft by default - review every question before publishing.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className={field}>
            <label className={label} htmlFor="gen-doc">{t('quizBank.gen.document', 'Source document')}</label>
            <Select value={docId} onValueChange={setDocId}>
              <SelectTrigger id="gen-doc"><SelectValue placeholder={t('quizBank.gen.chooseDoc', 'Choose a published SOP or policy')} /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {open && docs.length === 0 && <p className="text-xs text-ds-muted">{t('quizBank.gen.noDocs', 'No published documents yet. Publish an SOP in the knowledge base first.')}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <label className={label} htmlFor="gen-count">{t('quizBank.gen.count', 'Number of questions')}</label>
              <Input id="gen-count" type="number" min={1} max={20} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-ds-muted">{t('quizBank.gen.countHint', '5 to 15 works best.')}</p>
            </div>
            <div className={field}>
              <label className={label} htmlFor="gen-diff">{t('quizBank.gen.difficulty', 'Difficulty')}</label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger id="gen-diff"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t('quizBank.difficulty.easy', 'Easy')}</SelectItem>
                  <SelectItem value="medium">{t('quizBank.difficulty.medium', 'Medium')}</SelectItem>
                  <SelectItem value="hard">{t('quizBank.difficulty.hard', 'Hard')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className={label}>{t('quizBank.gen.types', 'Question types')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: 'mcq', label: t('quizBank.type.mcq', 'Multiple choice') },
                { value: 'true_false', label: t('quizBank.type.true_false', 'True / false') },
                { value: 'fill_blank', label: t('quizBank.type.fill_blank', 'Fill in the blank') },
              ].map((type) => (
                <label key={type.value} className="flex min-h-[40px] items-center gap-2 rounded-md border border-ds-border px-3 text-sm">
                  <Checkbox checked={types.includes(type.value)} onCheckedChange={() => toggleType(type.value)} />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <label className={label} htmlFor="gen-lang">{t('quizBank.gen.language', 'Language')}</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="gen-lang"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Arabic">العربية</SelectItem>
                  <SelectItem value="Bilingual">{t('quizBank.gen.bilingual', 'English and Arabic')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <label className={label} htmlFor="gen-status">{t('quizBank.gen.saveAs', 'Save as')}</label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'published')}>
                <SelectTrigger id="gen-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('quizBank.status.draft', 'Draft')}</SelectItem>
                  <SelectItem value="published">{t('quizBank.status.published', 'Published')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <label className={label} htmlFor="gen-time">{t('quizBank.gen.timeLimit', 'Time limit (minutes, 0 = none)')}</label>
              <Input id="gen-time" type="number" min={0} value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="gen-pass">{t('quizBank.gen.passMark', 'Pass mark (%)')}</label>
              <Input id="gen-pass" type="number" min={50} max={100} value={passingScore} onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { checked: includeExplanations, set: setIncludeExplanations, label: t('quizBank.gen.explanations', 'Explain each answer') },
              { checked: includeHints, set: setIncludeHints, label: t('quizBank.gen.hints', 'Add a hint to each question') },
              { checked: randomize, set: setRandomize, label: t('quizBank.gen.randomize', 'Shuffle question order') },
              { checked: feedbackDuring, set: setFeedbackDuring, label: t('quizBank.gen.feedback', 'Show feedback after each answer') },
            ].map((o) => (
              <label key={o.label} className="flex items-center gap-2 text-sm text-ds-ink">
                <Checkbox checked={o.checked} onCheckedChange={(v) => o.set(!!v)} />
                {o.label}
              </label>
            ))}
          </div>

          {errors.length > 0 && docId && (
            <ul className="rounded-md border border-ds-danger/30 bg-ds-danger-soft p-3 text-xs text-ds-danger">
              {errors.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:cancel', 'Cancel')}</Button>
          <Button onClick={generate} disabled={errors.length > 0 || generating}>
            <Sparkles aria-hidden="true" className={generating ? 'me-2 h-4 w-4 animate-spin' : 'me-2 h-4 w-4'} />
            {generating ? t('quizBank.gen.working', 'Writing questions…') : t('quizBank.gen.submit', 'Generate quiz')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
