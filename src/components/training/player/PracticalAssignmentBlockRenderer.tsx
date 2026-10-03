import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  assignmentSubmissionService,
  type SubmissionAttachment,
  type TrainingAssignmentSubmission
} from '@/services/assignmentSubmissionService'
import type { TrainingContentBlock } from '@/lib/types/training'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
  UploadCloud
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PracticalAssignmentBlockRendererProps {
  block: TrainingContentBlock
  moduleId: string
  assignmentId?: string | null
  initialSubmission?: TrainingAssignmentSubmission | null
  onSubmissionUpdated?: (submission: TrainingAssignmentSubmission) => void
  isRTL?: boolean
  /** Localised instructions/prompt to show alongside the original when translating. */
  translatedPrompt?: string
  showBilingual?: boolean
  translationDir?: 'ltr' | 'rtl'
}

export function PracticalAssignmentBlockRenderer({
  block,
  moduleId,
  assignmentId,
  initialSubmission,
  onSubmissionUpdated,
  isRTL = false,
  translatedPrompt,
  showBilingual = false,
  translationDir = 'ltr'
}: PracticalAssignmentBlockRendererProps) {
  const { t } = useTranslation('training')
  const { toast } = useToast()

  const [submission, setSubmission] = useState<TrainingAssignmentSubmission | null>(initialSubmission || null)
  const [content, setContent] = useState<string>(initialSubmission?.submission_content || '')
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>(
    initialSubmission?.attachment_urls || []
  )
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditingResubmit, setIsEditingResubmit] = useState(false)

  const contentData = block.content_data as Record<string, unknown> | null
  const instructions = (contentData?.instructions as string) || block.content || ''
  const rubric = (contentData?.rubric as string) || ''
  const maxFileSizeMb = (contentData?.max_file_size_mb as number) || 25
  const requiresApproval = contentData?.requires_instructor_approval !== false

  useEffect(() => {
    if (initialSubmission) {
      setSubmission(initialSubmission)
      setContent(initialSubmission.submission_content || '')
      setAttachments(initialSubmission.attachment_urls || [])
    }
  }, [initialSubmission])

  const status = submission?.status || 'draft'
  const isApproved = status === 'approved'
  const isPending = status === 'submitted' || status === 'under_review'
  const isRevisionRequired = status === 'revision_required' || status === 'rejected'
  const canEdit = (!submission || status === 'draft' || isRevisionRequired || isEditingResubmit) && !isApproved

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const newAttachments: SubmissionAttachment[] = [...attachments]
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > maxFileSizeMb * 1024 * 1024) {
          toast({
            title: t('fileTooLarge', 'File too large'),
            description: t('fileSizeLimit', {
              max: maxFileSizeMb,
              defaultValue: `Maximum allowed size is ${maxFileSizeMb}MB.`
            }),
            variant: 'destructive'
          })
          continue
        }

        const uploaded = await assignmentSubmissionService.uploadAttachment(file, moduleId, block.id)
        newAttachments.push(uploaded)
      }
      setAttachments(newAttachments)
      toast({
        title: t('fileUploaded', 'File uploaded'),
        description: t('fileUploadSuccess', 'Attachment attached successfully.')
      })
    } catch (err: any) {
      console.error('File upload failed:', err)
      toast({
        title: t('uploadFailed', 'Upload failed'),
        description: err.message || 'Could not upload attachment. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleRemoveAttachment = (index: number) => {
    if (!canEdit) return
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (isDraftMode = false) => {
    if (!isDraftMode && !content.trim() && attachments.length === 0) {
      toast({
        title: t('emptySubmission', 'Submission required'),
        description: t('pleaseAddContentOrAttachment', 'Please provide a written response or upload a required file.'),
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await assignmentSubmissionService.submitAssignment({
        moduleId,
        blockId: block.id,
        assignmentId,
        content,
        attachments,
        status: isDraftMode ? 'draft' : 'submitted'
      })

      setSubmission(result)
      setIsEditingResubmit(false)
      onSubmissionUpdated?.(result)

      if (isDraftMode) {
        toast({
          title: t('draftSaved', 'Draft saved'),
          description: t('draftSavedDescription', 'Your assignment draft has been saved.')
        })
      } else {
        toast({
          title: t('assignmentSubmitted', 'Assignment submitted!'),
          description: requiresApproval
            ? t('assignmentAwaitingReview', 'Your submission has been sent to your instructor for review.')
            : t('assignmentCompleted', 'Practical assignment marked as completed.')
        })
      }
    } catch (err: any) {
      console.error('Submission failed:', err)
      toast({
        title: t('submissionFailed', 'Submission failed'),
        description: err.message || 'Could not submit assignment. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn("space-y-6 max-w-4xl mx-auto")}>
      {/* Assignment Header Card */}
      <Card className="border-ds-border bg-ds-surface shadow-sm overflow-hidden">
        <div className="h-2 bg-ds-brass w-full" />
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[8px] bg-ds-brass/15 flex items-center justify-center text-ds-brass">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-ds-ink">
                  {block.title || t('practicalAssignment', 'Practical Assignment')}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {requiresApproval
                    ? t('requiresInstructorReview', 'Requires instructor review & approval')
                    : t('submissionOnly', 'Submission required to advance')}
                </p>
              </div>
            </div>

            {/* Status Badges */}
            {isApproved && (
              <Badge className="bg-ds-success text-white dark:text-ds-on-ink hover:bg-ds-success px-3 py-1 text-xs gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('approved', 'Approved')}
                {submission?.score !== null && submission?.score !== undefined && ` (${submission.score}%)`}
              </Badge>
            )}
            {isPending && (
              <Badge className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 px-3 py-1 text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t('underReview', 'Under Review')}
              </Badge>
            )}
            {isRevisionRequired && (
              <Badge className="bg-ds-danger text-white hover:bg-ds-danger px-3 py-1 text-xs gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('revisionRequired', 'Revision Required')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          {/* Instructions */}
          {instructions && (
            <div className="bg-ds-surface-subtle border border-ds-border/80 rounded-[8px] p-5 text-sm text-ds-ink-secondary whitespace-pre-wrap leading-relaxed">
              <h4 className="font-semibold text-ds-ink mb-2 flex items-center gap-2">
                <span>{t('instructionsAndPrompt', 'Assignment Prompt & Instructions')}</span>
              </h4>
              {(!translatedPrompt || showBilingual) && <div>{instructions}</div>}
              {translatedPrompt && translatedPrompt !== instructions && (
                <div
                  dir={translationDir}
                  className={cn(showBilingual && 'mt-3 border-t border-ds-border pt-3 text-ds-ink-secondary')}
                >
                  {showBilingual && (
                    <div className="text-[11px] uppercase tracking-[0.2em] text-ds-success mb-1">
                      {t('translated', 'Translated')}
                    </div>
                  )}
                  <div>{translatedPrompt}</div>
                </div>
              )}
            </div>
          )}

          {/* Rubric (if configured) */}
          {rubric && (
            <div className="bg-ds-warning-soft/60 border border-ds-warning/80 rounded-[8px] p-4 text-xs text-ds-warning leading-relaxed">
              <span className="font-semibold">{t('evaluationRubric', 'Evaluation Rubric')}: </span>
              {rubric}
            </div>
          )}

          {/* Instructor Feedback Callout */}
          {submission?.instructor_feedback && (
            <div className={cn(
              "rounded-[8px] p-4 border text-sm leading-relaxed",
              isApproved
                ? "bg-ds-success-soft border-ds-success/30 text-ds-success"
                : "bg-ds-danger-soft border-ds-danger/30 text-ds-danger"
            )}>
              <div className="flex items-center justify-between font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  {isApproved ? <CheckCircle2 className="h-4 w-4 text-ds-success" /> : <AlertCircle className="h-4 w-4 text-ds-danger" />}
                  {t('instructorFeedback', 'Instructor Feedback')}
                </span>
                {submission.reviewed_at && (
                  <span className="text-xs opacity-75">
                    {new Date(submission.reviewed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{submission.instructor_feedback}</p>
            </div>
          )}

          {/* Submission Form / View */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-ds-ink">
                {t('yourSubmission', 'Your Response & Work')}
              </label>
              {submission?.attempt_number && submission.attempt_number > 1 && (
                <span className="text-xs text-muted-foreground font-mono">
                  {t('attemptNumber', { count: submission.attempt_number, defaultValue: `Attempt #${submission.attempt_number}` })}
                </span>
              )}
            </div>

            {canEdit ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('assignmentPlaceholder', 'Type your analysis, answers, or practical submission details here...')}
                className="min-h-[160px] resize-y font-normal"
                disabled={isSubmitting}
              />
            ) : (
              <div className="bg-ds-surface-subtle border border-ds-border rounded-[8px] p-4 text-sm text-ds-ink whitespace-pre-wrap">
                {content || <span className="italic text-muted-foreground">{t('noTextProvided', 'No written text provided (attachment only).')}</span>}
              </div>
            )}

            {/* Attachments Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">
                  {t('attachments', 'Attached Files')} ({attachments.length})
                </span>
                {canEdit && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading || isSubmitting}
                    />
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ds-brass hover:text-ds-brass px-2.5 py-1 rounded-md border border-ds-brass/30 hover:bg-ds-brass/10 transition-colors">
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" />
                      )}
                      {t('uploadFile', 'Add Document / Media')}
                    </span>
                  </label>
                )}
              </div>

              {/* Uploaded File List */}
              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attachments.map((file, idx) => (
                    <div
                      key={file.url || idx}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-ds-border bg-ds-surface-subtle text-xs text-ds-ink-secondary"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 truncate hover:text-ds-ink hover:underline flex-1"
                      >
                        <Paperclip className="h-4 w-4 text-ds-muted shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                      </a>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="h-7 w-7 p-0 text-ds-muted hover:text-ds-danger hover:bg-ds-danger-soft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-ds-border rounded-lg p-6 text-center text-xs text-ds-muted">
                  {t('noAttachmentsYet', 'No files attached yet.')}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-ds-border">
              {canEdit ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting || isUploading}
                    className="text-xs"
                  >
                    {t('saveDraft', 'Save Draft')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting || isUploading}
                    className="bg-ds-ink hover:bg-ds-ink-secondary text-ds-on-ink text-xs gap-1.5 shadow-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {t('submitForReview', 'Submit Assignment')}
                  </Button>
                </>
              ) : isRevisionRequired && !isEditingResubmit ? (
                <Button
                  size="sm"
                  onClick={() => setIsEditingResubmit(true)}
                  className="bg-ds-danger hover:bg-ds-danger text-white text-xs gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('resubmitAssignment', 'Revise & Resubmit')}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
