import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileCheck,
  ImageIcon,
  ListOrdered,
  MessageSquare,
  Mic,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AVAILABLE_COURSE_AI_MODELS } from '@/lib/gemini'

interface StudioStageAISettingsProps {
  preferredModel: string
  onChangePreferredModel: (model: string) => void
  targetLanguage: 'English' | 'Arabic' | 'Bilingual'
  onChangeTargetLanguage: (lang: 'English' | 'Arabic' | 'Bilingual') => void
  enableAudioBriefings?: boolean
  onChangeEnableAudioBriefings?: (enabled: boolean) => void
  enableActivitiesAgent?: boolean
  onChangeEnableActivitiesAgent?: (enabled: boolean) => void
  enableAutoRevision?: boolean
  onChangeEnableAutoRevision?: (enabled: boolean) => void
  enableComplianceAudit?: boolean
  onChangeEnableComplianceAudit?: (enabled: boolean) => void
}

export function StudioStageAISettings({
  preferredModel,
  onChangePreferredModel,
  targetLanguage,
  onChangeTargetLanguage,
  enableAudioBriefings = false,
  onChangeEnableAudioBriefings,
  enableActivitiesAgent = true,
  onChangeEnableActivitiesAgent,
  enableAutoRevision = true,
  onChangeEnableAutoRevision,
  enableComplianceAudit = true,
  onChangeEnableComplianceAudit,
}: StudioStageAISettingsProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'

  // Model & Routing Categories
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'all' | 'free' | 'openrouter'>('all')

  // Multi-Agent Pipeline Controls
  const [enableRAGDiscovery, setEnableRAGDiscovery] = useState(true)
  const [enableScenarioAgent, setEnableScenarioAgent] = useState(true)
  const [enablePsychometricAssessments, setEnablePsychometricAssessments] = useState(true)
  const [enableRecraftVisuals, setEnableRecraftVisuals] = useState(true)

  // QA Thresholds
  const [qaThresholdPreset, setQaThresholdPreset] = useState<'strict' | 'standard' | 'lenient'>('strict')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [creativityLevel, setCreativityLevel] = useState<number>(3)

  const filteredModels = AVAILABLE_COURSE_AI_MODELS.filter((m) => {
    if (modelCategoryFilter === 'free') {
      return m.id === 'auto' || m.badge?.includes('Free') || m.provider.includes('Google') || m.provider.includes('Groq')
    }
    if (modelCategoryFilter === 'openrouter') {
      return m.id === 'auto' || m.provider.includes('OpenRouter')
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* 1. Dynamic Model Routing Strategy */}
      <div className="p-4 rounded-[8px] border bg-card/80 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-ds-accent" />
              <span>{t('builder.aiModelOrchestration', 'Dynamic AI Model Intelligence Router')}</span>
              <Badge className="bg-ds-success text-white dark:text-ds-on-ink text-[11px]">Free-First Cascade</Badge>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically routes each agent task to the optimal model: Free Gemini 2.5 Flash & Groq LPU first, escalating to Claude 3.7 & GPT-4o only when necessary.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setModelCategoryFilter('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                modelCategoryFilter === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Models ({AVAILABLE_COURSE_AI_MODELS.length})
            </button>
            <button
              type="button"
              onClick={() => setModelCategoryFilter('free')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-ds-success',
                modelCategoryFilter === 'free'
                  ? 'bg-ds-success-soft shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ⚡ Free Models ($0.00)
            </button>
            <button
              type="button"
              onClick={() => setModelCategoryFilter('openrouter')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-ds-accent',
                modelCategoryFilter === 'openrouter'
                  ? 'bg-ds-accent-soft shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              👑 OpenRouter Tier
            </button>
          </div>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {filteredModels.map((m) => {
            const isSelected = preferredModel === m.id
            const isFree = m.badge?.includes('Free') || m.id === 'auto'

            return (
              <Card
                key={m.id}
                onClick={() => onChangePreferredModel(m.id)}
                className={cn(
                  'cursor-pointer transition-all duration-200 border text-start group relative overflow-hidden',
                  isSelected
                    ? 'border-ds-accent bg-ds-accent-soft/70 ring-2 ring-ds-accent shadow-sm'
                    : 'bg-card hover:border-ds-accent/30'
                )}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                          isSelected ? 'bg-ds-accent text-white dark:text-ds-on-ink' : 'bg-muted text-foreground'
                        )}
                      >
                        <BrainCircuit className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-foreground line-clamp-1">{m.name}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {m.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground font-mono truncate">{m.provider}</span>
                    {m.badge && (
                      <Badge
                        variant={isFree ? 'default' : 'secondary'}
                        className={cn(
                          'text-[11px] px-1.5 py-0 h-4',
                          isFree ? 'bg-ds-success text-white dark:text-ds-on-ink' : 'bg-ds-accent-soft text-ds-accent'
                        )}
                      >
                        {m.badge}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 2. Specialized Multi-Agent Engine Architecture */}
      <div className="p-4 rounded-[8px] border bg-card/80 space-y-4 shadow-sm">
        <div className="space-y-1 border-b pb-2">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Workflow className="w-4 h-4 text-ds-accent" />
            <span>Multi-Agent Engine Subsystems (Active Pipeline)</span>
            <Badge variant="outline" className="text-[11px]">10 Specialized Agents</Badge>
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Configure which autonomous specialist agents collaborate on curriculum generation, workplace scenarios, and QA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* RAG Discovery Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-ds-info" />
                Research & RAG Grounding Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Searches hotel SOP repository in PostgreSQL + five-star hospitality benchmarks.
              </p>
            </div>
            <Switch checked={enableRAGDiscovery} onCheckedChange={setEnableRAGDiscovery} />
          </div>

          {/* Interactive Activities Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-ds-info" />
                Interactive Activities Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Synthesizes shift observation guides, workplace practice drills, and physical checklists.
              </p>
            </div>
            <Switch
              checked={enableActivitiesAgent}
              onCheckedChange={(val) => onChangeEnableActivitiesAgent?.(val)}
            />
          </div>

          {/* Scenario & Guest Dilemma Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-ds-warning" />
                Scenario & Roleplay Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Builds branching guest dilemmas using LAST protocol and Saudi hospitality etiquette.
              </p>
            </div>
            <Switch checked={enableScenarioAgent} onCheckedChange={setEnableScenarioAgent} />
          </div>

          {/* Psychometric Assessment Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-ds-danger" />
                Psychometric Assessment Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Generates 16+ Bloom's Taxonomy question types with plausible distractor analysis.
              </p>
            </div>
            <Switch checked={enablePsychometricAssessments} onCheckedChange={setEnablePsychometricAssessments} />
          </div>

          {/* Recraft Free Visuals Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-ds-warning" />
                Recraft & Cloudflare Visual Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Generates SVG vector diagrams & educational illustrations ($0.00 / Free tier first).
              </p>
            </div>
            <Switch checked={enableRecraftVisuals} onCheckedChange={setEnableRecraftVisuals} />
          </div>

          {/* Bilingual Audio Briefing Agent */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="space-y-0.5 pe-2">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-ds-info" />
                Audio Shift Briefing Agent
              </p>
              <p className="text-[11px] text-muted-foreground">
                Synthesizes spoken audio briefings in Saudi Arabic (ar-SA) and English (en-US). (Disabled by default)
              </p>
            </div>
            <Switch
              checked={enableAudioBriefings}
              onCheckedChange={(val) => onChangeEnableAudioBriefings?.(val)}
            />
          </div>
        </div>
      </div>

      {/* 3. Pedagogical QA Critic, Surgical Revision & KSA Compliance */}
      <div className="p-4 rounded-[8px] border bg-card/80 space-y-4 shadow-sm">
        <div className="space-y-1 border-b pb-2">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-ds-success" />
            <span>Pedagogical QA Critic & KSA Regulatory Safeguards</span>
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Enforces 7-dimensional pedagogical audit, surgical gap remediation, and Saudi labor compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">QA Target Score</span>
              <Badge className="bg-ds-accent text-white dark:text-ds-on-ink text-[11px]">
                {qaThresholdPreset === 'strict' ? '95+ Production' : qaThresholdPreset === 'standard' ? '85+ Polish' : '70+ Pass'}
              </Badge>
            </div>
            <Select value={qaThresholdPreset} onValueChange={(val: any) => setQaThresholdPreset(val)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict (95+ Production Ready)</SelectItem>
                <SelectItem value="standard">Standard (85+ High Quality)</SelectItem>
                <SelectItem value="lenient">Rapid (70+ Minimum Pass)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-0.5 pe-2">
              <p className="text-xs font-bold text-foreground flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-ds-accent" />
                Surgical Auto-Revision
              </p>
              <p className="text-[11px] text-muted-foreground">Auto-repairs QA gaps without rebuilding full modules.</p>
            </div>
            <Switch
              checked={enableAutoRevision}
              onCheckedChange={(val) => onChangeEnableAutoRevision?.(val)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-0.5 pe-2">
              <p className="text-xs font-bold text-foreground flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-ds-success" />
                KSA Regulatory Shield
              </p>
              <p className="text-[11px] text-muted-foreground">Audits against Saudi Ministry of Tourism & Balady.</p>
            </div>
            <Switch
              checked={enableComplianceAudit}
              onCheckedChange={(val) => onChangeEnableComplianceAudit?.(val)}
            />
          </div>
        </div>
      </div>

      {/* 4. Progressive Disclosure: Advanced Prompt Strictness & Creativity Tuning */}
      <div className="border rounded-[8px] bg-muted/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ds-accent" />
            <span>{t('builder.advancedAI', 'Advanced Prompt Strictness & Creativity Tuning')}</span>
            <Badge variant="outline" className="text-[11px]">Optional</Badge>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-4 pt-1 border-t space-y-4 text-xs">
            <div className="space-y-2 p-3 rounded-lg border bg-card">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span>{t('builder.creativityLevel', 'Pedagogical Strictness vs Creative Scenarios')}</span>
                <span className="font-mono text-ds-accent font-bold">
                  {creativityLevel === 1 ? 'Strict Procedural' : creativityLevel === 3 ? 'Balanced five-star Standard' : 'Highly Creative Scenarios'}
                </span>
              </div>
              <Slider
                value={[creativityLevel]}
                onValueChange={([val]) => setCreativityLevel(val)}
                min={1}
                max={5}
                step={1}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Strict Fact-Only</span>
                <span className="text-ds-accent font-bold">Balanced five-star Quality</span>
                <span>Rich Novel Dilemmas</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
