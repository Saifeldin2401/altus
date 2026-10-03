import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { InlineBlockPreview } from './InlineBlockPreview'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  FileCheck,
  FileQuestion,
  FileText,
  Gamepad2,
  GripVertical,
  Headphones,
  Image as ImageIcon,
  LayoutTemplate,
  Link,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

type ContentType = 'text' | 'image' | 'video' | 'document_link' | 'audio' | 'quiz' | 'interactive' | 'sop_reference' | 'assignment' | 'practical' | 'roleplay'

interface ContentBlockForm {
  id: string
  type: ContentType
  content: string
  content_url: string
  content_data: Record<string, unknown>
  is_mandatory: boolean
  title: string
  duration?: number
  points?: number
  order: number
}

interface TrainingSection {
  id: string
  title: string
  description?: string
  items: ContentBlockForm[]
  order: number
}

interface BuilderCanvasProps {
  sections: TrainingSection[]
  activeSection: string | null
  onSectionClick: (id: string | null) => void
  onAddSection: () => void
  onDeleteSection: (id: string) => void
  onAddContent: (type: ContentType, sectionId: string) => void
  onEditContent: (sectionId: string, contentId: string) => void
  onDeleteContent: (sectionId: string, contentId: string) => void
  onReorderSection: (dragIndex: number, hoverIndex: number) => void
  onReorderContent: (sectionId: string, dragIndex: number, hoverIndex: number) => void
  onGenerateQuizFromSection?: (sectionId: string) => void
  onOpenAICreator?: () => void
  onOpenTemplateSelector?: () => void
  onRenameSection?: (sectionId: string, newTitle: string) => void
  onDuplicateSection?: (sectionId: string) => void
  onDeepExpandLesson?: (sectionId: string, contentId: string) => Promise<void>

  // Course details
  title?: string
  setTitle?: (v: string) => void
  description?: string
  setDescription?: (v: string) => void
  category?: string
  setCategory?: (v: string) => void
  audience?: string
  setAudience?: (v: string) => void
  difficultyLevel?: string
  setDifficultyLevel?: (v: string) => void
  contentLanguage?: string
  setContentLanguage?: (v: string) => void
}

const TYPE_ICONS: Record<ContentType, LucideIcon> = {
  text: FileText,
  video: Video,
  quiz: FileQuestion,
  roleplay: MessageSquare,
  assignment: FileCheck,
  practical: FileCheck,
  document_link: Link,
  sop_reference: BookOpen,
  image: ImageIcon,
  audio: Headphones,
  interactive: Gamepad2,
}

/** Lesson types offered when adding a lesson, in the order people reach for them. */
const ADDABLE_TYPES: ContentType[] = ['text', 'video', 'quiz', 'sop_reference', 'document_link', 'assignment', 'roleplay']

const HINT_KEYS: Partial<Record<ContentType, string>> = {
  text: 'text',
  video: 'video',
  quiz: 'quiz',
  roleplay: 'roleplay',
  assignment: 'assignment',
  document_link: 'document',
  sop_reference: 'policy',
}

const CATEGORY_KEYS = [
  'front_office',
  'housekeeping',
  'food_beverage',
  'culinary',
  'operations',
  'safety_security',
  'maintenance',
  'compliance',
  'onboarding',
  'skills',
] as const
const AUDIENCE_KEYS = ['all', 'new_hires', 'frontline', 'supervisors', 'management'] as const
const LEVEL_KEYS = ['beginner', 'intermediate', 'advanced'] as const
const LANGUAGE_KEYS = ['english', 'arabic', 'bilingual'] as const

export const BuilderCanvas = ({
  sections,
  activeSection,
  onSectionClick,
  onAddSection,
  onDeleteSection,
  onAddContent,
  onEditContent,
  onDeleteContent,
  onReorderSection,
  onReorderContent,
  onGenerateQuizFromSection,
  onOpenAICreator,
  onOpenTemplateSelector,
  onRenameSection,
  onDeepExpandLesson,
  title = '',
  setTitle,
  description = '',
  setDescription,
  category = '',
  setCategory,
  audience = 'all',
  setAudience,
  difficultyLevel = 'beginner',
  setDifficultyLevel,
  contentLanguage = 'english',
  setContentLanguage,
}: BuilderCanvasProps) => {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [expandingLessonId, setExpandingLessonId] = useState<string | null>(null)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [detailsOpen, setDetailsOpen] = useState<boolean>(!title.trim())
  const [pendingDelete, setPendingDelete] = useState<TrainingSection | null>(null)

  const typeLabel = (type: ContentType) =>
    t(`builder.editor.types.${type}`, { defaultValue: type.replace(/_/g, ' ') })
  const typeHint = (type: ContentType) =>
    HINT_KEYS[type] ? t(`builder.blockHints.${HINT_KEYS[type]}`, { defaultValue: '' }) : ''
  const minutes = (count: number) => t('builder.editor.stat.minutes', { count, defaultValue: '{{count}} min' })

  const toggleBlockPreview = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }, [])

  const setSectionPreviews = useCallback((section: TrainingSection, open: boolean) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev)
      section.items.forEach((item) => (open ? next.add(item.id) : next.delete(item.id)))
      return next
    })
  }, [])

  const allPreviewsOpen = (section: TrainingSection) =>
    section.items.length > 0 && section.items.every((item) => expandedBlocks.has(item.id))

  const totalLessons = sections.reduce((acc, s) => acc + s.items.length, 0)
  const totalQuizzes = sections.reduce((acc, s) => acc + s.items.filter((i) => i.type === 'quiz').length, 0)
  const sectionMinutes = (s: TrainingSection) => s.items.reduce((sum, item) => sum + (item.duration || 5), 0)
  const totalMinutes = sections.reduce((acc, s) => acc + sectionMinutes(s), 0)

  // Drag and drop (sections and lessons within a section)
  const handleDragStartSection = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('type', 'section')
    e.dataTransfer.setData('index', index.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragStartContent = (e: React.DragEvent, sectionId: string, index: number) => {
    e.stopPropagation()
    e.dataTransfer.setData('type', 'content')
    e.dataTransfer.setData('sectionId', sectionId)
    e.dataTransfer.setData('index', index.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropSection = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (e.dataTransfer.getData('type') !== 'section') return
    const dragIndex = parseInt(e.dataTransfer.getData('index'))
    if (isNaN(dragIndex) || dragIndex === dropIndex) return
    onReorderSection(dragIndex, dropIndex)
  }

  const handleDropContent = (e: React.DragEvent, dropSectionId: string, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.getData('type') !== 'content') return
    const dragSectionId = e.dataTransfer.getData('sectionId')
    const dragIndex = parseInt(e.dataTransfer.getData('index'))
    if (isNaN(dragIndex) || dragSectionId !== dropSectionId) return
    onReorderContent(dropSectionId, dragIndex, dropIndex)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const startRenaming = (section: TrainingSection) => {
    setEditingSectionId(section.id)
    setEditingTitle(section.title)
  }

  const saveRenaming = (sectionId: string) => {
    if (editingTitle.trim() && onRenameSection) onRenameSection(sectionId, editingTitle.trim())
    setEditingSectionId(null)
  }

  const requestDeleteSection = (section: TrainingSection) => {
    if (section.items.length === 0) onDeleteSection(section.id)
    else setPendingDelete(section)
  }

  const detailsSummary = [
    category ? t(`builder.editor.categories.${category}`, { defaultValue: category }) : null,
    t(`builder.editor.audiences.${audience}`, { defaultValue: audience }),
    t(`builder.editor.levels.${difficultyLevel}`, { defaultValue: difficultyLevel }),
    t(`builder.editor.languages.${contentLanguage}`, { defaultValue: contentLanguage }),
  ].filter(Boolean).join(' · ')
  const detailsMissing = !title.trim() || !category

  return (
    <div className="w-full flex-1 overflow-x-hidden bg-ds-surface-subtle p-3 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">

        {/* Course details */}
        <section className="rounded-[8px] border border-ds-border bg-ds-surface">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-start rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ds-muted">
                {t('builder.editor.details.title', 'Course details')}
              </p>
              <p className={cn('mt-0.5 truncate text-sm font-semibold', title.trim() ? 'text-ds-ink' : 'text-ds-muted')}>
                <bdi>{title.trim() || t('builder.editor.titlePlaceholder', 'Untitled course')}</bdi>
              </p>
              <p className="mt-0.5 truncate text-xs text-ds-muted">
                {detailsMissing ? (
                  <span className="inline-flex items-center gap-1.5 text-ds-warning-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-ds-warning" aria-hidden />
                    {t('builder.editor.details.missing', 'Add a name and department')}
                  </span>
                ) : (
                  detailsSummary
                )}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ds-ink-secondary">
              {detailsOpen ? t('builder.editor.details.done', 'Done') : t('builder.editor.details.edit', 'Edit')}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', detailsOpen && 'rotate-180')} />
            </span>
          </button>

          {detailsOpen && (
            <div className="space-y-4 border-t border-ds-border px-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="course-name" className="text-xs font-semibold text-ds-ink">
                  {t('builder.editor.titleLabel', 'Course name')} <span className="text-ds-danger" aria-hidden>*</span>
                </Label>
                <Input
                  id="course-name"
                  value={title}
                  onChange={(e) => setTitle?.(e.target.value)}
                  placeholder={t('builder.editor.details.namePlaceholder', 'e.g. Guest check-in standards')}
                  className="h-10 text-sm font-medium"
                  aria-required
                />
                <p className="text-[11px] text-ds-muted">
                  {t('builder.editor.details.nameHelp', 'Learners see this name in their training list and on certificates.')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {setCategory && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ds-ink">
                      {t('builder.editor.details.department', 'Department')} <span className="text-ds-danger" aria-hidden>*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder={t('builder.editor.details.department', 'Department')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{t(`builder.editor.categories.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {setAudience && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ds-ink">{t('builder.editor.details.audience', "Who it's for")}</Label>
                    <Select value={audience || 'all'} onValueChange={setAudience}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{t(`builder.editor.audiences.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {setDifficultyLevel && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ds-ink">{t('builder.editor.details.level', 'Level')}</Label>
                    <Select value={difficultyLevel || 'beginner'} onValueChange={setDifficultyLevel}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEVEL_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{t(`builder.editor.levels.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {setContentLanguage && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ds-ink">{t('builder.editor.details.language', 'Course language')}</Label>
                    <Select value={contentLanguage || 'english'} onValueChange={setContentLanguage}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{t(`builder.editor.languages.${key}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {setDescription && (
                <div className="space-y-1.5">
                  <Label htmlFor="course-description" className="text-xs font-semibold text-ds-ink">
                    {t('builder.editor.details.description', 'Description')}
                  </Label>
                  <Textarea
                    id="course-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('builder.editor.details.descriptionPlaceholder', 'What will people learn? Which standards does it cover?')}
                    className="resize-y text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sections and lessons */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ds-ink">
                {t('builder.editor.curriculum.title', 'Sections and lessons')}
              </h2>
              {sections.length > 0 ? (
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ds-muted">
                  {[
                    [t('builder.editor.stat.sections', 'Sections'), sections.length],
                    [t('builder.editor.stat.lessons', 'Lessons'), totalLessons],
                    [t('builder.editor.stat.quizzes', 'Quizzes'), totalQuizzes],
                    [t('builder.editor.stat.length', 'Length'), minutes(totalMinutes)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-baseline gap-1">
                      <dt>{label}</dt>
                      <dd className="font-semibold tabular-nums text-ds-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1 text-xs text-ds-muted">
                  {t('builder.editor.curriculum.hint', 'Learners go through sections in this order. Drag to reorder.')}
                </p>
              )}
            </div>
            {sections.length > 0 && (
              <Button onClick={onAddSection} size="sm" variant="outline" className="h-8">
                <Plus className="h-3.5 w-3.5" />
                {t('builder.editor.addSection', 'Add section')}
              </Button>
            )}
          </div>

          {sections.length === 0 ? (
            <div className="rounded-[8px] border border-ds-border bg-ds-surface p-5 md:p-6">
              <h3 className="text-sm font-semibold text-ds-ink">{t('builder.editor.empty.title', 'How do you want to start?')}</h3>
              <p className="mt-1 text-xs text-ds-muted">{t('builder.editor.empty.desc', 'You can change everything afterwards.')}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  onOpenAICreator && {
                    key: 'ai',
                    icon: Sparkles,
                    iconClass: 'text-ds-accent',
                    onClick: onOpenAICreator,
                  },
                  onOpenTemplateSelector && {
                    key: 'template',
                    icon: LayoutTemplate,
                    iconClass: 'text-ds-ink-secondary',
                    onClick: onOpenTemplateSelector,
                  },
                  { key: 'blank', icon: Plus, iconClass: 'text-ds-ink-secondary', onClick: onAddSection },
                ]
                  .filter((o): o is { key: string; icon: LucideIcon; iconClass: string; onClick: () => void } => Boolean(o))
                  .map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={option.onClick}
                      className="group flex flex-col items-start gap-3 rounded-[8px] border border-ds-border bg-ds-surface p-4 text-start transition-colors hover:border-ds-border-strong hover:bg-ds-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-ds-border bg-ds-surface-subtle">
                        <option.icon className={cn('h-4 w-4', option.iconClass)} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ds-ink">{t(`builder.editor.empty.${option.key}.title`)}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-ds-muted">{t(`builder.editor.empty.${option.key}.desc`)}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-3">
              {sections.map((section, sectionIndex) => {
                const isExpanded = activeSection === null || activeSection === section.id
                const isEditing = editingSectionId === section.id
                const previewsOpen = allPreviewsOpen(section)

                return (
                  <li
                    key={section.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStartSection(e, sectionIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropSection(e, sectionIndex)}
                    className="overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface"
                  >
                    {/* Section header */}
                    <div className={cn('flex items-center gap-2 px-2 py-2 sm:px-3', isExpanded && 'border-b border-ds-border')}>
                      <span className="hidden cursor-grab text-ds-muted/60 hover:text-ds-muted active:cursor-grabbing sm:block" aria-hidden>
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <button
                        type="button"
                        onClick={() => onSectionClick(activeSection === section.id ? null : section.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? t('builder.editor.section.collapse', 'Hide lessons') : t('builder.editor.section.expand', 'Show lessons')}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-ds-muted hover:bg-ds-surface-subtle hover:text-ds-ink"
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', !isExpanded && '-rotate-90 rtl:rotate-90')} />
                      </button>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ds-surface-subtle text-[11px] font-semibold tabular-nums text-ds-ink-secondary">
                        {sectionIndex + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <Input
                            value={editingTitle}
                            autoFocus
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => saveRenaming(section.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRenaming(section.id)
                              if (e.key === 'Escape') setEditingSectionId(null)
                            }}
                            aria-label={t('builder.editor.section.rename', 'Rename')}
                            className="h-8 text-sm font-semibold"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startRenaming(section)}
                            className="group/title flex max-w-full items-center gap-1.5 rounded-[6px] px-1 text-start"
                            title={t('builder.editor.section.rename', 'Rename')}
                          >
                            <span className="truncate text-sm font-semibold text-ds-ink">
                              <bdi>{section.title || t('builder.editor.section.untitled', 'Untitled section')}</bdi>
                            </span>
                            <Pencil className="h-3 w-3 shrink-0 text-ds-muted opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100" />
                          </button>
                        )}
                        <p className="px-1 text-[11px] text-ds-muted">
                          {t('builder.editor.stat.lessons', 'Lessons')} <span className="tabular-nums">{section.items.length}</span>
                          {section.items.length > 0 && <> · {minutes(sectionMinutes(section))}</>}
                        </p>
                      </div>

                      {onGenerateQuizFromSection && section.items.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="hidden h-8 px-2 text-xs sm:inline-flex"
                          onClick={() => onGenerateQuizFromSection(section.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-ds-accent" />
                          {t('builder.editor.section.quizWithAi', 'Quiz with AI')}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-8 w-8 text-ds-muted hover:text-ds-ink"
                            aria-label={t('builder.editor.section.more', 'Section actions')}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem className="gap-2" onSelect={() => startRenaming(section)}>
                            <Pencil className="h-3.5 w-3.5" />
                            {t('builder.editor.section.rename', 'Rename')}
                          </DropdownMenuItem>
                          {onGenerateQuizFromSection && section.items.length > 0 && (
                            <DropdownMenuItem className="gap-2 sm:hidden" onSelect={() => onGenerateQuizFromSection(section.id)}>
                              <Sparkles className="h-3.5 w-3.5" />
                              {t('builder.editor.section.quizWithAi', 'Quiz with AI')}
                            </DropdownMenuItem>
                          )}
                          {section.items.length > 0 && (
                            <DropdownMenuItem className="gap-2" onSelect={() => setSectionPreviews(section, !previewsOpen)}>
                              {previewsOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {previewsOpen
                                ? t('builder.editor.section.hidePreviews', 'Hide all previews')
                                : t('builder.editor.section.showPreviews', 'Show all previews')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2"
                            disabled={sectionIndex === 0}
                            onSelect={() => onReorderSection(sectionIndex, sectionIndex - 1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                            {t('builder.editor.section.moveUp', 'Move up')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2"
                            disabled={sectionIndex === sections.length - 1}
                            onSelect={() => onReorderSection(sectionIndex, sectionIndex + 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                            {t('builder.editor.section.moveDown', 'Move down')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-ds-danger focus:text-ds-danger"
                            onSelect={() => requestDeleteSection(section)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('builder.editor.section.delete', 'Delete section')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Lessons */}
                    {isExpanded && (
                      <div className="space-y-2 p-3">
                        {section.items.length === 0 ? (
                          <div className="rounded-[8px] border border-dashed border-ds-border p-4">
                            <p className="text-xs text-ds-muted">
                              {t('builder.editor.section.empty', 'No lessons in this section yet. Add the first one:')}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {ADDABLE_TYPES.map((type) => {
                                const Icon = TYPE_ICONS[type]
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => onAddContent(type, section.id)}
                                    title={typeHint(type)}
                                    className="flex items-center gap-2 rounded-[6px] border border-ds-border bg-ds-surface px-2.5 py-2 text-start text-xs font-medium text-ds-ink transition-colors hover:border-ds-border-strong hover:bg-ds-surface-subtle"
                                  >
                                    <Icon className="h-3.5 w-3.5 shrink-0 text-ds-ink-secondary" />
                                    <span className="truncate">{typeLabel(type)}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {section.items.map((item, itemIndex) => {
                              const Icon = TYPE_ICONS[item.type] ?? FileText
                              const isBlockExpanded = expandedBlocks.has(item.id)
                              const hasPreviewableContent = Boolean(item.content || item.content_url || item.type === 'quiz')
                              const isExpanding = expandingLessonId === item.id

                              return (
                                <li
                                  key={item.id}
                                  draggable={!isBlockExpanded}
                                  onDragStart={(e) => handleDragStartContent(e, section.id, itemIndex)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDropContent(e, section.id, itemIndex)}
                                  className={cn(
                                    'group overflow-hidden rounded-[6px] border bg-ds-surface transition-colors',
                                    isBlockExpanded ? 'border-ds-border-strong' : 'border-ds-border hover:border-ds-border-strong'
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                                    <span className="hidden cursor-grab text-ds-muted/50 group-hover:text-ds-muted active:cursor-grabbing sm:block" aria-hidden>
                                      <GripVertical className="h-4 w-4" />
                                    </span>
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-ds-surface-subtle">
                                      <Icon className="h-4 w-4 text-ds-ink-secondary" />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onEditContent(section.id, item.id)}
                                      className="min-w-0 flex-1 text-start"
                                    >
                                      <span className="block truncate text-sm font-medium text-ds-ink">
                                        <bdi>{item.title || t('builder.editor.lesson.untitled', 'Untitled lesson')}</bdi>
                                      </span>
                                      <span className="block truncate text-[11px] text-ds-muted">
                                        {typeLabel(item.type)}
                                        {' · '}
                                        {item.is_mandatory
                                          ? t('builder.editor.lesson.required', 'Required')
                                          : t('builder.editor.lesson.optional', 'Optional')}
                                        {item.duration ? <> · {minutes(item.duration)}</> : null}
                                      </span>
                                    </button>

                                    <div className="flex shrink-0 items-center gap-1">
                                      {hasPreviewableContent && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className={cn('hidden h-8 px-2 text-xs sm:inline-flex', isBlockExpanded && 'bg-ds-surface-subtle')}
                                          onClick={() => toggleBlockPreview(item.id)}
                                          aria-expanded={isBlockExpanded}
                                        >
                                          {isBlockExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                          {isBlockExpanded
                                            ? t('builder.editor.lesson.hide', 'Hide')
                                            : t('builder.editor.lesson.preview', 'Preview')}
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2.5 text-xs"
                                        onClick={() => onEditContent(section.id, item.id)}
                                      >
                                        {t('builder.editor.lesson.edit', 'Edit')}
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            className="h-8 w-8 text-ds-muted hover:text-ds-ink"
                                            aria-label={t('builder.editor.lesson.more', 'Lesson actions')}
                                          >
                                            {isExpanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                          {hasPreviewableContent && (
                                            <DropdownMenuItem className="gap-2 sm:hidden" onSelect={() => toggleBlockPreview(item.id)}>
                                              {isBlockExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                              {isBlockExpanded
                                                ? t('builder.editor.lesson.hide', 'Hide')
                                                : t('builder.editor.lesson.preview', 'Preview')}
                                            </DropdownMenuItem>
                                          )}
                                          {item.type === 'text' && onDeepExpandLesson && (
                                            <DropdownMenuItem className="gap-2"
                                              disabled={isExpanding}
                                              onSelect={async () => {
                                                setExpandingLessonId(item.id)
                                                try {
                                                  await onDeepExpandLesson(section.id, item.id)
                                                } finally {
                                                  setExpandingLessonId(null)
                                                }
                                              }}
                                            >
                                              <Sparkles className="h-3.5 w-3.5" />
                                              {isExpanding
                                                ? t('builder.editor.lesson.expanding', 'Expanding…')
                                                : t('builder.editor.lesson.expandWithAi', 'Expand with AI')}
                                            </DropdownMenuItem>
                                          )}
                                          {(hasPreviewableContent || (item.type === 'text' && onDeepExpandLesson)) && <DropdownMenuSeparator />}
                                          <DropdownMenuItem
                                            className="gap-2 text-ds-danger focus:text-ds-danger"
                                            onSelect={() => onDeleteContent(section.id, item.id)}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            {t('builder.editor.lesson.delete', 'Delete lesson')}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                  {isBlockExpanded && (
                                    <div className="border-t border-ds-border bg-ds-surface-subtle/50">
                                      <InlineBlockPreview
                                        block={item}
                                        isRTL={isRTL}
                                        onRegenerateQuiz={onGenerateQuizFromSection ? () => onGenerateQuizFromSection(section.id) : undefined}
                                      />
                                    </div>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}

                        {section.items.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-ds-ink-secondary">
                                <Plus className="h-3.5 w-3.5" />
                                {t('builder.editor.section.addLesson', 'Add lesson')}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                              {ADDABLE_TYPES.map((type) => {
                                const Icon = TYPE_ICONS[type]
                                const hint = typeHint(type)
                                return (
                                  <DropdownMenuItem key={type} onSelect={() => onAddContent(type, section.id)} className="gap-2 items-start">
                                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium">{typeLabel(type)}</span>
                                      {hint && <span className="block text-[11px] text-ds-muted">{hint}</span>}
                                    </span>
                                  </DropdownMenuItem>
                                )
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          {sections.length > 0 && (
            <button
              type="button"
              onClick={onAddSection}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-ds-border p-3 text-xs font-semibold text-ds-muted transition-colors hover:border-ds-border-strong hover:bg-ds-surface hover:text-ds-ink"
            >
              <Plus className="h-4 w-4" />
              {t('builder.editor.addAnotherSection', 'Add another section')}
            </button>
          )}
        </section>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.editor.section.deleteTitle', 'Delete this section?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('builder.editor.section.deleteDesc', {
                count: pendingDelete?.items.length ?? 0,
                defaultValue: 'The section and its {{count}} lessons will be removed from this course. You can bring them back with Undo.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ds-danger text-white hover:bg-ds-danger/90"
              onClick={() => {
                if (pendingDelete) onDeleteSection(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              {t('builder.editor.section.deleteConfirm', 'Delete section')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
