import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'

import { useTenant } from '@/contexts/TenantContext'
import { cn } from '@/lib/utils'

import { answerFromKnowledge, type KnowledgePassage } from '../answer/knowledgeAnswer'

/** Link that opens the article and scrolls to (and marks) the cited passage. */
export function passageHref(p: KnowledgePassage) {
  const anchor = p.text.replace(/…$/, '').split(/\s+/).slice(0, 8).join(' ')
  return `/knowledge/${p.articleId}?highlight=${encodeURIComponent(anchor)}`
}

/** A search reads like a question when it has a question mark or enough words. */
export const looksLikeQuestion = (q: string) => /[?؟]/.test(q) || q.trim().split(/\s+/).length >= 4

/**
 * "Ask the knowledge base". Runs only when the member asks (never on each
 * keystroke), answers only from the organization's published SOPs, and shows
 * where every step came from.
 */
export function AskKnowledgePanel({ question }: { question: string }) {
  const { t, i18n } = useTranslation('knowledge')
  const isArabic = !!i18n.language?.startsWith('ar')
  const { currentOrganization } = useTenant()
  const ask = useMutation({
    mutationFn: () => answerFromKnowledge(question, currentOrganization?.id ?? null, isArabic),
  })
  const { reset } = ask

  // A new question clears the previous answer.
  useEffect(() => { reset() }, [question, reset])

  return (
    <section aria-labelledby="kb-ask" className="rounded-[8px] border border-ds-brass/30 bg-ds-brass/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="kb-ask" className="flex items-center gap-2 font-editorial text-[19px] font-semibold text-ds-ink">
          <Sparkles aria-hidden="true" className="h-5 w-5 text-ds-brass" />
          {t('ask.title', 'Get an answer from your SOPs')}
        </h2>
        {ask.isIdle && (
          <button
            type="button"
            onClick={() => ask.mutate()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-ds-ink px-4 text-sm font-semibold text-ds-on-ink hover:bg-ds-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2"
          >
            {t('ask.button', 'Answer this')}
          </button>
        )}
      </div>

      <div aria-live="polite" className="mt-3">
        {ask.isPending && (
          <p className="flex items-center gap-2 text-sm text-ds-ink-secondary">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {t('ask.searching', 'Reading your SOPs…')}
          </p>
        )}

        {ask.isError && (
          <p className="flex items-center gap-2 text-sm text-ds-danger">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            {t('ask.error', 'The answer could not be generated. The search results below are still available.')}
            <button type="button" onClick={() => ask.mutate()} className="font-semibold underline">{t('ask.retry', 'Try again')}</button>
          </p>
        )}

        {ask.data?.status === 'not_found' && (
          <p className="text-sm text-ds-ink-secondary">
            {t('ask.notFound', "Your organization's published SOPs don't cover this yet. Check the results below, or ask your manager - this search is shared with your knowledge team so they can add it.")}
          </p>
        )}

        {ask.data?.status === 'answered' && (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1.5 ps-5 text-[15px] leading-relaxed text-ds-ink">
              {ask.data.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ds-muted">{t('ask.sources', 'Sources')}</p>
              <ol className="mt-1.5 space-y-1">
                {ask.data.sources.map((s, i) => (
                  <li key={`${s.articleId}-${i}`} className="text-sm">
                    <Link to={passageHref(s)} className={cn('font-medium text-ds-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent')}>
                      [{i + 1}] {s.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-xs text-ds-muted">
              {t('ask.disclaimer', 'Generated from your published SOPs. Open the source before acting on anything safety-critical.')}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
