/**
 * KnowledgeBaseSidebar
 * 
 * Enhanced side panel for Training Builder that shows:
 * - Searchable & filterable Knowledge Base SOPs and documents with dedicated search button
 * - Content-type and department filtering
 * - In-builder SOP Quick Preview Dialog
 * - One-click SOP linking & AI generation
 * - Quizzes and Question Bank integration
 */

import { ArticleContent } from '@/components/knowledge/ArticleContent'
import {
    ChecklistRenderer,
    FAQAccordion,
    ImageGalleryRenderer,
    VideoPlayer
} from '@/components/knowledge/ContentRenderers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAITrainingContent } from '@/hooks/training/useAITrainingContent'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ChecklistItem, FAQItem } from '@/types/knowledge'
import { useQuery } from '@tanstack/react-query'
import {
    BookOpen,
    Building2,
    CheckSquare,
    ClipboardCheck,
    Eye,
    FileCheck,
    FileText,
    Film,
    HelpCircle,
    Link2,
    Loader2,
    Plus,
    Search,
    Sparkles,
    X,
    Zap
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface KnowledgeBaseSidebarProps {
    moduleId?: string
    moduleTopic?: string
    onInsertContent?: (content: { type: string; title: string; content: string; sourceId?: string }) => void
    onLinkDocument?: (documentId: string, documentTitle?: string) => void
    onLinkQuiz?: (quizId: string, quizTitle?: string) => void
    onAddQuestions?: (questionIds: string[]) => void
    onClose?: () => void
    className?: string
}

type KBArticleItem = {
    id: string
    title: string
    title_ar?: string | null
    description?: string | null
    description_ar?: string | null
    content?: string | null
    content_ar?: string | null
    summary?: string | null
    content_type: string
    sop_code?: string | null
    status?: string | null
    file_url?: string | null
    video_url?: string | null
    checklist_items?: ChecklistItem[] | null
    faq_items?: FAQItem[] | null
    images?: Array<{
        id: string
        url: string
        caption: string
        order: number
    }> | null
    department_id?: string | null
    updated_at?: string | null
    department?: { id: string; name: string } | null
    category?: { id: string; name: string } | null
}

const CONTENT_TYPES = [
    { value: 'all', labelKey: 'knowledgeBase.allTypes', defaultLabel: 'All Types' },
    { value: 'sop', labelKey: 'knowledgeBase.sops', defaultLabel: 'SOPs' },
    { value: 'policy', labelKey: 'knowledgeBase.policies', defaultLabel: 'Policies' },
    { value: 'checklist', labelKey: 'knowledgeBase.checklists', defaultLabel: 'Checklists' },
    { value: 'faq', labelKey: 'knowledgeBase.faqs', defaultLabel: 'FAQs' },
    { value: 'video', labelKey: 'videoContent', defaultLabel: 'Videos' }
]

export function KnowledgeBaseSidebar({
    moduleTopic = '',
    onInsertContent,
    onLinkDocument,
    onLinkQuiz,
    onAddQuestions,
    onClose,
    className
}: KnowledgeBaseSidebarProps) {
    const { t, i18n } = useTranslation('training')
    const isRTL = i18n.dir() === 'rtl'

    const [searchInput, setSearchInput] = useState('')
    const [activeSearch, setActiveSearch] = useState('')
    const [selectedType, setSelectedType] = useState('all')
    const [selectedDept, setSelectedDept] = useState('all')
    const [activeTab, setActiveTab] = useState('documents')
    const [generatingFor, setGeneratingFor] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<KBArticleItem | null>(null)

    // Debounced fallback typing query
    const debouncedTyping = useDebounce(searchInput, 400)
    const effectiveSearch = (activeSearch || debouncedTyping).trim()

    const { generateFromDocument, generating: aiGenerating } = useAITrainingContent()

    // Fetch available departments for filtering
    const { data: departments } = useQuery({
        queryKey: ['kb-sidebar-departments'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('id, name')
                .order('name')
            if (error) throw error
            return data || []
        },
        staleTime: 5 * 60 * 1000
    })

    // Fetch related documents / SOPs
    const { data: documents, isLoading: docsLoading, refetch: refetchDocs } = useQuery({
        queryKey: ['kb-documents-enhanced', effectiveSearch, moduleTopic, selectedType, selectedDept],
        queryFn: async () => {
            let query = supabase
                .from('documents')
                .select(`
                    id, title, title_ar, description, description_ar, content, content_ar, summary,
                    content_type, sop_code, status, file_url, video_url, checklist_items, faq_items, images,
                    department_id, updated_at,
                    department:departments(id, name),
                    category:categories!documents_category_id_fkey(id, name)
                `)
                .in('status', ['PUBLISHED', 'APPROVED'])
                .or('is_deleted.is.null,is_deleted.eq.false')
                .order('updated_at', { ascending: false })
                .limit(40)

            if (selectedType && selectedType !== 'all') {
                query = query.eq('content_type', selectedType)
            }

            if (selectedDept && selectedDept !== 'all') {
                query = query.eq('department_id', selectedDept)
            }

            const searchFilter = effectiveSearch || (!selectedType || selectedType === 'all' ? moduleTopic : '')
            if (searchFilter) {
                query = query.or(`title.ilike.%${searchFilter}%,description.ilike.%${searchFilter}%,sop_code.ilike.%${searchFilter}%`)
            }

            const { data, error } = await query
            if (error) throw error
            return (data || []) as unknown as KBArticleItem[]
        }
    })

    // Fetch related quizzes
    const { data: quizzes, isLoading: quizzesLoading } = useQuery({
        queryKey: ['kb-quizzes-enhanced', effectiveSearch, moduleTopic],
        queryFn: async () => {
            let query = supabase
                .from('quizzes')
                .select('id, title, description, passing_score_percentage, questions:unified_quiz_questions(count)')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(20)

            const searchFilter = effectiveSearch || moduleTopic
            if (searchFilter) {
                query = query.or(`title.ilike.%${searchFilter}%,description.ilike.%${searchFilter}%`)
            }

            const { data, error } = await query
            if (error) throw error
            return (data || []).map((quiz) => ({
                ...quiz,
                question_count: quiz.questions?.[0]?.count ?? 0
            }))
        }
    })

    // Fetch related questions
    const { data: questions, isLoading: questionsLoading } = useQuery({
        queryKey: ['kb-questions-enhanced', effectiveSearch, moduleTopic],
        queryFn: async () => {
            let query = supabase
                .from('knowledge_questions')
                .select('id, question_text, question_type, difficulty_level')
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(40)

            const searchFilter = effectiveSearch || moduleTopic
            if (searchFilter) {
                query = query.ilike('question_text', `%${searchFilter}%`)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        }
    })

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setActiveSearch(searchInput.trim())
        refetchDocs()
    }

    const handleClearSearch = () => {
        setSearchInput('')
        setActiveSearch('')
        refetchDocs()
    }

    const handleGenerateFromDoc = async (doc: KBArticleItem) => {
        setGeneratingFor(doc.id)
        const result = await generateFromDocument(doc.id, { format: 'training_text' })
        setGeneratingFor(null)

        if (result && onInsertContent) {
            onInsertContent({
                type: 'ai_generated',
                title: result.title,
                content: result.content,
                sourceId: doc.id
            })
        }
    }

    const getDocTypeBadge = (type: string) => {
        switch (type) {
            case 'sop':
                return (
                    <Badge variant="outline" className="text-[11px] font-bold text-ds-success bg-ds-success-soft border-ds-success/30">
                        <FileCheck className="h-3 w-3 me-1" />
                        SOP
                    </Badge>
                )
            case 'policy':
                return (
                    <Badge variant="outline" className="text-[11px] font-bold text-ds-accent bg-ds-accent-soft border-ds-accent/30">
                        <BookOpen className="h-3 w-3 me-1" />
                        Policy
                    </Badge>
                )
            case 'checklist':
                return (
                    <Badge variant="outline" className="text-[11px] font-bold text-ds-info bg-ds-info-soft border-ds-info/30">
                        <CheckSquare className="h-3 w-3 me-1" />
                        Checklist
                    </Badge>
                )
            case 'faq':
                return (
                    <Badge variant="outline" className="text-[11px] font-bold text-ds-warning bg-ds-warning-soft border-ds-warning/30">
                        <HelpCircle className="h-3 w-3 me-1" />
                        FAQ
                    </Badge>
                )
            case 'video':
                return (
                    <Badge variant="outline" className="text-[11px] font-bold text-ds-danger bg-ds-danger-soft border-ds-danger/30">
                        <Film className="h-3 w-3 me-1" />
                        Video
                    </Badge>
                )
            default:
                return (
                    <Badge variant="outline" className="text-[11px] font-medium text-ds-ink-secondary bg-ds-surface-subtle border-ds-border">
                        <FileText className="h-3 w-3 me-1" />
                        {type || 'Doc'}
                    </Badge>
                )
        }
    }

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'easy': return 'bg-ds-success-soft text-ds-success'
            case 'medium': return 'bg-ds-warning-soft text-ds-warning'
            case 'hard': return 'bg-ds-warning-soft text-ds-warning'
            case 'expert': return 'bg-ds-danger-soft text-ds-danger'
            default: return 'bg-ds-surface-subtle text-ds-ink-secondary'
        }
    }

    const docCount = documents?.length ?? 0
    const quizCount = quizzes?.length ?? 0
    const questionCount = questions?.length ?? 0

    return (
        <>
            <Card className={cn("h-full flex flex-col border-0 rounded-none shadow-none bg-background", className)}>
                {/* 1. Header with Title & Close */}
                <CardHeader className="p-4 pb-3 border-b border-ds-border bg-ds-surface-subtle/50">
                    <div className={cn("flex items-center justify-between gap-2", "flex-row")}>
                        <CardTitle className={cn("text-base font-bold text-ds-ink flex items-center gap-2", "flex-row")}>
                            <div className="p-1.5 rounded-lg bg-ds-ink/10 dark:bg-ds-accent/10 text-ds-ink dark:text-ds-accent">
                                <BookOpen className="h-4 w-4" />
                            </div>
                            <span>{t('knowledgeBase.title', 'Knowledge Base Bank')}</span>
                        </CardTitle>

                        {onClose && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-ds-muted hover:text-ds-ink"
                                onClick={onClose}
                                aria-label="Close knowledge base panel"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* 2. Search Bar with Dedicated Search Button */}
                    <form onSubmit={handleSearchSubmit} className="mt-3 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-ds-muted pointer-events-none", "start-3")} />
                            <Input
                                placeholder={t('knowledgeBase.searchResources', 'Search SOPs, policies, checklists...')}
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className={cn(
                                    "h-9 text-xs bg-ds-surface border-ds-border shadow-sm focus-visible:ring-ds-ink",
                                    "ps-9 pe-8 text-start"
                                )}
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className={cn("absolute top-1/2 -translate-y-1/2 p-1 text-ds-muted hover:text-ds-ink-secondary", "end-2")}
                                    aria-label="Clear search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <Button
                            type="submit"
                            size="sm"
                            className="h-9 px-3 text-xs bg-ds-ink hover:bg-ds-ink text-ds-on-ink font-semibold shrink-0 shadow-sm flex items-center gap-1.5"
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span>{t('knowledgeBase.search', 'Search')}</span>
                        </Button>
                    </form>

                    {/* 3. Filters for Content Type and Department */}
                    <div className="mt-3 space-y-2">
                        {/* Type chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            {CONTENT_TYPES.map((type) => {
                                const isSelected = selectedType === type.value
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setSelectedType(type.value)}
                                        className={cn(
                                            "px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all shrink-0",
                                            isSelected
                                                ? "bg-ds-ink text-ds-on-ink border-ds-ink shadow-xs dark:bg-ds-accent dark:text-ds-ink dark:border-ds-accent"
                                                : "bg-ds-surface text-ds-ink-secondary border-ds-border hover:bg-ds-surface-subtle"
                                        )}
                                    >
                                        {t(type.labelKey, type.defaultLabel)}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Department selector */}
                        {departments && departments.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-ds-muted shrink-0" />
                                <Select value={selectedDept} onValueChange={setSelectedDept}>
                                    <SelectTrigger className="h-7 text-[11px] bg-ds-surface border-ds-border">
                                        <SelectValue placeholder={t('knowledgeBase.allDepartments', 'All Departments')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="text-xs">
                                            {t('knowledgeBase.allDepartments', 'All Departments')}
                                        </SelectItem>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id} className="text-xs">
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </CardHeader>

                {/* 4. Tabs Section */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 pt-2 border-b border-ds-border bg-ds-surface">
                        <TabsList className={cn("w-full grid grid-cols-3 h-9 bg-ds-surface-subtle", isRTL ? "direction-rtl" : "")}>
                            <TabsTrigger value="documents" className="text-xs font-semibold data-[state=active]:bg-ds-surface dark:data-[state=active]:bg-ds-ink">
                                <FileText className={cn("h-3.5 w-3.5", "me-1")} />
                                <span>{t('knowledgeBase.docs', 'SOPs & Docs')}</span>
                                {docCount > 0 && (
                                    <span className="ms-1.5 px-1.5 py-0.2 text-[11px] rounded-full bg-ds-border font-bold">
                                        {docCount}
                                    </span>
                                )}
                            </TabsTrigger>

                            <TabsTrigger value="quizzes" className="text-xs font-semibold data-[state=active]:bg-ds-surface dark:data-[state=active]:bg-ds-ink">
                                <ClipboardCheck className={cn("h-3.5 w-3.5", "me-1")} />
                                <span>{t('knowledgeBase.quizzes', 'Quizzes')}</span>
                                {quizCount > 0 && (
                                    <span className="ms-1.5 px-1.5 py-0.2 text-[11px] rounded-full bg-ds-border font-bold">
                                        {quizCount}
                                    </span>
                                )}
                            </TabsTrigger>

                            <TabsTrigger value="questions" className="text-xs font-semibold data-[state=active]:bg-ds-surface dark:data-[state=active]:bg-ds-ink">
                                <HelpCircle className={cn("h-3.5 w-3.5", "me-1")} />
                                <span>{t('knowledgeBase.qa', 'Question Bank')}</span>
                                {questionCount > 0 && (
                                    <span className="ms-1.5 px-1.5 py-0.2 text-[11px] rounded-full bg-ds-border font-bold">
                                        {questionCount}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 px-4 py-3">
                        {/* Tab 1: SOPs & Documents */}
                        <TabsContent value="documents" className="mt-0 space-y-2.5">
                            {docsLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-3 rounded-[8px] border border-ds-border space-y-2 bg-ds-surface">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                        <div className="flex gap-2 pt-1">
                                            <Skeleton className="h-7 w-20" />
                                            <Skeleton className="h-7 w-20" />
                                        </div>
                                    </div>
                                ))
                            ) : documents?.length === 0 ? (
                                <div className="text-center py-12 px-4 text-ds-muted space-y-2">
                                    <FileCheck className="h-10 w-10 mx-auto text-ds-muted" />
                                    <p className="font-semibold text-sm text-ds-ink-secondary">
                                        {t('knowledgeBase.noDocuments', 'No documents found')}
                                    </p>
                                    <p className="text-xs text-ds-muted">
                                        {t('knowledgeBase.noResultsFilter', 'No resources match your search or filter.')}
                                    </p>
                                    {(searchInput || selectedType !== 'all' || selectedDept !== 'all') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSearchInput('')
                                                setActiveSearch('')
                                                setSelectedType('all')
                                                setSelectedDept('all')
                                            }}
                                            className="text-xs mt-2"
                                        >
                                            {t('knowledgeBase.clearSearch', 'Clear search & filters')}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                documents?.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="p-3.5 rounded-[8px] border border-ds-border/80 bg-ds-surface hover:border-ds-accent hover:shadow-xs transition-all space-y-2.5"
                                    >
                                        <div className={cn("flex items-start gap-2.5", "flex-row text-start")}>
                                            <div className="flex-1 min-w-0">
                                                {/* Badge Row */}
                                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                    {getDocTypeBadge(doc.content_type)}
                                                    {doc.sop_code && (
                                                        <Badge variant="outline" className="text-[11px] font-mono font-bold bg-ds-surface-subtle text-ds-ink-secondary">
                                                            {doc.sop_code}
                                                        </Badge>
                                                    )}
                                                    {doc.department?.name && (
                                                        <span className="text-[11px] bg-ds-surface-subtle text-ds-ink-secondary px-1.5 py-0.5 rounded font-medium">
                                                            {doc.department.name}
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="font-bold text-sm text-ds-ink leading-snug">
                                                    {doc.title}
                                                </h4>

                                                {doc.description && (
                                                    <p className="text-xs text-ds-muted line-clamp-2 mt-0.5">
                                                        {doc.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5 pt-1 border-t border-ds-border">
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs flex-1 bg-ds-success hover:bg-ds-success text-white dark:text-ds-on-ink font-semibold"
                                                onClick={() => onLinkDocument?.(doc.id, doc.title)}
                                            >
                                                <Link2 className={cn("h-3.5 w-3.5", "me-1")} />
                                                {t('knowledgeBase.linkSop', 'Link SOP')}
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs px-2.5 border-ds-border text-ds-ink-secondary hover:text-ds-ink hover:border-ds-accent"
                                                onClick={() => setPreviewDoc(doc)}
                                            >
                                                <Eye className={cn("h-3.5 w-3.5", "me-1")} />
                                                {t('knowledgeBase.preview', 'Preview')}
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 text-xs px-2.5 bg-ds-ink/10 hover:bg-ds-ink/20 text-ds-ink dark:bg-ds-accent/10 dark:text-ds-accent font-medium"
                                                onClick={() => handleGenerateFromDoc(doc)}
                                                disabled={aiGenerating && generatingFor === doc.id}
                                                title={t('knowledgeBase.aiSummary', 'Generate lesson summary from SOP')}
                                            >
                                                {aiGenerating && generatingFor === doc.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        {/* Tab 2: Quizzes */}
                        <TabsContent value="quizzes" className="mt-0 space-y-2.5">
                            {quizzesLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full rounded-[8px]" />
                                ))
                            ) : quizzes?.length === 0 ? (
                                <div className="text-center py-12 text-ds-muted space-y-2">
                                    <ClipboardCheck className="h-10 w-10 mx-auto text-ds-muted" />
                                    <p className="font-semibold text-sm">{t('knowledgeBase.noQuizzes', 'No quizzes found')}</p>
                                </div>
                            ) : (
                                quizzes?.map((quiz) => (
                                    <div
                                        key={quiz.id}
                                        className="p-3.5 rounded-[8px] border border-ds-border/80 bg-ds-surface hover:border-ds-accent/60 transition-all flex items-center justify-between gap-3"
                                    >
                                        <div className={cn("flex-1 min-w-0", "text-start")}>
                                            <h4 className="font-bold text-sm text-ds-ink truncate">
                                                {quiz.title}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-ds-muted">
                                                <Badge variant="outline" className="text-[11px] font-semibold">
                                                    {t('knowledgeBase.questionsCount', { count: quiz.question_count || 0 })}
                                                </Badge>
                                                {quiz.passing_score_percentage && (
                                                    <span className="text-[11px] font-medium text-ds-success">
                                                        {quiz.passing_score_percentage}% pass
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            className="h-8 text-xs bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink font-semibold shrink-0"
                                            onClick={() => onLinkQuiz?.(quiz.id, quiz.title)}
                                        >
                                            <Link2 className={cn("h-3.5 w-3.5", "me-1")} />
                                            {t('knowledgeBase.link', 'Link')}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        {/* Tab 3: Question Bank */}
                        <TabsContent value="questions" className="mt-0 space-y-2.5">
                            {questionsLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full rounded-[8px]" />
                                ))
                            ) : questions?.length === 0 ? (
                                <div className="text-center py-12 text-ds-muted space-y-2">
                                    <HelpCircle className="h-10 w-10 mx-auto text-ds-muted" />
                                    <p className="font-semibold text-sm">{t('knowledgeBase.noQuestions', 'No questions found')}</p>
                                </div>
                            ) : (
                                <>
                                    {questions && questions.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn("w-full mb-2 h-8 text-xs font-bold text-ds-ink border-ds-ink/30", "flex-row")}
                                            onClick={() => onAddQuestions?.(questions.map(q => q.id))}
                                        >
                                            <Plus className={cn("h-3.5 w-3.5", "me-1.5")} />
                                            {t('knowledgeBase.addAll', { count: questions.length, defaultValue: `Add All Questions (${questions.length})` })}
                                        </Button>
                                    )}

                                    {questions?.map((q) => (
                                        <div
                                            key={q.id}
                                            className="p-3 rounded-[8px] border border-ds-border/80 bg-ds-surface hover:border-ds-accent/60 transition-all flex items-start justify-between gap-3"
                                        >
                                            <div className={cn("flex-1 min-w-0", "text-start")}>
                                                <p className="text-xs font-medium text-ds-ink line-clamp-2 leading-relaxed">
                                                    {q.question_text}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <Badge variant="outline" className="text-[11px]">
                                                        {q.question_type}
                                                    </Badge>
                                                    <Badge className={cn("text-[11px]", getDifficultyColor(q.difficulty_level))}>
                                                        {q.difficulty_level}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs text-ds-ink border-ds-border shrink-0"
                                                onClick={() => onAddQuestions?.([q.id])}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </Card>

            {/* 5. Quick Preview Modal */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-ds-surface border-ds-border shadow-2xl">
                    {previewDoc && (
                        <>
                            <DialogHeader className="p-5 pb-3 border-b border-ds-border bg-ds-surface-subtle/70">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    {getDocTypeBadge(previewDoc.content_type)}
                                    {previewDoc.sop_code && (
                                        <Badge variant="outline" className="font-mono text-xs font-bold bg-ds-surface">
                                            {previewDoc.sop_code}
                                        </Badge>
                                    )}
                                    {previewDoc.department?.name && (
                                        <Badge variant="secondary" className="text-xs">
                                            <Building2 className="h-3 w-3 me-1" />
                                            {previewDoc.department.name}
                                        </Badge>
                                    )}
                                </div>

                                <DialogTitle className="text-lg font-bold text-ds-ink">
                                    {previewDoc.title}
                                </DialogTitle>

                                {previewDoc.description && (
                                    <DialogDescription className="text-xs text-ds-muted">
                                        {previewDoc.description}
                                    </DialogDescription>
                                )}
                            </DialogHeader>

                            <ScrollArea className="flex-1 p-6 space-y-6">
                                {/* Summary Quote */}
                                {previewDoc.summary && (
                                    <div className="p-3.5 rounded-[8px] bg-ds-warning-soft/80 border border-ds-warning/30">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-ds-warning uppercase tracking-wider mb-1">
                                            <Zap className="h-3.5 w-3.5 text-ds-warning fill-ds-warning" />
                                            <span>Key Summary</span>
                                        </div>
                                        <p className="text-xs italic text-ds-ink-secondary">
                                            "{previewDoc.summary}"
                                        </p>
                                    </div>
                                )}

                                {/* Video */}
                                {previewDoc.video_url && (
                                    <div className="rounded-[8px] overflow-hidden shadow-sm border border-ds-border">
                                        <VideoPlayer videoUrl={previewDoc.video_url} title={previewDoc.title} />
                                    </div>
                                )}

                                {/* HTML Content */}
                                {(previewDoc.content || previewDoc.content_ar) && (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ArticleContent content={previewDoc.content || previewDoc.content_ar || ''} />
                                    </div>
                                )}

                                {/* Checklist Items */}
                                {previewDoc.checklist_items && previewDoc.checklist_items.length > 0 && (
                                    <div className="pt-4 border-t border-ds-border space-y-2">
                                        <h5 className="font-bold text-sm flex items-center gap-1.5 text-ds-ink">
                                            <CheckSquare className="h-4 w-4 text-ds-success" />
                                            <span>Checklist Steps</span>
                                        </h5>
                                        <ChecklistRenderer items={previewDoc.checklist_items} />
                                    </div>
                                )}

                                {/* FAQ Items */}
                                {previewDoc.faq_items && previewDoc.faq_items.length > 0 && (
                                    <div className="pt-4 border-t border-ds-border space-y-2">
                                        <h5 className="font-bold text-sm flex items-center gap-1.5 text-ds-ink">
                                            <HelpCircle className="h-4 w-4 text-ds-accent" />
                                            <span>Frequently Asked Questions</span>
                                        </h5>
                                        <FAQAccordion items={previewDoc.faq_items} />
                                    </div>
                                )}

                                {/* Images */}
                                {previewDoc.images && previewDoc.images.length > 0 && (
                                    <div className="pt-4 border-t border-ds-border space-y-2">
                                        <ImageGalleryRenderer images={previewDoc.images} />
                                    </div>
                                )}
                            </ScrollArea>

                            <DialogFooter className="p-4 border-t border-ds-border bg-ds-surface-subtle/70 flex items-center justify-between sm:justify-between">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewDoc(null)}
                                >
                                    Close
                                </Button>

                                <Button
                                    size="sm"
                                    className="bg-ds-success hover:bg-ds-success text-white dark:text-ds-on-ink font-semibold"
                                    onClick={() => {
                                        onLinkDocument?.(previewDoc.id, previewDoc.title)
                                        setPreviewDoc(null)
                                    }}
                                >
                                    <Link2 className="h-3.5 w-3.5 me-1.5" />
                                    {t('knowledgeBase.linkToModule', 'Link to Module')}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

