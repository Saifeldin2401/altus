/**
 * AI Article Studio Modal - Enterprise Knowledge Base & SOP Engine
 * 
 * Interactive Multi-Agent Studio for generating 5-star hotel SOPs, Policies, Checklists, and FAQs.
 * Features PDF/DOCX ingestion, luxury hotel presets, advanced visual model controls (Recraft Vector, FLUX.1),
 * depth benchmarks, live model transparency, generation history, and KSA regulatory compliance auditing.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  FileCheck,
  FileQuestion,
  FileText,
  FileUp,
  Flame,
  Globe,
  History,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UploadCloud,
  Utensils,
  Wand2,
  X,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { extractTextFromFile } from '@/lib/documentText'
import { useDepartments } from '@/hooks/useDepartments'
import { cn } from '@/lib/utils'
import { knowledgeArticleOrchestrator } from '@/lib/ai/agents/knowledgeBase/knowledgeArticleOrchestrator'
import { VisualAssetEditorModal } from '@/components/training/ai-engine/VisualAssetEditorModal'
import type {
  GeneratedKnowledgeArticle,
  KnowledgeArticleGenerationConfig,
  KnowledgeDepthLevel,
  KnowledgePipelineProgressEvent,
} from '@/lib/ai/agents/knowledgeBase/types'
import type { CourseVisualAsset } from '@/types/aiCourseEngine'
import type { KnowledgeContentType } from '@/types/knowledge'

interface AIArticleStudioModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyArticle: (article: GeneratedKnowledgeArticle) => void
  defaultContentType?: KnowledgeContentType
  defaultDepartment?: string
}

// 5-Star Hotel Operational SOP & Policy Presets
const LUXURY_KB_PRESETS = [
  {
    id: 'vip-arrival',
    title: 'VIP Express Arrival & In-Suite Check-In Standard',
    type: 'sop' as KnowledgeContentType,
    dept: 'Front Office',
    audience: 'Front Desk Agents, Butlers, and Guest Relations',
    icon: Sparkles,
    depth: 'five_star_comprehensive' as KnowledgeDepthLevel,
    promptHint: 'Include luggage escort protocol, welcome tea presentation, and room technology orientation.',
  },
  {
    id: 'turndown-experience',
    title: 'five-star Evening Turndown & Scent Experience Protocol',
    type: 'sop' as KnowledgeContentType,
    dept: 'Housekeeping',
    audience: 'Housekeeping Attendants & Floor Supervisors',
    icon: BookOpen,
    depth: 'five_star_comprehensive' as KnowledgeDepthLevel,
    promptHint: 'Include 45-degree duvet fold, slipper placement on linen mat, ambient lighting preset, and pillow menu.',
  },
  {
    id: 'haccp-sanitization',
    title: 'HACCP Kitchen Food Safety & High-Touch Sanitization Protocol',
    type: 'sop' as KnowledgeContentType,
    dept: 'Culinary & Kitchen',
    audience: 'Chefs, Stewarding Team, and F&B Handlers',
    icon: Utensils,
    depth: 'regulatory_compliance' as KnowledgeDepthLevel,
    promptHint: 'Include color-coded chopping boards, core temperature logging, Balady chemical dilution rules, and glove changes.',
  },
  {
    id: 'fire-evacuation',
    title: 'Emergency Fire Alarm & Multi-Tier Guest Evacuation Policy',
    type: 'policy' as KnowledgeContentType,
    dept: 'Security & Safety',
    audience: 'All Hotel Employees & Emergency Response Team',
    icon: Flame,
    depth: 'regulatory_compliance' as KnowledgeDepthLevel,
    promptHint: 'Include warden assembly zones, guest floor sweeps, civil defense handover, and smoke barrier verification.',
  },
  {
    id: 'guest-privacy',
    title: 'Guest Data Privacy & Confidentiality Governance Policy',
    type: 'policy' as KnowledgeContentType,
    dept: 'Human Resources',
    audience: 'All Employees & System Operators',
    icon: Lock,
    depth: 'standard' as KnowledgeDepthLevel,
    promptHint: 'Include PMS screen lockouts, VIP guest alias confidentiality, and zero disclosure to unauthorized third parties.',
  },
  {
    id: 'shift-handover',
    title: 'Daily Duty Manager & Front Desk Shift Handover Checklist',
    type: 'checklist' as KnowledgeContentType,
    dept: 'Front Office',
    audience: 'Duty Managers & Shift Leaders',
    icon: FileCheck,
    depth: 'standard' as KnowledgeDepthLevel,
    promptHint: 'Include cash float count, VIP arrival review, pending maintenance issues, and occupancy forecast handover.',
  },
]

const STORAGE_HISTORY_KEY = 'altus_kb_generation_history'

export function AIArticleStudioModal({
  isOpen,
  onClose,
  onApplyArticle,
  defaultContentType = 'sop',
  defaultDepartment = '',
}: AIArticleStudioModalProps) {
  const { t, i18n } = useTranslation('knowledge')
  const isRTL = i18n.dir() === 'rtl'

  // Studio Mode: Fast 1-Click vs Advanced Multi-Stage Wizard
  const [studioMode, setStudioMode] = useState<'fast' | 'advanced'>('fast')
  const [advancedTab, setAdvancedTab] = useState<'source' | 'scope' | 'depth' | 'visuals' | 'compliance'>('source')

  // Document Configuration State
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<KnowledgeContentType>(defaultContentType)
  const [department, setDepartment] = useState(defaultDepartment)
  const [targetAudience, setTargetAudience] = useState('Frontline Staff & Shift Supervisors')
  const [depthLevel, setDepthLevel] = useState<KnowledgeDepthLevel>('five_star_comprehensive')
  const [languagePreference, setLanguagePreference] = useState<'bilingual' | 'en' | 'ar'>('bilingual')

  // Content Depth & Structural Checkboxes
  const [includeChecklist, setIncludeChecklist] = useState(true)
  const [includeFaq, setIncludeFaq] = useState(true)
  const [includeCriticalControlPoints, setIncludeCriticalControlPoints] = useState(true)
  const [includeLastFramework, setIncludeLastFramework] = useState(true)
  const [includeEmergencyProtocols, setIncludeEmergencyProtocols] = useState(true)

  // AI Visuals & Photography Controls
  const [enableVectorSchematic, setEnableVectorSchematic] = useState(true)
  const [imageModel, setImageModel] = useState('auto')
  const [visualStyle, setVisualStyle] = useState('luxury_photography')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9')
  const [customVisualPrompt, setCustomVisualPrompt] = useState('')

  // Source Material & Document Ingestion
  const [sourceNotes, setSourceNotes] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Engine / Model Selection
  const [preferredModel, setPreferredModel] = useState('auto')

  // Execution & Pipeline State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [fileStatus, setFileStatus] = useState<{ reading: boolean; error: string | null; words: number | null }>({ reading: false, error: null, words: null })
  const { departments } = useDepartments()
  const [progressEvent, setProgressEvent] = useState<KnowledgePipelineProgressEvent | null>(null)
  const [generatedResult, setGeneratedResult] = useState<GeneratedKnowledgeArticle | null>(null)
  const [previewTab, setPreviewTab] = useState<'english' | 'arabic' | 'schematic' | 'checklist' | 'faq' | 'compliance'>('english')

  // History & Visual Editor Modals
  const [showHistory, setShowHistory] = useState(false)
  const [generationHistory, setGenerationHistory] = useState<Array<{ timestamp: string; article: GeneratedKnowledgeArticle }>>([])
  const [visualEditorOpen, setVisualEditorOpen] = useState(false)
  const [selectedAssetForEditor, setSelectedAssetForEditor] = useState<CourseVisualAsset | null>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY)
      if (saved) {
        setGenerationHistory(JSON.parse(saved))
      }
    } catch {}
  }, [])

  const saveToHistory = (article: GeneratedKnowledgeArticle) => {
    try {
      const newEntry = { timestamp: new Date().toISOString(), article }
      const updated = [newEntry, ...generationHistory.slice(0, 9)]
      setGenerationHistory(updated)
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated))
    } catch {}
  }

  // Handle PDF / Word / TXT / Markdown file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadedFileName(file.name)
    setUploadedFileSize(`${(file.size / 1024).toFixed(1)} KB`)
    setFileStatus({ reading: true, error: null, words: null })
    try {
      // PDF and Word files are parsed properly; reading them as plain text
      // used to hand the AI binary noise as "source material".
      const extracted = await extractTextFromFile(file)
      setSourceNotes(extracted.text)
      setFileStatus({ reading: false, error: null, words: extracted.wordCount })
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim())
      }
    } catch (err) {
      setSourceNotes('')
      setFileStatus({ reading: false, error: err instanceof Error ? err.message : 'This file could not be read.', words: null })
    }
  }

  const handleApplyPreset = (preset: typeof LUXURY_KB_PRESETS[0]) => {
    setTitle(preset.title)
    setContentType(preset.type)
    setDepartment(preset.dept)
    setTargetAudience(preset.audience)
    setDepthLevel(preset.depth)
    if (preset.promptHint) {
      setSourceNotes((prev) => (prev ? `${prev}\n\n${preset.promptHint}` : preset.promptHint))
    }
  }

  const openVisualEditorForArticle = () => {
    if (generatedResult?.visual_asset) {
      setSelectedAssetForEditor(generatedResult.visual_asset)
    } else if (generatedResult) {
      const isGoogle = imageModel.includes('imagen') || imageModel.includes('banana')
      const isOpenRouter = imageModel.includes('/')
      const provider = isGoogle ? 'gemini' : isOpenRouter ? 'openrouter' : 'cloudflare'

      const draftAsset: CourseVisualAsset = {
        id: `kb-visual-${Date.now()}`,
        course_id: 'kb-article',
        module_id: 'kb-module',
        lesson_id: 'kb-lesson',
        storage_bucket: 'course-assets',
        title: generatedResult.title || title || 'Knowledge Base Article Visual',
        alt_text: generatedResult.summary || generatedResult.title || 'Operational SOP Diagram',
        caption: generatedResult.summary || '5-Star Operational Standard',
        prompt: customVisualPrompt.trim() || `${generatedResult.title || title}: 5-star luxury hotel operational standard for ${department}`,
        visual_style: visualStyle as any,
        aspect_ratio: aspectRatio,
        model: imageModel,
        provider: provider as any,
        educational_purpose: 'concept_illustration',
        visual_concept: generatedResult.title || title,
        placement: 'procedure',
        status: 'pending',
        order_index: 0,
        image_url: '',
        draft: true,
      }
      setSelectedAssetForEditor(draftAsset)
    }
    setVisualEditorOpen(true)
  }

  const handleGenerate = async () => {
    if (!title.trim()) return

    setIsGenerating(true)
    setGenerationError(null)
    setProgressEvent(null)
    setGeneratedResult(null)

    try {
      const config: KnowledgeArticleGenerationConfig = {
        title: title.trim(),
        contentType,
        department,
        targetAudience,
        depthLevel,
        languagePreference,
        enableVectorSchematic,
        imageModel,
        visualStyle,
        aspectRatio,
        customVisualPrompt: customVisualPrompt.trim() || undefined,
        includeChecklist,
        includeFaq,
        includeCriticalControlPoints,
        includeLastFramework,
        includeEmergencyProtocols,
        sourceDocumentText: sourceNotes.trim() || undefined,
        sourceFileName: uploadedFileName || undefined,
        preferredModel: preferredModel === 'auto' ? undefined : preferredModel,
      }

      const result = await knowledgeArticleOrchestrator.orchestrate(config, (event) => {
        setProgressEvent(event)
      })

      setGeneratedResult(result)
      saveToHistory(result)
      setPreviewTab('english')
    } catch (err) {
      console.error('Knowledge article generation failed:', err)
      setGenerationError(
        err instanceof Error && err.message
          ? err.message
          : 'The article could not be generated. Check your connection and try again.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApply = () => {
    if (generatedResult) {
      onApplyArticle(generatedResult)
      onClose()
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !isGenerating && onClose()}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
          {/* Header */}
          <DialogHeader className="p-5 border-b bg-gradient-to-r from-ds-accent/10 via-ds-info/5 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-ds-accent text-white dark:text-ds-on-ink flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <span>AI Document Creator</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {studioMode === 'fast'
                      ? 'Pick a template or describe what you need — the AI writes a complete SOP, policy, checklist or FAQ in English and Arabic. Edit it afterwards.'
                      : 'Full control over source material, scope, depth, visuals and compliance checks.'}
                  </DialogDescription>
                </div>
              </div>

              {/* Mode Switcher & History Button */}
              <div className="flex items-center gap-2">
                {generationHistory.length > 0 && !isGenerating && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                    History ({generationHistory.length})
                  </Button>
                )}

                {!generatedResult && !isGenerating && (
                  <div className="flex bg-muted p-0.5 rounded-lg border text-xs">
                    <button
                      type="button"
                      onClick={() => setStudioMode('fast')}
                      className={cn(
                        'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1',
                        studioMode === 'fast' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Zap className="w-3 h-3 text-ds-warning" /> Fast
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioMode('advanced')}
                      className={cn(
                        'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1',
                        studioMode === 'advanced' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Sliders className="w-3 h-3 text-ds-accent" /> Advanced
                    </button>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {generationError && !isGenerating && (
              <div role="alert" className="flex items-start gap-3 rounded-[8px] border border-ds-danger/40 bg-ds-danger-soft p-4">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ds-danger" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-semibold text-ds-ink">{t('studio.failedTitle', 'The article was not created')}</p>
                  <p className="text-sm text-ds-ink-secondary">{generationError}</p>
                  <Button type="button" size="sm" onClick={handleGenerate} disabled={!title.trim()}>
                    {t('studio.tryAgain', 'Try again')}
                  </Button>
                </div>
              </div>
            )}

            {!generatedResult && !isGenerating && (
              <div className="space-y-5">
                {/* Mode: Fast Mode */}
                {studioMode === 'fast' ? (
                  <div className="space-y-5">
                    {/* Presets Bar */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                        Quick Presets & Benchmark SOPs
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {LUXURY_KB_PRESETS.map((preset) => {
                          const Icon = preset.icon
                          const isSelected = title === preset.title
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleApplyPreset(preset)}
                              className={cn(
                                'p-2.5 rounded-[8px] border text-start transition-all flex items-start gap-2.5 hover:border-ds-accent hover:bg-ds-accent-soft/50',
                                isSelected
                                  ? 'border-ds-accent bg-ds-accent-soft/80 shadow-xs ring-1 ring-ds-accent'
                                  : 'bg-card'
                              )}
                            >
                              <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', isSelected ? 'bg-ds-accent text-white dark:text-ds-on-ink' : 'bg-muted text-muted-foreground')}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-foreground truncate">{preset.title}</p>
                                <p className="text-[11px] text-muted-foreground">{preset.dept} • {preset.type.toUpperCase()}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Document Upload Dropzone */}
                    <div className="p-4 rounded-[8px] border-2 border-dashed border-ds-accent/30 bg-ds-accent-soft/30 flex flex-col items-center justify-center text-center space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.docx,.doc,.txt,.md,.json"
                        className="hidden"
                      />
                      <div className="p-3 rounded-full bg-ds-accent-soft text-ds-accent">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {fileStatus.reading
                            ? t('studio.readingFile', 'Reading {{name}}…', { name: uploadedFileName })
                            : fileStatus.error
                              ? fileStatus.error
                              : uploadedFileName
                                ? t('studio.fileRead', '{{name}} ({{size}}) - {{words}} words used as source', { name: uploadedFileName, size: uploadedFileSize, words: fileStatus.words ?? 0 })
                                : t('studio.uploadPrompt', 'Upload a brand standard, policy or SOP to write from')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Supports PDF, Word (.docx), Markdown (.md), and TXT files. AI extracts key operational directives automatically.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 text-xs font-medium"
                        >
                          <FileUp className="w-3.5 h-3.5 me-1.5 text-ds-accent" />
                          {uploadedFileName ? 'Change Document' : 'Browse Files'}
                        </Button>
                        {uploadedFileName && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUploadedFileName('')
                              setUploadedFileSize('')
                              setSourceNotes('')
                              setFileStatus({ reading: false, error: null, words: null })
                            }}
                            className="h-7 text-xs text-ds-danger hover:text-ds-danger"
                          >
                            <X className="w-3.5 h-3.5 me-1" /> Clear
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Fast Mode Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-semibold">Document Title / Operational Subject *</Label>
                        <Input
                          placeholder="e.g. VIP Express Arrival & Suite Orientation Standard"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="h-10 text-sm font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Document Category / Type</Label>
                        <Select value={contentType} onValueChange={(val: any) => setContentType(val)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sop">Standard Operating Procedure (SOP)</SelectItem>
                            <SelectItem value="policy">Corporate & Hotel Policy</SelectItem>
                            <SelectItem value="checklist">Operational Checklist</SelectItem>
                            <SelectItem value="faq">FAQ Question Database</SelectItem>
                            <SelectItem value="how_to">Operational Guide / Manual</SelectItem>
                            <SelectItem value="quick_reference">Quick Action Reference Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Department Scope</Label>
                        {departments.length > 0 ? (
                          <Select value={department || undefined} onValueChange={setDepartment}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder={t('studio.chooseDepartment', 'Choose a department')} />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder={t('studio.departmentPlaceholder', 'e.g. Front Office')}
                            className="h-9 text-xs"
                          />
                        )}
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-semibold">Target Audience / Responsible Roles</Label>
                        <Input
                          placeholder="e.g. Front Desk Agents, Duty Managers, and Butler Team"
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* AI Visual Artwork & Photography Toggle */}
                      <div className="md:col-span-2 p-3.5 rounded-[8px] border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-ds-warning-soft text-ds-warning">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">Add an illustration</p>
                            <p className="text-[11px] text-muted-foreground">
                              The AI creates a matching luxury-hotel image and embeds it in the document.
                            </p>
                          </div>
                        </div>
                        <Switch checked={enableVectorSchematic} onCheckedChange={setEnableVectorSchematic} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mode: Advanced Multi-Stage Studio Wizard */
                  <div className="space-y-4">
                    <Tabs value={advancedTab} onValueChange={(val: any) => setAdvancedTab(val)} className="w-full">
                      <TabsList className="grid grid-cols-5 w-full h-9">
                        <TabsTrigger value="source" className="text-xs">
                          <FileText className="w-3.5 h-3.5 me-1.5" /> 1. Source & File
                        </TabsTrigger>
                        <TabsTrigger value="scope" className="text-xs">
                          <Layers className="w-3.5 h-3.5 me-1.5" /> 2. Scope & Roles
                        </TabsTrigger>
                        <TabsTrigger value="depth" className="text-xs">
                          <BookOpen className="w-3.5 h-3.5 me-1.5" /> 3. Depth & 5-Star
                        </TabsTrigger>
                        <TabsTrigger value="visuals" className="text-xs">
                          <ImageIcon className="w-3.5 h-3.5 me-1.5 text-ds-warning" /> 4. AI Visuals
                        </TabsTrigger>
                        <TabsTrigger value="compliance" className="text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 me-1.5 text-ds-success" /> 5. AI Engine
                        </TabsTrigger>
                      </TabsList>

                      {/* Tab 1: Source & Ingestion */}
                      <TabsContent value="source" className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Document Title / Operational Subject *</Label>
                          <Input
                            placeholder="e.g. VIP Express Arrival & Suite Orientation Standard"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-10 text-sm font-medium"
                          />
                        </div>

                        {/* Dropzone */}
                        <div className="p-4 rounded-[8px] border-2 border-dashed border-ds-accent/30 bg-ds-accent-soft/30 flex flex-col items-center justify-center text-center space-y-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".pdf,.docx,.doc,.txt,.md,.json"
                            className="hidden"
                          />
                          <div className="p-3 rounded-full bg-ds-accent-soft text-ds-accent">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {fileStatus.reading
                            ? t('studio.readingFile', 'Reading {{name}}…', { name: uploadedFileName })
                            : fileStatus.error
                              ? fileStatus.error
                              : uploadedFileName
                                ? t('studio.fileRead', '{{name}} ({{size}}) - {{words}} words used as source', { name: uploadedFileName, size: uploadedFileSize, words: fileStatus.words ?? 0 })
                                : t('studio.uploadPrompt', 'Upload a brand standard, policy or SOP to write from')}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Supports PDF, Word (.docx), Markdown (.md), and TXT files.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-7 text-xs font-medium"
                          >
                            <FileUp className="w-3.5 h-3.5 me-1.5 text-ds-accent" />
                            {uploadedFileName ? 'Change Document' : 'Browse Files'}
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Source Notes / Raw Operational Directives</Label>
                          <Textarea
                            placeholder="Paste unformatted procedures, time benchmarks, PMS protocols, or specific hotel brand requirements..."
                            value={sourceNotes}
                            onChange={(e) => setSourceNotes(e.target.value)}
                            className="text-xs min-h-[120px]"
                          />
                        </div>
                      </TabsContent>

                      {/* Tab 2: Scope & Roles */}
                      <TabsContent value="scope" className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Document Category / Type</Label>
                            <Select value={contentType} onValueChange={(val: any) => setContentType(val)}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sop">Standard Operating Procedure (SOP)</SelectItem>
                                <SelectItem value="policy">Corporate & Hotel Policy</SelectItem>
                                <SelectItem value="checklist">Operational Checklist</SelectItem>
                                <SelectItem value="faq">FAQ Question Database</SelectItem>
                                <SelectItem value="how_to">Operational Guide / Manual</SelectItem>
                                <SelectItem value="quick_reference">Quick Action Reference Card</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Department Scope</Label>
                            {departments.length > 0 ? (
                          <Select value={department || undefined} onValueChange={setDepartment}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder={t('studio.chooseDepartment', 'Choose a department')} />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder={t('studio.departmentPlaceholder', 'e.g. Front Office')}
                            className="h-9 text-xs"
                          />
                        )}
                          </div>

                          <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-xs font-semibold">Target Audience / Responsible Roles</Label>
                            <Input
                              placeholder="e.g. Front Desk Agents, Duty Managers, and Butler Team"
                              value={targetAudience}
                              onChange={(e) => setTargetAudience(e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Primary Output Language</Label>
                            <Select value={languagePreference} onValueChange={(val: any) => setLanguagePreference(val)}>
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bilingual">🌐 Full Bilingual (English & Arabic with RTL)</SelectItem>
                                <SelectItem value="en">🇬🇧 English Primary</SelectItem>
                                <SelectItem value="ar">🇸🇦 Arabic Sovereign Standard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Tab 3: Depth & 5-Star Benchmarks */}
                      <TabsContent value="depth" className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Operational Depth & Quality Benchmark</Label>
                          <Select value={depthLevel} onValueChange={(val: any) => setDepthLevel(val)}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="five_star_comprehensive">🌟 Five-Star Comprehensive (Exhaustive & Behavioral)</SelectItem>
                              <SelectItem value="standard">📘 Standard 5-Star Operating SOP (Balanced Detail)</SelectItem>
                              <SelectItem value="regulatory_compliance">🛡️ KSA Regulatory & Safety Mandate (Audit-Focused)</SelectItem>
                              <SelectItem value="concise">⚡ Concise Frontline Cheat Sheet (Rapid Execution)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3 pt-2">
                          <Label className="text-xs font-bold text-foreground">Structural Elements to Include</Label>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <label className="flex items-center gap-2 p-3 rounded-[8px] border bg-card cursor-pointer hover:bg-muted/30">
                              <Checkbox checked={includeChecklist} onCheckedChange={(c) => setIncludeChecklist(Boolean(c))} />
                              <span>Supervisory Inspection Checklist (4-6 points)</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 rounded-[8px] border bg-card cursor-pointer hover:bg-muted/30">
                              <Checkbox checked={includeFaq} onCheckedChange={(c) => setIncludeFaq(Boolean(c))} />
                              <span>Categorized Staff & Guest FAQs</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 rounded-[8px] border bg-card cursor-pointer hover:bg-muted/30">
                              <Checkbox checked={includeCriticalControlPoints} onCheckedChange={(c) => setIncludeCriticalControlPoints(Boolean(c))} />
                              <span>Critical Control Points (CCPs)</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 rounded-[8px] border bg-card cursor-pointer hover:bg-muted/30">
                              <Checkbox checked={includeLastFramework} onCheckedChange={(c) => setIncludeLastFramework(Boolean(c))} />
                              <span>LAST Service Recovery (Listen, Apologize, Solve, Thank)</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 rounded-[8px] border bg-card cursor-pointer hover:bg-muted/30 sm:col-span-2">
                              <Checkbox checked={includeEmergencyProtocols} onCheckedChange={(c) => setIncludeEmergencyProtocols(Boolean(c))} />
                              <span>Emergency & System Offline Contingency Fallbacks</span>
                            </label>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Tab 4: AI Visuals & Schematics */}
                      <TabsContent value="visuals" className="mt-4 space-y-4">
                        <div className="p-3.5 rounded-[8px] border bg-muted/20 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-ds-warning-soft text-ds-warning">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">Enable AI Visual SOP Schematic</p>
                              <p className="text-[11px] text-muted-foreground">
                                Synthesizes an operational vector workflow diagram embedded directly into the article.
                              </p>
                            </div>
                          </div>
                          <Switch checked={enableVectorSchematic} onCheckedChange={setEnableVectorSchematic} />
                        </div>

                        {enableVectorSchematic && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Image Generation Engine</Label>
                              <Select value={imageModel} onValueChange={setImageModel}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  <SelectItem value="auto">🤖 Automatic — best free engine (Recommended)</SelectItem>

                                  <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-sm mt-2 mb-1">
                                    Cloudflare Workers AI (Free)
                                  </div>
                                  <SelectItem value="@cf/leonardo/lucid-origin">🎨 Leonardo Lucid Origin (flagship photorealism)</SelectItem>
                                  <SelectItem value="@cf/leonardo/phoenix-1.0">🖋️ Leonardo Phoenix 1.0 (typography)</SelectItem>
                                  <SelectItem value="@cf/black-forest-labs/flux-1-schnell">✨ FLUX.1 Schnell (text &amp; diagrams)</SelectItem>
                                  <SelectItem value="@cf/stabilityai/stable-diffusion-xl-base-1.0">🛡️ SDXL Base 1.0 (high detail)</SelectItem>
                                  <SelectItem value="@cf/lykon/dreamshaper-8-lcm">🏨 DreamShaper 8 LCM (photo &amp; ambiance)</SelectItem>
                                  <SelectItem value="@cf/bytedance/stable-diffusion-xl-lightning">⚡ SDXL Lightning (fastest)</SelectItem>

                                  <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-sm mt-2 mb-1">
                                    Vector (Free • instant)
                                  </div>
                                  <SelectItem value="recraft-vector">📐 Vector Schematic (SVG diagrams &amp; flowcharts)</SelectItem>

                                  <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded-sm mt-2 mb-1">
                                    OpenRouter (Paid • needs credits)
                                  </div>
                                  <SelectItem value="google/gemini-3-pro-image">💎 Gemini 3 Pro Image (highest quality)</SelectItem>
                                  <SelectItem value="google/gemini-2.5-flash-image">💎 Gemini 2.5 Flash Image (fast)</SelectItem>
                                  <SelectItem value="google/gemini-3.1-flash-image">💎 Gemini 3.1 Flash Image</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Visual Style</Label>
                              <Select value={visualStyle} onValueChange={setVisualStyle}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="technical_diagram">📐 Process Flowchart / SOP Schematic</SelectItem>
                                  <SelectItem value="infographic">📊 Educational Step Infographic</SelectItem>
                                  <SelectItem value="luxury_photography">🏨 5-Star Luxury Service Scene</SelectItem>
                                  <SelectItem value="isometric_3d">🏢 Isometric Room / Kitchen Layout</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Aspect Ratio</Label>
                              <Select value={aspectRatio} onValueChange={(val: any) => setAspectRatio(val)}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="16:9">Landscape (16:9 Banner Guide)</SelectItem>
                                  <SelectItem value="4:3">Standard (4:3 SOP Card)</SelectItem>
                                  <SelectItem value="1:1">Square (1:1 Reference Card)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5 md:col-span-3">
                              <Label className="text-xs font-semibold">Custom Visual Prompt Directives (Optional)</Label>
                              <Input
                                placeholder="e.g. Elegant hotel reception desk, associate in black suit greeting guest with warm smile, luxury marble lighting"
                                value={customVisualPrompt}
                                onChange={(e) => setCustomVisualPrompt(e.target.value)}
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      {/* Tab 5: AI Engine & Compliance */}
                      <TabsContent value="compliance" className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">AI Intelligence Router</Label>
                          <Select value={preferredModel} onValueChange={setPreferredModel}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">✨ Auto Route Gateway (Optimal Latency & Cost)</SelectItem>
                              <SelectItem value="google/gemini-2.5-flash">⚡ Google Gemini 2.5 Flash</SelectItem>
                              <SelectItem value="anthropic/claude-opus-4.5">🧠 Anthropic Claude Opus 4.5</SelectItem>
                              <SelectItem value="anthropic/claude-haiku-4.5">🪶 Anthropic Claude Haiku 4.5</SelectItem>
                              <SelectItem value="deepseek/deepseek-chat">🚀 DeepSeek V3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="p-4 rounded-[8px] border bg-ds-success-soft/50 space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-ds-success font-bold">
                            <ShieldCheck className="w-4 h-4" />
                            KSA Regulatory Compliance Shield
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            Every synthesized document is automatically audited against Saudi Ministry of Tourism (MoT) classification standards, Balady food & health mandates, Saudi Civil Defense fire/safety codes, and Saudi Labor Law.
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            )}

            {/* Live Progress View */}
            {isGenerating && (
              <div className="py-12 px-6 text-center space-y-6 max-w-lg mx-auto">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-ds-accent/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full bg-ds-accent text-white dark:text-ds-on-ink flex items-center justify-center shadow-lg">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {progressEvent?.agentName || 'Writing your document'}
                    </h3>
                    {progressEvent?.modelUsed && (
                      <Badge variant="secondary" className="text-[11px] font-mono bg-ds-accent-soft text-ds-accent">
                        <Cpu className="w-3 h-3 me-1" />
                        {progressEvent.modelUsed.split('/').pop()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progressEvent?.detail || 'Researching standards, drafting in English and Arabic, adding visuals, and checking compliance…'}
                  </p>
                </div>

                <div className="space-y-1">
                  <Progress value={progressEvent?.progressPercentage || 25} className="h-2.5" />
                  <p className="text-[11px] text-muted-foreground font-mono text-end">
                    {progressEvent?.progressPercentage || 25}%
                  </p>
                </div>
              </div>
            )}

            {/* Generated Result Preview */}
            {generatedResult && !isGenerating && (
              <div className="space-y-4">
                {/* Top Score Banner */}
                <div className="p-4 rounded-[8px] border border-ds-success/30 bg-ds-success-soft/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[8px] bg-ds-success text-white dark:text-ds-on-ink flex items-center justify-center font-bold shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span>{generatedResult.title}</span>
                        {generatedResult.sop_code && (
                          <Badge variant="outline" className="text-[11px] font-mono">
                            {generatedResult.sop_code}
                          </Badge>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {generatedResult.description} • Est. Read Time: ~{generatedResult.estimated_read_time_minutes} mins
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="bg-ds-success text-white dark:text-ds-on-ink text-xs font-semibold px-2.5 py-1">
                      <ShieldCheck className="w-3.5 h-3.5 me-1" />
                      {t('studio.keywordCheck', 'Keyword check')}: {generatedResult.compliance_score}/100
                    </Badge>
                  </div>
                </div>

                {/* Preview Tabs */}
                <Tabs value={previewTab} onValueChange={(val: any) => setPreviewTab(val)} className="w-full">
                  <TabsList className="grid grid-cols-6 w-full h-9">
                    <TabsTrigger value="english" className="text-xs">
                      <FileText className="w-3.5 h-3.5 me-1.5" /> English Document
                    </TabsTrigger>
                    <TabsTrigger value="arabic" className="text-xs">
                      <Globe className="w-3.5 h-3.5 me-1.5" /> Arabic SOP
                    </TabsTrigger>
                    <TabsTrigger value="schematic" className="text-xs">
                      <ImageIcon className="w-3.5 h-3.5 me-1.5 text-ds-warning" /> AI Visual Asset
                    </TabsTrigger>
                    <TabsTrigger value="checklist" className="text-xs" disabled={!generatedResult.checklist_items?.length}>
                      <FileCheck className="w-3.5 h-3.5 me-1.5" /> Checklist ({generatedResult.checklist_items?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="faq" className="text-xs" disabled={!generatedResult.faq_items?.length}>
                      <FileQuestion className="w-3.5 h-3.5 me-1.5" /> FAQ ({generatedResult.faq_items?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 me-1.5 text-ds-success" /> QA Scorecard
                    </TabsTrigger>
                  </TabsList>

                  {/* English Content */}
                  <TabsContent value="english" className="mt-3 space-y-4">
                    {/* Embedded Visual Schematic Preview */}
                    {generatedResult.visual_asset?.image_url ? (
                      <div className="p-3 rounded-[8px] border bg-ds-ink/90 space-y-2">
                        <div className="flex items-center justify-between text-xs text-ds-muted">
                          <span className="font-bold flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-ds-warning" />
                            {generatedResult.visual_asset.model?.includes('imagen') || generatedResult.visual_asset.model?.includes('banana') || generatedResult.visual_asset.provider === 'gemini'
                              ? '🍌 Google Imagen 3 (Nano Banana • 5-Star Luxury)'
                              : generatedResult.visual_asset.provider === 'recraft' && generatedResult.visual_asset.model === 'recraft-vector'
                              ? '📐 Recraft Vector Operational SOP Schematic'
                              : '✨ 5-Star Luxury Operational Visual'}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openVisualEditorForArticle}
                            className="h-6 text-[11px] text-ds-muted border-ds-ink-secondary bg-ds-ink"
                          >
                            <Palette className="w-3 h-3 me-1" /> Edit / Transform
                          </Button>
                        </div>
                        <div className="w-full flex items-center justify-center overflow-hidden rounded-lg">
                          {(() => {
                            const imgUrl = generatedResult.visual_asset?.image_url || ''
                            let rawSvg: string | null = null
                            if (imgUrl.startsWith('<svg') || imgUrl.includes('xmlns="http://www.w3.org/2000/svg"')) {
                              rawSvg = imgUrl
                            } else if (imgUrl.startsWith('data:image/svg+xml')) {
                              try {
                                const commaIdx = imgUrl.indexOf(',')
                                if (commaIdx !== -1) {
                                  const header = imgUrl.slice(0, commaIdx)
                                  const body = imgUrl.slice(commaIdx + 1)
                                  if (header.includes('base64')) {
                                    rawSvg = decodeURIComponent(escape(atob(body)))
                                  } else {
                                    rawSvg = decodeURIComponent(body)
                                  }
                                }
                              } catch {
                                try {
                                  rawSvg = decodeURIComponent(imgUrl.replace(/^data:image\/svg\+xml[^,]*,/, ''))
                                } catch {}
                              }
                            }

                            if (rawSvg) {
                              return (
                                <div
                                  className="w-full flex items-center justify-center p-2 [&>svg]:w-full [&>svg]:max-h-72 [&>svg]:h-auto [&>svg]:rounded-lg"
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } }) }}
                                />
                              )
                            }

                            return (
                              <img
                                src={imgUrl}
                                alt={generatedResult.title}
                                className="max-h-72 w-full object-contain rounded-md"
                              />
                            )
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-[8px] border border-dashed bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ImageIcon className="w-4 h-4 text-ds-accent" />
                          <span>No visual schematic attached to this article</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openVisualEditorForArticle}
                          className="h-7 text-xs font-semibold gap-1 text-ds-accent border-ds-accent/30"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Visual Guide
                        </Button>
                      </div>
                    )}

                    <div
                      className="p-5 rounded-[8px] border bg-card max-h-[380px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-start space-y-4"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedResult.content_html) }}
                    />
                  </TabsContent>

                  {/* Arabic Content */}
                  <TabsContent value="arabic" className="mt-3">
                    {generatedResult.content_html_ar ? (
                      <div
                        className="p-5 rounded-[8px] border bg-card max-h-[380px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-start space-y-4"
                        dir="rtl"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedResult.content_html_ar) }}
                      />
                    ) : (
                      <p className="rounded-[8px] border border-dashed p-5 text-sm text-muted-foreground">
                        {t('studio.noArabic', 'The AI did not write an Arabic version this time. Regenerate, or add the Arabic text in the editor.')}
                      </p>
                    )}
                  </TabsContent>

                  {/* Vector Schematic Tab */}
                  <TabsContent value="schematic" className="mt-3">
                    {generatedResult.visual_asset?.image_url ? (
                      <div className="p-4 rounded-[8px] border bg-ds-ink flex flex-col items-center justify-center space-y-3">
                        <div className="w-full max-h-[360px] flex items-center justify-center">
                          {(() => {
                            const imgUrl = generatedResult.visual_asset?.image_url || ''
                            let rawSvg: string | null = null
                            if (imgUrl.startsWith('<svg') || imgUrl.includes('xmlns="http://www.w3.org/2000/svg"')) {
                              rawSvg = imgUrl
                            } else if (imgUrl.startsWith('data:image/svg+xml')) {
                              try {
                                const commaIdx = imgUrl.indexOf(',')
                                if (commaIdx !== -1) {
                                  const header = imgUrl.slice(0, commaIdx)
                                  const body = imgUrl.slice(commaIdx + 1)
                                  if (header.includes('base64')) {
                                    rawSvg = decodeURIComponent(escape(atob(body)))
                                  } else {
                                    rawSvg = decodeURIComponent(body)
                                  }
                                }
                              } catch {
                                try {
                                  rawSvg = decodeURIComponent(imgUrl.replace(/^data:image\/svg\+xml[^,]*,/, ''))
                                } catch {}
                              }
                            }

                            if (rawSvg) {
                              return (
                                <div
                                  className="w-full flex items-center justify-center p-2 [&>svg]:w-full [&>svg]:max-h-80 [&>svg]:h-auto [&>svg]:rounded-lg"
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } }) }}
                                />
                              )
                            }

                            return (
                              <img
                                src={imgUrl}
                                alt={generatedResult.title}
                                className="max-h-80 w-full object-contain rounded-md"
                              />
                            )
                          })()}
                        </div>
                        <div className="flex items-center justify-between w-full pt-2 text-xs text-ds-muted">
                          <p className="italic">
                            {generatedResult.visual_asset.caption || generatedResult.visual_asset.alt_text}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openVisualEditorForArticle}
                            className="h-7 text-xs bg-ds-ink text-ds-on-ink border-ds-ink-secondary font-semibold"
                          >
                            <Palette className="w-3.5 h-3.5 me-1.5" />
                            Open Visual Editor
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-[8px] border border-dashed bg-muted/10 space-y-3 flex flex-col items-center justify-center">
                        <div className="p-3 rounded-full bg-ds-accent-soft text-ds-accent">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">No Visual Schematic Attached</p>
                          <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                            Generate a 5-star operational visual, SOP blueprint, or educational infographic for this article.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={openVisualEditorForArticle}
                          className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink text-xs font-bold gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Visual Guide
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  {/* Checklist Tab */}
                  <TabsContent value="checklist" className="mt-3 space-y-2 max-h-[380px] overflow-y-auto">
                    {generatedResult.checklist_items?.map((item, idx) => (
                      <div key={item.id || idx} className="p-3.5 rounded-[8px] border bg-card flex items-center justify-between text-xs text-start gap-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-ds-success shrink-0" />
                            <span>{item.text}</span>
                          </p>
                          <p className="text-muted-foreground text-[11px] ps-6" dir="rtl">{item.text_ar}</p>
                        </div>
                        {item.category && (
                          <Badge variant="outline" className="text-[11px] shrink-0">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </TabsContent>

                  {/* FAQ Tab */}
                  <TabsContent value="faq" className="mt-3 space-y-3 max-h-[380px] overflow-y-auto">
                    {generatedResult.faq_items?.map((faq, idx) => (
                      <div key={faq.id || idx} className="p-4 rounded-[8px] border bg-card space-y-2 text-xs text-start">
                        <p className="font-bold text-foreground">Q: {faq.question}</p>
                        <p className="text-muted-foreground leading-relaxed">A: {faq.answer}</p>
                        <div className="pt-2 border-t mt-2" dir="rtl">
                          <p className="font-bold text-ds-accent">س: {faq.question_ar}</p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">ج: {faq.answer_ar}</p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* QA & Compliance Scorecard */}
                  <TabsContent value="compliance" className="mt-3 space-y-4 max-h-[380px] overflow-y-auto">
                    <div className="p-4 rounded-[8px] border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{t('studio.keywordCheck', 'Keyword check')}</span>
                        <Badge variant="secondary" className="text-[11px] tabular-nums">
                          {generatedResult.compliance_score}/100
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t('studio.keywordCheckHint', 'An automatic check for topics Saudi hospitality rules usually require (Ministry of Tourism, Balady, Civil Defense). It is not a legal or regulatory review - have a qualified person approve the article before publishing.')}
                      </p>
                    </div>

                    {generatedResult.service_benchmarks && generatedResult.service_benchmarks.length > 0 && (
                      <div className="p-4 rounded-[8px] border bg-card space-y-2">
                        <span className="text-xs font-bold text-foreground">{t('studio.serviceBenchmarks', 'Service standards in this article')}</span>
                        <ul className="list-disc ps-5 text-xs text-muted-foreground space-y-1">
                          {generatedResult.service_benchmarks.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Critical Control Points */}
                    {generatedResult.critical_control_points && generatedResult.critical_control_points.length > 0 && (
                      <div className="p-4 rounded-[8px] border bg-muted/20 space-y-2">
                        <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-ds-warning" />
                          Critical Control Points (CCPs)
                        </h5>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {generatedResult.critical_control_points.map((ccp, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-ds-warning font-bold">•</span>
                              <span>{ccp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Models Used */}
                    <div className="p-3 rounded-lg border bg-card flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">AI Models Utilized:</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {generatedResult.models_used.map((m, idx) => (
                          <Badge key={idx} variant="outline" className="text-[11px] font-mono">
                            {m.split('/').pop()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between gap-2">
            {!generatedResult ? (
              <>
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!title.trim() || isGenerating}
                  className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink font-bold gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Writing your document…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      {contentType === 'policy' ? 'Create policy'
                        : contentType === 'checklist' ? 'Create checklist'
                        : contentType === 'faq' ? 'Create FAQ'
                        : 'Create document'}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGeneratedResult(null)}
                  className="gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate / Adjust Settings
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="bg-ds-success hover:bg-ds-success text-white dark:text-ds-on-ink font-bold gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply to Knowledge Article
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-5 border-b">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="w-4 h-4 text-ds-accent" />
              Generation History
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review and restore previously synthesized SOPs and articles from your current session.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {generationHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-[8px] border bg-card hover:bg-muted/20 transition-all flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-foreground">{item.article.title}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {item.article.content_type.toUpperCase()} • {t('studio.keywordCheck', 'Keyword check')}: {item.article.compliance_score}/100 • {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setGeneratedResult(item.article)
                    setShowHistory(false)
                  }}
                  className="h-7 text-xs font-semibold"
                >
                  Restore Version
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Visual Asset Editor Modal */}
      {selectedAssetForEditor && (
        <VisualAssetEditorModal
          open={visualEditorOpen}
          onOpenChange={(isOpen) => {
            setVisualEditorOpen(isOpen)
            if (!isOpen && !selectedAssetForEditor?.image_url) {
              setSelectedAssetForEditor(null)
            }
          }}
          asset={selectedAssetForEditor}
          onAssetUpdated={(updated) => {
            setSelectedAssetForEditor(updated)
            if (generatedResult) {
              setGeneratedResult({
                ...generatedResult,
                visual_asset: updated,
              })
            }
          }}
          onAssetDeleted={() => {
            setSelectedAssetForEditor(null)
            setVisualEditorOpen(false)
            if (generatedResult) {
              setGeneratedResult({
                ...generatedResult,
                visual_asset: undefined as any,
              })
            }
          }}
        />
      )}
    </>
  )
}
