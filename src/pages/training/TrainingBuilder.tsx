import { SmartAICourseCreatorModal } from '@/components/training'
import { BuilderCanvas } from '@/components/training/builder/BuilderCanvas'
import { BuilderHeader } from '@/components/training/builder/BuilderHeader'
import { BuilderPreview } from '@/components/training/builder/BuilderPreview'
import { BuilderSidebar } from '@/components/training/builder/BuilderSidebar'
import { CourseSourceDocuments } from '@/components/training/CourseSourceDocuments'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { aiService } from '@/lib/gemini'
import {
  generateAndLinkCheckpointQuestions,
  createCheckpointQuiz,
  deleteQuiz
} from '@/services/checkpointQuizGenerator'
import { CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AIQuizDialog } from './components/builder/AIQuizDialog'
import { AITrainingAuditModal } from './components/builder/AITrainingAuditModal'
import { ContentBlockSlideOver } from './components/builder/ContentBlockSlideOver'
import { KBSidebarPanel } from './components/builder/KBSidebarPanel'
import { RightPanel } from './components/builder/RightPanel'
import { StepPublish } from './components/builder/StepPublish'
import { StepRules } from './components/builder/StepRules'
import { StepSetup } from './components/builder/StepSetup'
import { StepStructure } from './components/builder/StepStructure'
import { TemplateApplyConfirmDialog, TemplatePreviewDialog } from './components/builder/TemplateDialogs'
import { TrainingBuilderProvider, useTrainingBuilderContext } from './contexts/TrainingBuilderContext'
import { useBuilderKeyboardShortcuts } from './hooks/useBuilderKeyboardShortcuts'

// ---------------------------------------------------------------------------
// Inner component – pure layout, all state/logic comes from context
// ---------------------------------------------------------------------------

function TrainingBuilderInner() {
  const { t } = useTranslation('training')
  const { toast } = useToast()
  const { profile } = useAuth()
  const ctx = useTrainingBuilderContext()

  // Register ergonomic productivity keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Shift+P, Ctrl+Shift+A)
  useBuilderKeyboardShortcuts({
    onSave: ctx.handleSave,
    onPreview: () => ctx.handleStepChange('preview'),
    onMagic: () => ctx.setShowSmartWizard(true),
    onUndo: ctx.handleUndo,
    onRedo: ctx.handleRedo,
    canUndo: ctx.historyIndex > 0,
    canRedo: ctx.historyIndex < ctx.historyRef.current.length - 1,
    isSaving: ctx.builderBusy,
  })

  const handleDeepExpandLesson = async (sectionId: string, contentId: string) => {
    const sec = ctx.sections.find((s) => s.id === sectionId)
    const block = sec?.items.find((i) => i.id === contentId)
    if (!sec || !block) return

    try {
      const expandedHtml = await aiService.expandLessonContent({
        courseTitle: ctx.title,
        sectionHeading: block.title || sec.title,
        sectionSummary: (block.content_data as any)?.summary || sec.description,
        department: ctx.category || 'Hotel Operations',
        language: ctx.isRTL ? 'Arabic' : 'English',
      })

      ctx.setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s
          return {
            ...s,
            items: s.items.map((i) => (i.id === contentId ? { ...i, content: expandedHtml } : i)),
          }
        })
      )
      toast({
        title: t('builder.editor.lesson.expanded', 'Lesson expanded'),
        description: t('builder.editor.lesson.expandedDesc', {
          name: block.title || sec.title,
          defaultValue: 'AI rewrote “{{name}}” as a full procedure. Review it before publishing.',
        }),
      })
    } catch (e) {
      console.error('Failed to deep expand lesson:', e)
      toast({
        title: t('builder.editor.lesson.expandFailed', 'Could not expand this lesson. Try again in a moment.'),
        variant: 'destructive',
      })
    }
  }

  if (!ctx.hasMounted && ctx.isNewRoute) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const renderStepContent = () => {
    const { builderStep } = ctx

    if (builderStep === 'setup') {
      return (
        <StepSetup
          title={ctx.title} setTitle={ctx.setTitle}
          description={ctx.description} setDescription={ctx.setDescription}
          audience={ctx.audience} setAudience={ctx.setAudience}
          category={ctx.category} setCategory={ctx.setCategory}
          difficultyLevel={ctx.difficultyLevel} setDifficultyLevel={ctx.setDifficultyLevel}
          contentLanguage={ctx.contentLanguage} setContentLanguage={ctx.setContentLanguage}
          estimatedDuration={ctx.estimatedDuration} setEstimatedDuration={ctx.setEstimatedDuration}
          useEstimatedDuration={ctx.useEstimatedDuration} setUseEstimatedDuration={ctx.setUseEstimatedDuration}
          calculatedDuration={ctx.calculatedDuration}
          validityPeriod={ctx.validityPeriod} setValidityPeriod={ctx.setValidityPeriod}
          templatePreset={ctx.templatePreset} handleTemplateSelection={ctx.handleTemplateSelection}
          selectedTemplate={ctx.selectedTemplate} templateStats={ctx.templateStats}
          isTemplatesLoading={ctx.isTemplatesLoading} isTemplatesError={ctx.isTemplatesError}
          templateOptions={ctx.templateOptions} setShowTemplatePreview={ctx.setShowTemplatePreview}
          validationChecklist={ctx.validationChecklist} isRTL={ctx.isRTL}
        />
      )
    }

    if (builderStep === 'structure') {
      return (
        <StepStructure
          sections={ctx.sections} addSection={ctx.addSection} deleteSection={ctx.deleteSection}
          handleRenameSection={ctx.handleRenameSection} moveSection={ctx.moveSection}
          title={ctx.title} setTitle={ctx.setTitle} description={ctx.description} setDescription={ctx.setDescription}
          setSections={ctx.setSections} setActiveSection={ctx.setActiveSection} isRTL={ctx.isRTL}
        />
      )
    }

    if (builderStep === 'content') {
      return (
        <BuilderCanvas
          sections={ctx.sections} activeSection={ctx.activeSection}
          onSectionClick={(id) => ctx.setActiveSection(id)}
          onAddSection={ctx.addSection} onDeleteSection={ctx.deleteSection}
          onAddContent={(type, sectionId) => ctx.addContent(type, sectionId)}
          onEditContent={(sectionId, contentId) => {
            const block = ctx.contentBlocks.find(c => c.id === contentId)
            if (block) {
              ctx.openContentDialogForBlock({ ...block }, { selected: block, sectionId })
            } else {
              const item = ctx.sections.find(s => s.id === sectionId)?.items.find(i => i.id === contentId)
              if (item) ctx.openContentDialogForBlock(item, { selected: item, sectionId })
            }
          }}
          onDeleteContent={ctx.deleteContent}
          onReorderSection={ctx.handleReorderSection} onReorderContent={ctx.handleReorderContent}
          onGenerateQuizFromSection={ctx.openAIGeneratorForSection}
          onOpenAICreator={() => ctx.setShowSmartWizard(true)}
          onOpenTemplateSelector={() => ctx.setShowTemplatePreview(true)}
          onRenameSection={ctx.handleRenameSection}
          onDeepExpandLesson={handleDeepExpandLesson}
          title={ctx.title}
          setTitle={ctx.setTitle}
          description={ctx.description}
          setDescription={ctx.setDescription}
          category={ctx.category}
          setCategory={ctx.setCategory}
          audience={ctx.audience}
          setAudience={ctx.setAudience}
          difficultyLevel={ctx.difficultyLevel}
          setDifficultyLevel={ctx.setDifficultyLevel}
          contentLanguage={ctx.contentLanguage}
          setContentLanguage={ctx.setContentLanguage}
        />
      )
    }

    if (builderStep === 'rules') {
      return (
        <StepRules
          sections={ctx.sections}
          category={ctx.category} setCategory={ctx.setCategory}
          difficultyLevel={ctx.difficultyLevel} setDifficultyLevel={ctx.setDifficultyLevel}
          audience={ctx.audience} setAudience={ctx.setAudience}
          description={ctx.description} setDescription={ctx.setDescription}
          certificateEnabled={ctx.certificateEnabled} setCertificateEnabled={ctx.setCertificateEnabled}
          passingScore={ctx.passingScore} setPassingScore={ctx.setPassingScore}
          validityPeriod={ctx.validityPeriod} setValidityPeriod={ctx.setValidityPeriod}
          allowRetake={ctx.allowRetake} setAllowRetake={ctx.setAllowRetake}
          maxAttempts={ctx.maxAttempts} setMaxAttempts={ctx.setMaxAttempts}
          isRTL={ctx.isRTL}
        />
      )
    }

    if (builderStep === 'preview') {
      return (
        <div className="p-6">
          <BuilderPreview title={ctx.title} description={ctx.description} sections={ctx.sections} />
        </div>
      )
    }

    if (builderStep === 'publish') {
      return (
        <>
        <StepPublish
          category={ctx.category} setCategory={ctx.setCategory}
          sections={ctx.sections} totalItems={ctx.totalItems}
          displayDuration={ctx.displayDuration} overrideDuration={ctx.overrideDuration}
          calculatedDuration={ctx.calculatedDuration} certificateEnabled={ctx.certificateEnabled}
          passingScore={ctx.passingScore} allowRetake={ctx.allowRetake} maxAttempts={ctx.maxAttempts}
          validationChecklist={ctx.validationChecklist} publishReady={ctx.publishReady}
          builderBusy={ctx.builderBusy} handleSave={ctx.handleSave} publishTraining={ctx.publishTraining}
          auditResult={ctx.auditResult} onOpenAuditModal={() => ctx.setShowAuditModal(true)}
          isRTL={ctx.isRTL}
        />
        {ctx.moduleId && (
          <div className="px-6 pb-6">
            <CourseSourceDocuments trainingModuleId={ctx.moduleId} variant="admin" />
          </div>
        )}
        </>
      )
    }

    return null
  }

  return (
    <div className="h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col w-full max-w-full overflow-hidden bg-ds-surface-subtle text-ds-ink text-start">

      {/* Draft restore banner */}
      {ctx.showRestorePrompt && (
        <div className="shrink-0 border-b border-ds-info/30 bg-ds-info-soft px-3 py-2 text-ds-ink lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-ds-info" />
              <span className="text-xs font-medium text-ds-ink">
                {t('builder.draftRestoredBanner', 'We restored a draft from your last session on this device.')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => ctx.setShowRestorePrompt(false)}>{t('builder.keepDraft', 'Keep draft')}</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                ctx.clearDraft()
                // Only blank the form for a brand new, never-saved module -- for an
                // existing module this banner means "we recovered a newer local
                // draft", and blanking title/description/sections here would wipe
                // out already-published content that just hasn't been re-saved yet.
                if (ctx.isNewRoute) {
                  ctx.setTitle(''); ctx.setDescription(''); ctx.setSections([])
                }
                ctx.setShowRestorePrompt(false)
              }}>{t('builder.clearDraftBtn', 'Discard draft')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Compact Toolbar Header */}
      <BuilderHeader
        title={ctx.title}
        isSaving={ctx.builderBusy}
        hasUnsavedChanges={ctx.hasUnsavedChanges}
        isPersisted={!!ctx.moduleId}
        status={ctx.moduleStatus}
        onSave={ctx.handleSave}
        onPreview={() => ctx.handleStepChange('preview')}
        onMagic={() => ctx.setShowSmartWizard(true)}
        onTitleChange={ctx.setTitle}
        isMasterTemplate={ctx.isMasterTemplate}
        steps={ctx.steps}
        activeStep={ctx.builderStep}
        onStepChange={(step) => ctx.handleStepChange(step)}
        stepStatus={ctx.stepStatus}
        canAccessStep={ctx.canAccessStep}
        onUndo={ctx.handleUndo}
        onRedo={ctx.handleRedo}
        canUndo={ctx.historyIndex > 0}
        canRedo={ctx.historyIndex < ctx.historyRef.current.length - 1}
        autosaveStatus={ctx.autosaveStatus}
        lastAutosaveAt={ctx.lastAutosaveAt}
        formatTime={ctx.formatTime}
      />

      {/* Main ergonomic canvas layout */}
      <div className="flex flex-1 overflow-hidden w-full">
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col justify-between">
          <div className="flex-1">{renderStepContent()}</div>

          {/* Step navigation */}
          <footer className="sticky bottom-0 z-30 border-t border-ds-border bg-ds-surface px-3 py-2.5 md:px-6">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={ctx.goPrevStep}
                disabled={ctx.currentStepIndex <= 0}
                className="h-9"
              >
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                <span>{t('builder.editor.backStep', 'Back')}</span>
              </Button>

              <p className="hidden min-w-0 truncate text-center text-xs text-ds-muted sm:block">
                <span className="font-semibold text-ds-ink-secondary">
                  {t('builder.editor.stepOf', {
                    current: ctx.currentStepIndex + 1,
                    total: ctx.steps.length,
                    defaultValue: 'Step {{current}} of {{total}}',
                  })}
                </span>
                {ctx.steps[ctx.currentStepIndex]?.description && <> · {ctx.steps[ctx.currentStepIndex]?.description}</>}
              </p>

              {ctx.currentStepIndex < ctx.steps.length - 1 ? (
                <Button size="sm" onClick={ctx.goNextStep} className="h-9">
                  <span>
                    {t('builder.editor.next', {
                      step: ctx.steps[ctx.currentStepIndex + 1]?.label,
                      defaultValue: 'Next: {{step}}',
                    })}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={ctx.publishTraining}
                  disabled={!ctx.publishReady || ctx.builderBusy}
                  className="h-9"
                >
                  {ctx.builderBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{t('builder.editor.publish', 'Publish course')}</span>
                </Button>
              )}
            </div>
          </footer>
        </main>

        {/* Right sidebar */}
        <BuilderSidebar className="hidden lg:flex w-[280px] xl:w-[300px] shrink-0 border-s border-ds-border bg-ds-surface">
          <RightPanel
            builderStep={ctx.builderStep} sections={ctx.sections} totalItems={ctx.totalItems}
            totalPoints={ctx.totalPoints} displayDuration={ctx.displayDuration}
            overrideDuration={ctx.overrideDuration} calculatedDuration={ctx.calculatedDuration}
            certificateEnabled={ctx.certificateEnabled} passingScore={ctx.passingScore}
            allowRetake={ctx.allowRetake} maxAttempts={ctx.maxAttempts}
            validationChecklist={ctx.validationChecklist} moduleId={ctx.moduleId}
            openAIGeneratorForModule={ctx.openAIGeneratorForModule}
            setShowSmartWizard={ctx.setShowSmartWizard} isRTL={ctx.isRTL}
            activeSection={ctx.activeSection}
            setShowKBSidebar={ctx.setShowKBSidebar}
          />
        </BuilderSidebar>
      </div>

      {/* Slide-over Content Block Editor (Non-blocking Sheet) */}
      <ContentBlockSlideOver
        open={ctx.showContentDialog} onOpenChange={ctx.setShowContentDialog}
        currentBlock={ctx.currentBlock} setCurrentBlock={ctx.setCurrentBlock}
        selectedContent={ctx.selectedContent} showTitleField={ctx.showTitleField}
        setShowTitleField={ctx.setShowTitleField} showAdvancedBlockOptions={ctx.showAdvancedBlockOptions}
        setShowAdvancedBlockOptions={ctx.setShowAdvancedBlockOptions} mediaInputMode={ctx.mediaInputMode}
        setMediaInputMode={ctx.setMediaInputMode} blockValidation={ctx.blockValidation}
        recentUploadsForType={ctx.recentUploadsForType} availableQuizzes={ctx.availableQuizzes}
        quizOptions={ctx.quizOptions} availableSOPs={ctx.availableSOPs} sopOptions={ctx.sopOptions}
        uploading={ctx.uploading} handleFileUpload={ctx.handleFileUpload}
        showVideoMediaPicker={ctx.showVideoMediaPicker} setShowVideoMediaPicker={ctx.setShowVideoMediaPicker}
        showDocumentPicker={ctx.showDocumentPicker} setShowDocumentPicker={ctx.setShowDocumentPicker}
        handleSaveBlockToLibrary={ctx.handleSaveBlockToLibrary} saveContent={ctx.saveContent} isRTL={ctx.isRTL}
      />

      <TemplatePreviewDialog
        open={ctx.showTemplatePreview} onOpenChange={ctx.setShowTemplatePreview}
        selectedTemplate={ctx.selectedTemplate} templatePreset={ctx.templatePreset}
        templateStats={ctx.templateStats} requestApplyTemplate={ctx.requestApplyTemplate} isRTL={ctx.isRTL}
      />

      <TemplateApplyConfirmDialog
        open={ctx.showTemplateApplyConfirm} onOpenChange={ctx.setShowTemplateApplyConfirm}
        confirmApplyTemplate={ctx.confirmApplyTemplate} isRTL={ctx.isRTL}
      />

      <AIQuizDialog
        open={ctx.showAIDialog} onOpenChange={ctx.setShowAIDialog}
        aiPrefillTitle={ctx.aiPrefillTitle} aiPrefillContent={ctx.aiPrefillContent}
        aiTargetSectionId={ctx.aiTargetSectionId} setAiTargetSectionId={ctx.setAiTargetSectionId}
        setAiPrefillContent={ctx.setAiPrefillContent} setAiPrefillTitle={ctx.setAiPrefillTitle}
        moduleId={ctx.moduleId} title={ctx.title} passingScore={ctx.passingScore}
        activeSection={ctx.activeSection} sections={ctx.sections}
        setSections={ctx.setSections} setActiveSection={ctx.setActiveSection} isRTL={ctx.isRTL}
      />

      <SmartAICourseCreatorModal
        open={ctx.showSmartWizard}
        onOpenChange={ctx.setShowSmartWizard}
        initialTopic={ctx.title}
        onApplyToBuilder={async (generated) => {
          if (generated.title && !ctx.title) ctx.setTitle(generated.title)
          if (generated.description && !ctx.description) ctx.setDescription(generated.description)

          const checkpoints = generated.checkpoints || []
          const checkpointFailures: string[] = []

          const newSections = await Promise.all((generated.sections || []).map(async (sec: any, idx: number) => {
            const sectionItems: any[] = [
              {
                id: `block_${Date.now()}_${idx}_sop`,
                title: sec.heading,
                type: (sec.suggestedBlockType === 'scenario' ? 'text' : sec.suggestedBlockType) as any,
                content: sec.rich_content || `<h3>${sec.heading}</h3><p>${sec.summary}</p>`,
                content_url: '',
                content_data: { summary: sec.summary },
                is_mandatory: true,
                order: 0
              }
            ]

            // Check if there are any associated quiz checkpoints for this section.
            // `.filter()` (not `.find()`) because nothing enforces afterSectionIndex
            // uniqueness in the AI's suggested output -- two checkpoints targeting
            // the same section used to silently collapse to just the first one.
            const sectionCheckpoints = checkpoints.filter((c: any) => c.afterSectionIndex === (sec.originalIndex ?? idx) && c.include)
            for (let cpIdx = 0; cpIdx < sectionCheckpoints.length; cpIdx++) {
              const checkpoint = sectionCheckpoints[cpIdx]
              try {
                const createdQuiz = await createCheckpointQuiz({
                  title: `Checkpoint: ${checkpoint.topic || sec.heading}`,
                  description: `Verification quiz for ${sec.heading}`,
                  trainingModuleId: ctx.moduleId,
                  passingScorePercentage: Number(ctx.passingScore) || 80,
                  timeLimitMinutes: 10,
                  maxAttempts: 3,
                  createdBy: profile?.id
                })

                if (createdQuiz) {
                  const linkedQuestionCount = await generateAndLinkCheckpointQuestions({
                    quizId: createdQuiz.id,
                    sectionContent: `${sec.heading}\n${sec.summary}\n${sec.rich_content || ''}`,
                    difficulty: generated.difficulty ?? 'intermediate',
                    // Checkpoint quizzes are single-language; bilingual courses get English questions.
                    language: generated.language === 'Arabic' ? 'Arabic' : 'English',
                    trainingModuleId: ctx.moduleId,
                    createdBy: profile?.id
                  })

                  if (linkedQuestionCount > 0) {
                    sectionItems.push({
                      id: `block_${Date.now()}_${idx}_quiz_${cpIdx}`,
                      title: `Checkpoint Quiz: ${checkpoint.topic || sec.heading}`,
                      type: 'quiz' as any,
                      content: '',
                      content_url: '',
                      content_data: {
                        quiz_id: createdQuiz.id,
                        is_checkpoint: true,
                        passing_score: 80,
                        topic: checkpoint.topic
                      },
                      is_mandatory: true,
                      order: sectionItems.length
                    })
                  } else {
                    await deleteQuiz(createdQuiz.id)
                    checkpointFailures.push(checkpoint.topic || sec.heading)
                  }
                }
              } catch (qErr) {
                console.warn('Could not generate quiz checkpoint for section:', qErr)
                checkpointFailures.push(checkpoint.topic || sec.heading)
              }
            }

            return {
              id: `section_${Date.now()}_${idx}`,
              title: sec.heading,
              description: sec.summary,
              order: idx,
              items: sectionItems
            }
          }))

          if (ctx.sections.length === 0 || (ctx.sections.length === 1 && ctx.sections[0].items.length === 0)) {
            ctx.setSections(newSections)
          } else {
            ctx.setSections([...ctx.sections, ...newSections])
          }

          if (newSections.length > 0) {
            ctx.setActiveSection(newSections[0].id)
          }

          if (checkpointFailures.length > 0) {
            toast({
              title: t('builder.checkpointGenerationIncomplete', 'Some checkpoint quizzes were skipped'),
              description: t(
                'builder.checkpointGenerationIncompleteDesc',
                `Could not generate a usable quiz for: ${checkpointFailures.join(', ')}. Add one manually before publishing.`
              ),
              variant: 'destructive'
            })
          }
        }}
      />

      <AITrainingAuditModal
        open={ctx.showAuditModal}
        onOpenChange={ctx.setShowAuditModal}
        auditResult={ctx.auditResult}
        title={ctx.title}
        setTitle={ctx.setTitle}
        description={ctx.description}
        setDescription={ctx.setDescription}
        category={ctx.category}
        difficultyLevel={ctx.difficultyLevel}
        audience={ctx.audience}
        sections={ctx.sections}
        setSections={ctx.setSections}
        isRTL={ctx.isRTL}
      />

      {ctx.showKBSidebar && (
        <KBSidebarPanel
          moduleId={ctx.moduleId} title={ctx.title} activeSection={ctx.activeSection}
          sections={ctx.sections} setSections={ctx.setSections}
          contentBlocks={ctx.contentBlocks} setContentBlocks={ctx.setContentBlocks}
          availableSOPs={ctx.availableSOPs} availableQuizzes={ctx.availableQuizzes}
          onClose={() => ctx.setShowKBSidebar(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export – wraps inner component with context provider
// ---------------------------------------------------------------------------

export function TrainingBuilder() {
  return (
    <TrainingBuilderProvider>
      <TrainingBuilderInner />
    </TrainingBuilderProvider>
  )
}

export default TrainingBuilder
