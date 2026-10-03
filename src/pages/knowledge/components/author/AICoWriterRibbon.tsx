import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckSquare, HelpCircle, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AICoWriterRibbonProps {
  aiLanguage: string
  onAiLanguageChange: (lang: string) => void
  isGenerating: boolean
  hasContent: boolean
  onGenerate: (action: 'outline' | 'expand' | 'improve' | 'checklist' | 'faqs') => void
}

export function AICoWriterRibbon({
  aiLanguage,
  onAiLanguageChange,
  isGenerating,
  hasContent,
  onGenerate,
}: AICoWriterRibbonProps) {
  const { t } = useTranslation(['knowledge', 'common'])

  return (
    <div className="bg-ds-ink/5 border border-ds-accent/25 rounded-[8px] p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-ds-accent/20 flex items-center justify-center text-ds-accent shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-foreground">
          AI Co-Writer:
        </span>
        <Select value={aiLanguage} onValueChange={onAiLanguageChange}>
          <SelectTrigger className="w-[110px] h-7 text-xs bg-background font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Arabic">العربية</SelectItem>
            <SelectItem value="English and Arabic">Bilingual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate('outline')}
          disabled={isGenerating}
          className="h-7 text-xs bg-ds-warning-soft/80 hover:bg-ds-warning-soft text-ds-warning border-ds-warning/30 font-semibold transition-colors"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin me-1 text-ds-warning" />
          ) : (
            <Wand2 className="h-3.5 w-3.5 text-ds-warning me-1" />
          )}
          <span>{t('editor.outline', 'Outline')}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate('expand')}
          disabled={isGenerating || !hasContent}
          className="h-7 text-xs bg-ds-info-soft/80 hover:bg-ds-info-soft text-ds-info border-ds-info/30 font-semibold transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-ds-info me-1" />
          <span>{t('editor.expand', 'Expand')}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate('improve')}
          disabled={isGenerating || !hasContent}
          className="h-7 text-xs bg-ds-success-soft/80 hover:bg-ds-success-soft text-ds-success border-ds-success/30 font-semibold transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-ds-success me-1" />
          <span>{t('editor.improve', 'Polish')}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate('checklist')}
          disabled={isGenerating}
          className="h-7 text-xs bg-ds-warning-soft/80 hover:bg-ds-warning-soft text-ds-warning border-ds-warning/30 font-semibold transition-colors"
        >
          <CheckSquare className="h-3.5 w-3.5 text-ds-warning me-1" />
          <span>AI Checklist</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate('faqs')}
          disabled={isGenerating}
          className="h-7 text-xs bg-ds-accent-soft/80 hover:bg-ds-accent-soft text-ds-accent border-ds-accent/30 font-semibold transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5 text-ds-accent me-1" />
          <span>AI FAQs</span>
        </Button>
      </div>
    </div>
  )
}

export default AICoWriterRibbon
