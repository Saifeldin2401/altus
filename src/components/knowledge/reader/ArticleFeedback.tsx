import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface ArticleFeedbackProps {
  isSuccess: boolean
  showFeedbackInput: boolean
  feedbackHelpful: boolean
  feedbackText: string
  isPending: boolean
  onFeedbackTextChange: (val: string) => void
  onCancel: () => void
  onSubmit: () => void
  onMarkHelpful: () => void
  onMarkNotHelpful: () => void
}

export function ArticleFeedback({
  isSuccess,
  showFeedbackInput,
  feedbackHelpful,
  feedbackText,
  isPending,
  onFeedbackTextChange,
  onCancel,
  onSubmit,
  onMarkHelpful,
  onMarkNotHelpful,
}: ArticleFeedbackProps) {
  const { t } = useTranslation('knowledge')

  return (
    <Card className="border-none bg-ds-surface overflow-hidden relative">
      <CardContent className="p-6">
        {isSuccess ? (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-500">
            <div className="h-10 w-10 bg-ds-success-soft rounded-full flex items-center justify-center text-ds-success">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-ds-ink">
                {t('viewer.feedback_thanks')}
              </p>
              <p className="text-xs text-ds-muted">
                {t('viewer.feedback_thanks_desc')}
              </p>
            </div>
          </div>
        ) : showFeedbackInput ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ds-ink">
                {feedbackHelpful
                  ? t('viewer.what_did_you_like', 'Feedback')
                  : t('viewer.how_can_we_improve', 'Help us improve')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] uppercase font-bold text-ds-muted hover:text-ds-ink-secondary"
                onClick={onCancel}
              >
                {t('viewer.cancel')}
              </Button>
            </div>
            <Textarea
              value={feedbackText}
              onChange={(e) => onFeedbackTextChange(e.target.value)}
              placeholder={t('viewer.feedback_placeholder', 'Your thoughts...')}
              className="min-h-[80px] text-sm bg-ds-surface-subtle border-ds-border focus:bg-ds-surface dark:focus:bg-ds-ink transition-colors"
            />
            <Button
              size="sm"
              className="w-full bg-ds-ink hover:bg-ds-ink-secondary text-ds-on-ink h-9"
              onClick={onSubmit}
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t('viewer.submit_feedback')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-ds-ink">
              {t('viewer.feedback_title')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-ds-info-soft hover:text-ds-info transition-all border-ds-border"
                disabled={isPending}
                onClick={onMarkHelpful}
                aria-label={t('accessibility.helpful', 'Mark as helpful')}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 rounded-lg hover:bg-ds-danger-soft hover:text-ds-danger transition-all border-ds-border"
                disabled={isPending}
                onClick={onMarkNotHelpful}
                aria-label={t('accessibility.not_helpful', 'Mark as not helpful')}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
