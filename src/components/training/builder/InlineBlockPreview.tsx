/**
 * InlineBlockPreview
 * 
 * Renders a type-specific inline preview for content blocks within
 * the Training Builder canvas. Supports text (HTML), video, quiz,
 * image, audio, document, SOP, and interactive block types.
 */

import { InlineErrorBoundary } from '@/components/common/InlineErrorBoundary'
import { sanitizeHtml } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { HOTEL_ROLEPLAY_SCENARIOS } from '@/lib/ai/roleplayEngine'
import {
  BookOpen,
  ExternalLink,
  FileCheck,
  FileText,
  Headphones,
  Image as ImageIcon,
  Link,
  MessageSquare,
  Video
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { InlineQuizPreview } from './InlineQuizPreview'

interface ContentBlockForm {
  id: string
  type: string
  content: string
  content_url: string
  content_data: Record<string, unknown>
  is_mandatory: boolean
  title: string
  duration?: number
  points?: number
  order: number
}

interface InlineBlockPreviewProps {
  block: ContentBlockForm
  isRTL: boolean
  onRegenerateQuiz?: () => void
}

export function InlineBlockPreview({ block, isRTL, onRegenerateQuiz }: InlineBlockPreviewProps) {
  const { t } = useTranslation('training')

  // ------ Text / Rich HTML content ------
  if (block.type === 'text' || block.type === 'sop_reference') {
    if (!block.content && block.type === 'sop_reference') {
      // SOP reference with no embedded content — show reference card
      const sopTitle = (block.content_data as Record<string, unknown>)?.sop_title as string | undefined
      return (
        <div className={cn(
          'flex items-center gap-3 p-3 bg-ds-success-soft/60 rounded-lg border border-ds-success/60'
        )}>
          <BookOpen className="w-4 h-4 text-ds-success shrink-0" />
          <div className={cn('flex-1 min-w-0', 'text-start')}>
            <p className="text-sm font-medium text-ds-success truncate">
              {sopTitle || block.title || t('builder.inlinePreview.sopReference', 'Knowledge Base SOP')}
            </p>
            <p className="text-xs text-ds-success/70">
              {t('builder.inlinePreview.linkedSOP', 'Linked from Knowledge Base')}
            </p>
          </div>
          {block.content_url && (
            <a href={block.content_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-ds-success hover:text-ds-success">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )
    }

    if (!block.content) {
      return (
        <div className="p-3 text-xs text-muted-foreground italic text-center">
          {t('builder.inlinePreview.noContent', 'No content added yet')}
        </div>
      )
    }

    return (
      <InlineErrorBoundary>
        <div
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none text-ds-ink',
            'max-h-[300px] overflow-y-auto px-3 py-2',
            '[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5',
            '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
            '[&_p]:text-xs [&_p]:leading-relaxed [&_p]:my-1',
            '[&_ul]:text-xs [&_ul]:my-1 [&_ol]:text-xs [&_ol]:my-1',
            '[&_li]:text-xs [&_li]:my-0.5',
            '[&_table]:text-xs [&_th]:p-1.5 [&_td]:p-1.5',
            '[&_blockquote]:text-xs [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:italic',
            '[&_.callout]:text-xs [&_.callout]:p-2 [&_.callout]:rounded-md [&_.callout]:my-2',
            '[&_.callout-info]:bg-ds-info-soft [&_.callout-info]: [&_.callout-info]:border [&_.callout-info]:border-ds-info/30',
            '[&_.callout-warning]:bg-ds-warning-soft [&_.callout-warning]: [&_.callout-warning]:border [&_.callout-warning]:border-ds-warning/30',
            'text-start'
          )}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
        />
      </InlineErrorBoundary>
    )
  }

  // ------ Quiz blocks ------
  if (block.type === 'quiz') {
    const quizId = (block.content_data as Record<string, unknown>)?.quiz_id as string | undefined
    if (!quizId) {
      return (
        <div className="p-3 text-center text-xs text-muted-foreground italic">
          {t('builder.inlinePreview.quizNotLinked', 'Quiz not linked yet — save or generate questions first')}
        </div>
      )
    }
    return (
      <div className="p-2">
        <InlineQuizPreview
          quizId={quizId}
          onRegenerate={onRegenerateQuiz}
          isRTL={isRTL}
        />
      </div>
    )
  }

  // ------ Video ------
  if (block.type === 'video') {
    if (!block.content_url) {
      return (
        <div className={cn(
          'flex items-center gap-3 p-4 bg-ds-danger-soft/50 rounded-lg border border-dashed border-ds-danger/60'
        )}>
          <Video className="w-5 h-5 text-ds-danger" />
          <span className="text-xs text-muted-foreground italic">{t('builder.inlinePreview.noVideo', 'No video URL added yet')}</span>
        </div>
      )
    }
    return (
      <div className="rounded-lg overflow-hidden bg-black/5 border border-ds-border">
        <div className="aspect-video">
          <iframe
            src={block.content_url}
            className="w-full h-full"
            allowFullScreen
            title={block.title || 'Video Preview'}
            loading="lazy"
          />
        </div>
      </div>
    )
  }

  // ------ Image ------
  if (block.type === 'image') {
    if (!block.content_url) {
      return (
        <div className={cn(
          'flex items-center gap-3 p-4 bg-ds-info-soft/50 rounded-lg border border-dashed border-ds-info/60'
        )}>
          <ImageIcon className="w-5 h-5 text-ds-info" />
          <span className="text-xs text-muted-foreground italic">{t('builder.inlinePreview.noImage', 'No image uploaded yet')}</span>
        </div>
      )
    }
    return (
      <div className="rounded-lg overflow-hidden bg-ds-surface-subtle border border-ds-border">
        <img
          src={block.content_url}
          alt={block.title || 'Preview'}
          className="max-w-full max-h-[250px] mx-auto object-contain"
          loading="lazy"
        />
      </div>
    )
  }

  // ------ Audio ------
  if (block.type === 'audio') {
    if (!block.content_url) {
      return (
        <div className={cn(
          'flex items-center gap-3 p-4 bg-ds-info-soft/50 rounded-lg border border-dashed border-ds-info/60'
        )}>
          <Headphones className="w-5 h-5 text-ds-info" />
          <span className="text-xs text-muted-foreground italic">{t('builder.inlinePreview.noAudio', 'No audio file added yet')}</span>
        </div>
      )
    }
    return (
      <div className="p-3">
        <audio controls className="w-full" src={block.content_url} preload="metadata">
          {t('builder.inlinePreview.audioUnsupported', 'Your browser does not support the audio element.')}
        </audio>
      </div>
    )
  }

  // ------ Document Link ------
  if (block.type === 'document_link') {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 bg-ds-warning-soft/60 rounded-lg border border-ds-warning/60'
      )}>
        <div className="w-8 h-8 rounded-lg bg-ds-surface border border-ds-warning/30 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-ds-warning" />
        </div>
        <div className={cn('flex-1 min-w-0', 'text-start')}>
          <p className="text-sm font-medium text-ds-warning truncate">
            {block.title || t('builder.inlinePreview.document', 'Document')}
          </p>
          {block.content_url && (
            <a
              href={block.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ds-warning hover:text-ds-warning hover:underline flex items-center gap-1"
            >
              <Link className="w-3 h-3" />
              {t('builder.inlinePreview.openDocument', 'Open document')}
            </a>
          )}
        </div>
      </div>
    )
  }

  // ------ Practical Assignment ------
  if (block.type === 'assignment' || block.type === 'practical') {
    const prompt = (block.content_data?.instructions as string) || block.content
    const rubric = block.content_data?.rubric as string | undefined
    const requiresApproval = block.content_data?.requires_instructor_approval !== false

    return (
      <div className={cn(
        'p-3.5 bg-ds-warning-soft/60 rounded-[8px] border border-ds-warning/80 space-y-2.5',
        'text-start'
      )}>
        <div className={cn("flex items-center justify-between gap-2")}>
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-ds-warning shrink-0" />
            <span className="text-xs font-bold text-ds-warning">
              {block.title || t('practicalAssignment', 'Practical Assignment')}
            </span>
          </div>
          {requiresApproval && (
            <span className="text-[11px] bg-ds-warning-soft text-ds-warning px-2 py-0.5 rounded-full font-medium shrink-0">
              {t('requiresInstructorReview', 'Requires Trainer Review')}
            </span>
          )}
        </div>
        {prompt ? (
          <p className="text-xs text-ds-ink-secondary leading-relaxed whitespace-pre-wrap">
            {prompt}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t('builder.inlinePreview.noContent', 'No prompt/instructions provided yet')}
          </p>
        )}
        {rubric && (
          <div className="pt-2 border-t border-ds-warning/60 text-[11px] text-ds-ink-secondary">
            <span className="font-semibold">{t('evaluationRubric', 'Rubric')}: </span>
            <span>{rubric}</span>
          </div>
        )}
      </div>
    )
  }

  // ------ AI Guest Roleplay Simulation ------
  if (block.type === 'roleplay') {
    const scenarioId = (block.content_data?.scenario_id as string) || HOTEL_ROLEPLAY_SCENARIOS[0].id
    const scenario = HOTEL_ROLEPLAY_SCENARIOS.find(s => s.id === scenarioId) || HOTEL_ROLEPLAY_SCENARIOS[0]
    const passingScore = Number(block.content_data?.passing_score ?? 80)
    const maxTurns = Number(block.content_data?.max_turns ?? 5)

    return (
      <div className={cn(
        'p-3.5 bg-ds-warning-soft/70 rounded-[8px] border border-ds-warning/30 space-y-2.5',
        'text-start'
      )}>
        <div className={cn("flex items-center justify-between gap-2")}>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-ds-warning shrink-0" />
            <span className="text-xs font-bold text-ds-warning">
              {block.title || scenario.title}
            </span>
          </div>
          <span className="text-[11px] bg-ds-warning-soft text-ds-warning px-2 py-0.5 rounded-full font-bold shrink-0">
            Pass Threshold: {passingScore}%
          </span>
        </div>

        <p className="text-xs text-ds-ink-secondary leading-relaxed">
          {scenario.scenarioContext}
        </p>

        <div className="pt-2 border-t border-ds-warning/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Guest: <strong className="text-foreground">{scenario.guestName}</strong> ({scenario.guestTemperament})</span>
          <span>Max Turns: <strong className="text-foreground">{maxTurns}</strong></span>
          <span className="text-ds-warning font-medium">Forbes 5-Star & Saudi Karam Rubrics</span>
        </div>
      </div>
    )
  }

  // ------ Fallback ------
  return (
    <div className="p-3 text-xs text-muted-foreground italic text-center">
      {t('builder.inlinePreview.unsupportedType', 'Preview not available for this content type')}
    </div>
  )
}
