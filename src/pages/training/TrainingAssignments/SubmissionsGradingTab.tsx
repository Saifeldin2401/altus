import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import {
  assignmentSubmissionService,
  type SubmissionStatus,
  type TrainingAssignmentSubmission
} from '@/services/assignmentSubmissionService'
import {
  aiService,
  type AssignmentEvaluationResult
} from '@/lib/gemini'
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  Lightbulb,
  Loader2,
  Paperclip,
  RotateCcw,
  Search,
  Sparkles,
  Wand2
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function SubmissionsGradingTab() {
  const { t, i18n } = useTranslation('training')
  const { toast } = useToast()

  const [submissions, setSubmissions] = useState<TrainingAssignmentSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all')
  const [selectedSubmission, setSelectedSubmission] = useState<TrainingAssignmentSubmission | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)

  // Grading form state
  const [score, setScore] = useState<number>(100)
  const [feedback, setFeedback] = useState<string>('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  // AI Evaluation state
  const [isEvaluatingAI, setIsEvaluatingAI] = useState(false)
  const [aiResult, setAiResult] = useState<AssignmentEvaluationResult | null>(null)
  const [blockDetails, setBlockDetails] = useState<{
    title?: string
    instructions?: string
    rubric?: string
    passingScore?: number
  } | null>(null)

  useEffect(() => {
    loadSubmissions()
  }, [statusFilter])

  const loadSubmissions = async () => {
    setIsLoading(true)
    try {
      const { submissions: data } = await assignmentSubmissionService.getSubmissionsForGrading({
        status: statusFilter
      })
      setSubmissions(data)
    } catch (err) {
      console.error('Failed to load submissions for grading:', err)
      toast({
        title: t('loadFailed', 'Failed to load submissions'),
        description: 'Could not retrieve practical assignments for review.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const openReviewModal = (sub: TrainingAssignmentSubmission) => {
    setSelectedSubmission(sub)
    setScore(sub.score !== null && sub.score !== undefined ? sub.score : 100)
    setFeedback(sub.instructor_feedback || '')
    setAiResult(null)
    setBlockDetails(null)
    setReviewDialogOpen(true)

    // Asynchronously retrieve assignment block configuration & rubric
    assignmentSubmissionService
      .getAssignmentBlockDetails(sub.training_module_id, sub.block_id)
      .then((details) => {
        setBlockDetails(details)
      })
  }

  const handleRunAIEvaluation = async () => {
    if (!selectedSubmission) return

    setIsEvaluatingAI(true)
    try {
      const result = await aiService.evaluatePracticalAssignment({
        moduleTitle: selectedSubmission.module?.title || 'Hotel Training Module',
        blockTitle: blockDetails?.title,
        assignmentInstructions: blockDetails?.instructions,
        rubric: blockDetails?.rubric,
        passingScore: blockDetails?.passingScore ?? 80,
        submissionContent: selectedSubmission.submission_content || '',
        attachmentNames: selectedSubmission.attachment_urls?.map((a) => a.name) || [],
        language: i18n.language.startsWith('ar') ? 'Arabic' : 'English'
      })

      setAiResult(result)
      toast({
        title: t('aiEvaluationReady', 'AI Evaluation Ready'),
        description: t('aiEvaluationReadyDesc', 'OpenRouter AI evaluated the submission based on hotel quality standards.')
      })
    } catch (err: any) {
      console.error('AI evaluation error:', err)
      toast({
        title: t('aiEvaluationFailed', 'AI Evaluation Failed'),
        description: err.message || 'Could not complete automated assessment.',
        variant: 'destructive'
      })
    } finally {
      setIsEvaluatingAI(false)
    }
  }

  const handleApplyAIAssessment = () => {
    if (!aiResult) return
    setScore(aiResult.score)
    const localizedFeedback =
      i18n.language.startsWith('ar') && aiResult.arabicFeedback
        ? aiResult.arabicFeedback
        : aiResult.feedback
    setFeedback(localizedFeedback)
    toast({
      title: t('aiAssessmentApplied', 'AI Assessment Applied!'),
      description: t('aiAssessmentAppliedDesc', 'Score and feedback have been populated. You can review and adjust before saving.')
    })
  }

  const handleSaveReview = async (action: 'approved' | 'revision_required') => {
    if (!selectedSubmission) return

    setIsSubmittingReview(true)
    try {
      await assignmentSubmissionService.reviewSubmission({
        submissionId: selectedSubmission.id,
        status: action,
        score: action === 'approved' ? score : (score < 100 ? score : 0),
        passed: action === 'approved',
        feedback
      })

      toast({
        title: action === 'approved' ? t('submissionApproved', 'Submission Approved!') : t('revisionRequested', 'Revision Requested'),
        description: action === 'approved'
          ? t('learnerProgressUnlocked', 'Grade recorded and learner module progress unlocked.')
          : t('learnerNotifiedRevision', 'Feedback sent to learner to submit a revised assignment.')
      })

      setReviewDialogOpen(false)
      loadSubmissions()
    } catch (err: any) {
      console.error('Failed to save review:', err)
      toast({
        title: t('reviewFailed', 'Failed to save review'),
        description: err.message || 'Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const learnerName = s.learner?.full_name?.toLowerCase() || ''
    const learnerEmail = s.learner?.email?.toLowerCase() || ''
    const moduleTitle = s.module?.title?.toLowerCase() || ''
    return learnerName.includes(q) || learnerEmail.includes(q) || moduleTitle.includes(q)
  })

  const pendingCount = submissions.filter(s => s.status === 'submitted' || s.status === 'under_review').length
  const approvedCount = submissions.filter(s => s.status === 'approved').length
  const revisionCount = submissions.filter(s => s.status === 'revision_required' || s.status === 'rejected').length

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ds-muted uppercase tracking-wider">{t('totalSubmissions', 'Total Submissions')}</p>
            <p className="font-mono text-2xl font-bold text-ds-ink mt-1">{submissions.length}</p>
          </div>
          <div className="h-10 w-10 rounded-[6px] border border-ds-border bg-ds-surface-subtle flex items-center justify-center text-ds-muted">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ds-warning uppercase tracking-wider">{t('pendingReview', 'Pending Review')}</p>
            <p className="font-mono text-2xl font-bold text-ds-warning mt-1">{pendingCount}</p>
          </div>
          <div className="h-10 w-10 rounded-[6px] border border-ds-warning/30 bg-ds-warning-soft flex items-center justify-center text-ds-warning">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ds-success uppercase tracking-wider">{t('approved', 'Approved')}</p>
            <p className="font-mono text-2xl font-bold text-ds-success mt-1">{approvedCount}</p>
          </div>
          <div className="h-10 w-10 rounded-[6px] border border-ds-success/30 bg-ds-success-soft flex items-center justify-center text-ds-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ds-danger uppercase tracking-wider">{t('revisionRequired', 'Revision Required')}</p>
            <p className="font-mono text-2xl font-bold text-ds-danger mt-1">{revisionCount}</p>
          </div>
          <div className="h-10 w-10 rounded-[6px] border border-ds-danger/30 bg-ds-danger-soft flex items-center justify-center text-ds-danger">
            <RotateCcw className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-ds-surface p-3.5 rounded-[8px] border border-ds-border shadow-none">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-ds-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchLearnerOrModule', 'Search by associate or module...')}
            className="ps-9 h-9 text-xs bg-ds-surface-subtle border-ds-border text-ds-ink placeholder:text-ds-muted focus:border-ds-border-strong"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-ds-muted" />
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as SubmissionStatus | 'all')}
          >
            <SelectTrigger className="h-9 w-full sm:w-48 text-xs bg-ds-surface-subtle border-ds-border text-ds-ink">
              <SelectValue placeholder={t('filterByStatus', 'Filter by status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses', 'All Submissions')}</SelectItem>
              <SelectItem value="submitted">{t('underReview', 'Pending Review')}</SelectItem>
              <SelectItem value="approved">{t('approved', 'Approved')}</SelectItem>
              <SelectItem value="revision_required">{t('revisionRequired', 'Revision Required')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Submissions Table */}
      <Card className="border-ds-border bg-ds-surface rounded-[8px] overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-ds-surface-subtle border-b border-ds-border text-xs uppercase tracking-wider font-semibold text-ds-muted">
              <tr>
                <th className="px-4 py-3">{t('learner', 'Learner')}</th>
                <th className="px-4 py-3">{t('trainingModule', 'Module & Item')}</th>
                <th className="px-4 py-3">{t('submittedDate', 'Submitted')}</th>
                <th className="px-4 py-3">{t('status', 'Status')}</th>
                <th className="px-4 py-3">{t('score', 'Score')}</th>
                <th className="px-4 py-3 text-end">{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ds-muted">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-ds-accent" />
                    <p className="text-xs">{t('loadingSubmissions', 'Loading assignment submissions...')}</p>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ds-muted">
                    <FileCheck className="h-8 w-8 mx-auto mb-2 text-ds-muted opacity-40" />
                    <p className="font-medium text-ds-ink">{t('noSubmissionsFound', 'No assignment submissions found.')}</p>
                    <p className="text-xs text-ds-muted mt-1">{t('submissionsAppearHint', 'Learner practical submissions will appear here for grading.')}</p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-ds-surface-subtle/80 transition-colors text-ds-ink">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ds-ink">{sub.learner?.full_name || sub.learner?.email || 'Unknown Learner'}</div>
                      <div className="text-xs text-ds-muted">{sub.learner?.job_title || sub.learner?.email || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ds-ink">{sub.module?.title || 'Training Module'}</div>
                      <div className="text-xs text-ds-muted">
                        {sub.attempt_number > 1 ? `Attempt #${sub.attempt_number}` : 'First Attempt'}
                        {sub.attachment_urls?.length > 0 && ` • ${sub.attachment_urls.length} file(s)`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ds-muted">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {sub.status === 'approved' && (
                        <Badge className="bg-ds-success-soft text-ds-success border border-ds-success/30 font-medium text-xs gap-1 shadow-none">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('approved', 'Approved')}
                        </Badge>
                      )}
                      {(sub.status === 'submitted' || sub.status === 'under_review') && (
                        <Badge className="bg-ds-warning-soft text-ds-warning border border-ds-warning/30 font-medium text-xs gap-1 shadow-none">
                          <Clock className="h-3 w-3" />
                          {t('underReview', 'Under Review')}
                        </Badge>
                      )}
                      {(sub.status === 'revision_required' || sub.status === 'rejected') && (
                        <Badge className="bg-ds-danger-soft text-ds-danger border border-ds-danger/30 font-medium text-xs gap-1 shadow-none">
                          <RotateCcw className="h-3 w-3" />
                          {t('revisionRequired', 'Revision Required')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-xs text-ds-ink">
                      {sub.score !== null && sub.score !== undefined ? `${sub.score}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        size="sm"
                        onClick={() => openReviewModal(sub)}
                        className="h-8 text-xs bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 gap-1.5 shadow-none rounded-md"
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        {sub.status === 'approved' ? t('editGrade', 'Review / Edit') : t('gradeSubmission', 'Review & Grade')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review & Grading Modal */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-ds-surface border border-ds-border text-ds-ink">
          <DialogHeader>
            <div className="flex items-center justify-between pe-6">
              <DialogTitle className="text-base font-bold text-ds-ink flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-ds-accent" />
                {t('gradePracticalAssignment', 'Evaluate Practical Assignment')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-ds-muted">
              {selectedSubmission?.learner?.full_name || 'Learner'} — {selectedSubmission?.module?.title}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-5 py-2">
              {/* AI Evaluator Co-Pilot Card */}
              <div className="rounded-[8px] border border-ds-accent/30 bg-ds-accent-soft/20 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ds-accent/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-[6px] bg-ds-accent flex items-center justify-center text-ds-ink-contrast shadow-none">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-ds-ink flex items-center gap-1.5">
                        {t('aiGradingCoPilot', 'AI Evaluation Co-Pilot')}
                        <Badge variant="outline" className="text-[11px] font-medium py-0 px-1.5 text-ds-accent border-ds-accent/30 bg-ds-accent-soft">
                          OpenRouter AI
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-ds-muted">
                        {t('aiGradingHint', 'Automated rubric comparison & feedback generator for hotel instructors.')}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRunAIEvaluation}
                    disabled={isEvaluatingAI}
                    className="h-8 text-xs bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 gap-1.5 shadow-none shrink-0 rounded-md font-semibold"
                  >
                    {isEvaluatingAI ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t('evaluatingAI', 'Analyzing Submission...')}</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        <span>{aiResult ? t('reEvaluateAI', 'Re-Evaluate with AI') : t('autoEvaluateAI', 'Auto-Evaluate with AI')}</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* AI Results Presentation */}
                {aiResult ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-[6px] bg-ds-surface border border-ds-border">
                      <div className="flex items-center gap-3">
                        <div className="text-center px-2.5 py-1 bg-ds-surface-subtle rounded-md border border-ds-border">
                          <span className="block text-[11px] text-ds-muted uppercase font-semibold">{t('suggestedScore', 'Suggested Score')}</span>
                          <span className="font-mono font-bold text-base text-ds-accent">{aiResult.score}%</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-ds-muted uppercase font-semibold">{t('recommendation', 'AI Recommendation')}</span>
                          {aiResult.decision === 'approved' ? (
                            <Badge className="bg-ds-success-soft text-ds-success border border-ds-success/30 font-medium text-[11px] gap-1 mt-0.5 shadow-none">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('approveAndPass', 'Approve & Pass')}
                            </Badge>
                          ) : (
                            <Badge className="bg-ds-danger-soft text-ds-danger border border-ds-danger/30 font-medium text-[11px] gap-1 mt-0.5 shadow-none">
                              <RotateCcw className="h-3 w-3" />
                              {t('requestRevision', 'Request Revision')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyAIAssessment}
                        className="h-8 text-xs bg-ds-accent text-ds-ink-contrast hover:bg-ds-accent/90 font-semibold gap-1.5 shadow-none rounded-md"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t('applyAIAssessment', 'Apply AI Score & Notes')}
                      </Button>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {aiResult.strengths?.length > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-ds-success-soft/60 border border-ds-success/30">
                          <p className="font-semibold text-ds-success flex items-center gap-1 mb-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-ds-success shrink-0" />
                            {t('keyStrengths', 'Key Strengths')}
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-ds-ink ps-1">
                            {aiResult.strengths.map((st, i) => (
                              <li key={i}>{st}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiResult.improvements?.length > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-ds-warning-soft/60 border border-ds-warning/30">
                          <p className="font-semibold text-ds-warning flex items-center gap-1 mb-1">
                            <Lightbulb className="h-3.5 w-3.5 text-ds-warning shrink-0" />
                            {t('areasForImprovement', 'Suggestions for Improvement')}
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-ds-ink ps-1">
                            {aiResult.improvements.map((im, i) => (
                              <li key={i}>{im}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : isEvaluatingAI ? (
                  <div className="py-4 text-center text-xs text-ds-accent flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-ds-accent" />
                    <p className="font-medium">{t('aiAnalyzingRubric', 'Comparing submission with 5-star hotel operational standards...')}</p>
                  </div>
                ) : null}
              </div>

              {/* Learner's Submitted Text */}
              <div>
                <Label className="text-xs font-semibold text-ds-muted uppercase tracking-wider">
                  {t('learnerWrittenWork', "Learner's Response")}
                </Label>
                <div className="mt-1.5 p-3.5 rounded-[6px] border border-ds-border bg-ds-surface-subtle text-xs text-ds-ink whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {selectedSubmission.submission_content || <span className="italic text-ds-muted">{t('noWrittenResponse', 'No written text provided.')}</span>}
                </div>
              </div>

              {/* Attachments */}
              {selectedSubmission.attachment_urls?.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-ds-muted uppercase tracking-wider">
                    {t('submittedFiles', 'Submitted Documents & Media')} ({selectedSubmission.attachment_urls.length})
                  </Label>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedSubmission.attachment_urls.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-[6px] border border-ds-border hover:border-ds-border-strong bg-ds-surface hover:bg-ds-surface-subtle transition-colors text-xs text-ds-ink font-medium"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip className="h-4 w-4 text-ds-accent shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <Download className="h-3.5 w-3.5 text-ds-muted shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Score Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-ds-border">
                <div>
                  <Label className="text-xs font-semibold text-ds-ink">{t('scorePercentage', 'Score Percentage (0 - 100%)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="mt-1 h-9 text-xs bg-ds-surface-subtle border-ds-border text-ds-ink"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <p className="text-[11px] text-ds-muted leading-tight">
                    {score >= 80 ? '✓ Meets 5-Star Hotel Passing Benchmark (≥80%)' : '⚠ Below standard passing threshold (<80%)'}
                  </p>
                </div>
              </div>

              {/* Instructor Feedback */}
              <div>
                <Label className="text-xs font-semibold text-ds-ink">{t('instructorFeedbackForLearner', 'Instructor Feedback & Notes for Associate')}</Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t('feedbackPlaceholder', 'Explain what was done well, or specific corrections needed if requesting revision...')}
                  className="mt-1.5 min-h-[90px] text-xs bg-ds-surface-subtle border-ds-border text-ds-ink placeholder:text-ds-muted"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ds-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReviewDialogOpen(false)}
              className="text-xs border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
            >
              {t('cancel', 'Cancel')}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveReview('revision_required')}
                disabled={isSubmittingReview}
                className="text-xs text-ds-danger border-ds-danger/30 hover:bg-ds-danger-soft gap-1 rounded-md"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('requestRevision', 'Request Revision')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveReview('approved')}
                disabled={isSubmittingReview}
                className="text-xs bg-ds-success text-white dark:text-ds-on-ink hover:bg-ds-success/90 gap-1 shadow-none rounded-md"
              >
                {isSubmittingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t('approveAndPass', 'Approve & Pass')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
