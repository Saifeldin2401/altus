import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Loader2,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AuthorTopBarProps {
  onBack: () => void
  isEditing: boolean
  title: string
  sopCode: string
  status?: string
  isMasterTemplate: boolean
  isSaving: boolean
  isAutoSaving?: boolean
  lastSavedAt?: string | null
  readinessScore: number
  onOpenReadinessDrawer: () => void
  editLang: 'en' | 'ar'
  onToggleEditLang: (lang: 'en' | 'ar') => void
  hasArContent: boolean
  onOpenAiStudio: () => void
  onSaveDraft: () => void
  onSubmitPublish: () => void
  canPublish: boolean
}

export function AuthorTopBar({
  onBack,
  isEditing,
  title,
  sopCode,
  status = 'draft',
  isMasterTemplate,
  isSaving,
  isAutoSaving = false,
  lastSavedAt,
  readinessScore,
  onOpenReadinessDrawer,
  editLang,
  onToggleEditLang,
  hasArContent,
  onOpenAiStudio,
  onSaveDraft,
  onSubmitPublish,
  canPublish,
}: AuthorTopBarProps) {
  const { t } = useTranslation(['knowledge', 'common'])

  const getScoreBadgeClass = (score: number) => {
    if (score >= 85) return 'border-ds-success/40 bg-ds-success/10 text-ds-success'
    if (score >= 60) return 'border-ds-warning/40 bg-ds-warning/10 text-ds-warning'
    return 'border-ds-danger/40 bg-ds-danger/10 text-ds-danger'
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/80 shadow-xs">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 py-2.5 max-w-7xl mx-auto">
        
        {/* Left: Navigation & Document Identity */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            title={isMasterTemplate ? t('editor.back_to_master', 'Return to Master Library') : t('editor.back_to_knowledge', 'Return to Knowledge Library')}
          >
            <ArrowLeft className="w-4 h-4 me-1" />
            <span className="hidden sm:inline">
              {isMasterTemplate ? t('editor.back_to_master', 'Master Library') : t('common.back', 'Back')}
            </span>
          </Button>

          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

          {/* Explicit Mode Indicator */}
          {isMasterTemplate ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ds-warning/20 border border-ds-warning/40 text-ds-warning text-xs font-bold uppercase tracking-wider shrink-0 shadow-xs">
              <Crown className="w-3.5 h-3.5 text-ds-warning fill-ds-warning/30" />
              <span>{t('editor.master_studio', 'Master Studio')}</span>
            </div>
          ) : (
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground shrink-0 hidden sm:inline-flex bg-muted/40">
              {t('editor.property_studio', 'Hotel Studio')}
            </Badge>
          )}

          <div className="flex items-center gap-2 truncate">
            {sopCode ? (
              <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0 shrink-0 bg-muted/60">
                {sopCode}
              </Badge>
            ) : null}

            <span className="font-semibold text-xs sm:text-sm truncate text-foreground" title={title}>
              {title.trim() || t('editor.untitled_document', 'Untitled SOP Document')}
            </span>

            <Badge
              variant="outline"
              className="text-[11px] capitalize px-1.5 py-0 shrink-0 hidden md:inline-flex bg-muted/30"
            >
              {status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Center: Save & Readiness Health Feedback */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          
          {/* Cloud save status */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isAutoSaving ? (
              <span className="flex items-center gap-1 text-primary animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Auto-saving...
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1 text-ds-success">
                <CheckCircle2 className="w-3 h-3" />
                Saved {lastSavedAt}
              </span>
            ) : (
              <span className="text-muted-foreground">Auto-save protected</span>
            )}
          </div>

          {/* Interactive Readiness Score Pill */}
          <button
            type="button"
            onClick={onOpenReadinessDrawer}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all hover:scale-102 hover:shadow-xs active:scale-98 ${getScoreBadgeClass(
              readinessScore
            )}`}
            title="Click to view Article Quality & Readiness Checklist"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Readiness: {readinessScore}%</span>
          </button>

          {/* Bilingual Switcher */}
          <div className="flex items-center p-0.5 rounded-lg border bg-muted/40 text-xs">
            <button
              type="button"
              onClick={() => onToggleEditLang('en')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                editLang === 'en'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onToggleEditLang('ar')}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                editLang === 'ar'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>AR</span>
              {hasArContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-ds-success" title="Arabic translation present" />
              )}
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAiStudio}
            className="h-8 text-xs font-semibold gap-1.5 text-ds-accent border-ds-accent/30 hover:bg-ds-accent-soft"
          >
            <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
            <span className="hidden md:inline">AI Studio</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="h-8 text-xs font-medium gap-1.5"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>
              {isMasterTemplate ? t('editor.save_master_draft', 'Save Master Draft') : t('editor.save_draft', 'Save Draft')}
            </span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onSubmitPublish}
            disabled={isSaving || !canPublish}
            className="h-8 text-xs font-semibold gap-1.5 bg-ds-accent hover:bg-ds-accent/90 text-ds-ink"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {isMasterTemplate
                ? (isEditing ? t('editor.update_master', 'Update Master Standard') : t('editor.publish_master', 'Publish Master Standard'))
                : (isEditing ? t('editor.update_publish', 'Update & Publish') : t('editor.submit_review', 'Publish / Review'))}
            </span>
          </Button>
        </div>

      </div>
    </header>
  )
}

export default AuthorTopBar
