/**
 * KnowledgeRead - Article Detail Page (formerly KnowledgeViewer)
 *
 * Simplified viewer for Knowledge Base documents.
 * Supports Title, Description, Content (HTML), and File Attachments.
 */

import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { InlineErrorBoundary } from '@/components/common/InlineErrorBoundary'
import { PdfViewer } from '@/components/common/PdfViewer'
import { RelatedArticles } from '@/components/knowledge'
import { ContentCrossLinks } from '@/components/knowledge/ContentCrossLinks'
import {
    ChecklistRenderer,
    FAQAccordion,
    ImageGalleryRenderer,
    VideoPlayer
} from '@/components/knowledge/ContentRenderers'
import { ArticleContent } from '@/components/knowledge/ArticleContent'
import { SectionLinkInjector } from '@/components/knowledge/SectionLinkInjector'
import { ArticleHeader } from '@/components/knowledge/reader/ArticleHeader'
import { ArticleFeedback } from '@/components/knowledge/reader/ArticleFeedback'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/hooks/useAuth'
import {
    useAcknowledgeArticle,
    useBookmarks,
    useComments,
    useCreateComment,
    useKnowledgeArticle,
    useRelatedArticles,
    useSubmitFeedback,
    useToggleBookmark
} from '@/hooks/useKnowledge'
import { useLastViewed } from '@/hooks/useLastViewed'
import { usePermissions } from '@/hooks/usePermissions'
import { useTrackView } from '@/hooks/useRecentlyViewed'
import type { TranslationTargetLanguage } from '@/hooks/useTranslationAI'
import { SUPPORTED_TRANSLATION_LANGUAGES, useTranslationAI } from '@/hooks/useTranslationAI'
import { renderMermaidDiagrams, transformMermaidCodeBlocks } from '@/lib/mermaid'
import { downloadReport, loadLogoAsDataUrl } from '@/lib/printEngine'
import { sanitizeHtml } from '@/lib/sanitize'
import { subscribeToArticle, deleteKnowledgeArticle, downloadStorageAsset, getAuthAccessToken, fetchImageViaProxy } from '@/features/knowledge'
import { normalizeTranslationErrorMessage } from '@/lib/translationUtils'
import { resolveDocumentUrl } from '@/lib/secureFileAccess'
import { cn } from '@/lib/utils'
import '@/styles/knowledge-ui.css'
import { STATUS_CONFIG } from '@/types/knowledge'
import {
    AlertTriangle,
    ArrowLeft,
    Bookmark,
    BookmarkCheck,
    Building,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Crown,
    Download,
    Eye,
    FileText,
    GitBranch,
    GraduationCap,
    History,
    Languages,
    Lightbulb,
    List,
    Loader2,
    Maximize2,
    MessageSquare,
    Minimize2,
    Pencil,
    PlayCircle,
    Printer,
    Send,
    Share2,
    ShieldCheck,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Timer,
    Trash2,
    Type,
    Zap,
    Briefcase,
} from 'lucide-react'
import { marked } from 'marked'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import { ReadingProgress } from '@/features/knowledge/components/ReadingProgress'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

interface TOCItem {
    id: string
    text: string
    level: number
}

export default function KnowledgeRead() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('knowledge')
    const { user, profile } = useAuth()
    const { currentOrganization } = useTenant()
    const { hasPermission } = usePermissions()
    const contentRef = useRef<HTMLDivElement>(null)
    const mermaidRef = useRef<HTMLDivElement>(null)
    const highlightDoneRef = useRef<string | null>(null)

    const [tocItems, setTocItems] = useState<TOCItem[]>([])
    const [activeSection, _setActiveSection] = useState<string>('')
    const [showComments, setShowComments] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [isQuestion, setIsQuestion] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showFeedbackInput, setShowFeedbackInput] = useState(false)
    const [feedbackText, setFeedbackText] = useState('')
    const [feedbackHelpful, setFeedbackHelpful] = useState(false)

    // UI/UX Enhancements States
    const [isFocusMode, setIsFocusMode] = useState(false)
    const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base')
    const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans')
    const [readerTheme, setReaderTheme] = useState<'light' | 'sepia' | 'dark'>('light')
    const [_showReadabilityMenu, _setShowReadabilityMenu] = useState(false)

    // Translation States
    const [isTranslating, setIsTranslating] = useState(false)
    type TranslationDiagnostics = {
        partialFailures: number
        totalSegments: number
    }

    type TranslatedArticleData = {
        title: string
        description: string
        content: string
        summary?: string
    }

    const [translatedDataByLanguage, setTranslatedDataByLanguage] = useState<Partial<Record<TranslationTargetLanguage, TranslatedArticleData>>>({})
    const [translationDiagnosticsByLanguage, setTranslationDiagnosticsByLanguage] = useState<Partial<Record<TranslationTargetLanguage, TranslationDiagnostics>>>({})
    const [showBilingual, setShowBilingual] = useState(false)
    const [translationTarget, setTranslationTarget] = useState<TranslationTargetLanguage | null>(null)
    const translatedData = translationTarget ? translatedDataByLanguage[translationTarget] ?? null : null
    const translationDiagnostics = translationTarget ? translationDiagnosticsByLanguage[translationTarget] ?? null : null

    const translateAI = useTranslationAI()

    // Ensure useKnowledgeArticle handles the 'documents' table correctly via knowledgeService
    const { data: article, isLoading, error, refetch: refetchArticle } = useKnowledgeArticle(id)

    // The stored file_url points at a private storage bucket, so it can't be used directly --
    // resolve it to a short-lived signed URL for viewing/downloading/PDF rendering.
    const [resolvedFileUrl, setResolvedFileUrl] = useState<string | null>(null)
    useEffect(() => {
        if (!article?.id || !article.file_url) {
            setResolvedFileUrl(null)
            return
        }
        let cancelled = false
        resolveDocumentUrl(article.id, article.file_url).then((url) => {
            if (!cancelled) setResolvedFileUrl(url)
        })
        return () => { cancelled = true }
    }, [article?.id, article?.file_url])

    // Stubbed/Empty hooks if backend not ready
    const { data: comments } = useComments(id)
    const { data: bookmarks } = useBookmarks()
    const { data: relatedArticles } = useRelatedArticles(id)

    // Track view for "Recently Viewed" feature
    useTrackView(id)

    // Track last viewed for "Updated since last view" feature
    const { hasBeenUpdatedSinceLastView, markAsViewed } = useLastViewed(user?.id)

    // Mark as viewed after 10 seconds (considered "read")
    useEffect(() => {
        if (!article?.id) return
        const timer = setTimeout(() => {
            markAsViewed(article.id)
        }, 10000)
        return () => clearTimeout(timer)
    }, [article?.id, markAsViewed])

    const createComment = useCreateComment()
    const toggleBookmark = useToggleBookmark()
    const acknowledgeArticle = useAcknowledgeArticle()
    const submitFeedback = useSubmitFeedback()

    const isBookmarked = bookmarks?.some(b => b.document_id === id)

    useEffect(() => {
        if (!id) return

        const unsubscribe = subscribeToArticle(id, () => {
            void refetchArticle()
        })

        return () => {
            unsubscribe()
        }
    }, [id, refetchArticle])

    const renderKnowledgeContent = useCallback((content?: string | null) => {
        if (!content) return ''
        const trimmed = content.trim()
        const isHtml = trimmed.startsWith('<')
        const baseHtml = isHtml
            ? content
            : (marked.parse(content, { async: false }) as string)
        return transformMermaidCodeBlocks(baseHtml)
    }, [])

    // Convert markdown content to HTML
    const htmlContent = useMemo(() => {
        return renderKnowledgeContent(article?.content)
    }, [article?.content, renderKnowledgeContent])

    // Memoize Arabic content HTML if it exists in DB
    const htmlContentAr = useMemo(() => {
        return renderKnowledgeContent(article?.content_ar || article?.content)
    }, [article?.content_ar, article?.content, renderKnowledgeContent])

    const htmlContentSanitized = useMemo(() => {
        return { __html: sanitizeHtml(htmlContent) }
    }, [htmlContent])


    const translatedHtmlSanitized = useMemo(() => {
        const translatedHtml = translatedData?.content
            ? renderKnowledgeContent(translatedData.content)
            : htmlContentAr
        return { __html: sanitizeHtml(translatedHtml) }
    }, [translatedData?.content, htmlContentAr, renderKnowledgeContent])

    useEffect(() => {
        setTranslatedDataByLanguage({})
        setTranslationDiagnosticsByLanguage({})
        setTranslationTarget(null)
    }, [article?.id])

    useEffect(() => {
        if (!article?.id) return

        const container = mermaidRef.current
        if (!container) return

        const timer = window.setTimeout(() => {
            void renderMermaidDiagrams(container)
        }, 50)

        return () => {
            clearTimeout(timer)
        }
    }, [article?.id, htmlContent, htmlContentAr, translatedData?.content, showBilingual])

    const canEdit = !!user && !!article && hasPermission('documents.edit', article.department_id ?? undefined)
    const canDelete = !!user && !!article && hasPermission('documents.delete', article.department_id ?? undefined)

    // Delete function
    const handleDelete = async () => {
        if (!id) return

        setIsDeleting(true)
        try {
            await deleteKnowledgeArticle(id)

            toast.success(t('viewer.delete_success'))
            navigate('/knowledge')
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('viewer.delete_error')
            toast.error(errorMessage)
        } finally {
            setIsDeleting(false)
        }
    }

    // Share function - copy article link to clipboard
    const handleShare = async () => {
        const articleUrl = `${window.location.origin}/knowledge/${id}`

        try {
            await navigator.clipboard.writeText(articleUrl)
            toast.success(t('viewer.link_copied', 'Article link copied to clipboard'))
        } catch (_err) {
            // Fallback for browsers that don't support clipboard API
            const textarea = document.createElement('textarea')
            textarea.value = articleUrl
            textarea.style.position = 'fixed'
            textarea.style.opacity = '0'
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            toast.success(t('viewer.link_copied', 'Article link copied to clipboard'))
        }
    }

    // Print function - generates professional corporate PDF
    const handlePrint = async () => {
        if (!article) return

        // Brands the exported PDF with the current tenant's own uploaded logo when set,
        // falling back to the ALTUS default inside loadLogoAsDataUrl() otherwise.
        const logo = await loadLogoAsDataUrl(currentOrganization?.logo_url)

        const blocks = []

        const blobToPngDataUrl = async (blob: Blob): Promise<string> => {
            // Prefer canvas conversion to ensure jsPDF-compatible format (PNG/JPEG)
            try {
                const url = URL.createObjectURL(blob)
                try {
                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const el = new Image()
                        el.onload = () => resolve(el)
                        el.onerror = () => reject(new Error('Failed to load image for conversion'))
                        el.src = url
                    })

                    const canvas = document.createElement('canvas')
                    canvas.width = img.naturalWidth || img.width
                    canvas.height = img.naturalHeight || img.height
                    const ctx = canvas.getContext('2d')
                    if (!ctx) throw new Error('Canvas not available')
                    ctx.drawImage(img, 0, 0)
                    return canvas.toDataURL('image/png')
                } finally {
                    URL.revokeObjectURL(url)
                }
            } catch {
                // Fallback: return original bytes as data url (may be unsupported by jsPDF)
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(String(reader.result || ''))
                    reader.onerror = () => reject(new Error('Failed to read image blob'))
                    reader.readAsDataURL(blob)
                })
            }
        }

        const urlToPngDataUrlViaImage = async (url: string): Promise<string> => {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new Image()
                // Important: allows canvas export when remote host provides CORS headers
                el.crossOrigin = 'anonymous'
                el.referrerPolicy = 'no-referrer'
                el.onload = () => resolve(el)
                el.onerror = () => reject(new Error('Failed to load remote image'))
                el.src = url
            })

            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth || img.width
            canvas.height = img.naturalHeight || img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Canvas not available')
            ctx.drawImage(img, 0, 0)
            return canvas.toDataURL('image/png')
        }

        const tryParseSupabaseStorage = (url: string): { bucket: string; path: string } | null => {
            try {
                const u = new URL(url)
                // /storage/v1/object/public/<bucket>/<path...>
                // /storage/v1/object/<bucket>/<path...>
                // /storage/v1/object/sign/<bucket>/<path...>
                const m = u.pathname.match(/\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)$/)
                if (!m) return null
                return { bucket: m[1], path: decodeURIComponent(m[2]) }
            } catch {
                return null
            }
        }

        const toDataUrl = async (url: string): Promise<string> => {
            if (!url) return url
            if (url.startsWith('data:image/')) return url

            // First try image element approach (works when fetch is blocked by CSP but images are allowed)
            try {
                return await urlToPngDataUrlViaImage(url)
            } catch {
                // Fall back to fetch/download-based methods below
            }

            try {
                const res = await fetch(url)
                if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
                const blob = await res.blob()
                return await blobToPngDataUrl(blob)
            } catch (e) {
                // Try authenticated Supabase Storage download (private buckets / missing CORS headers)
                const parsed = tryParseSupabaseStorage(url)
                if (parsed) {
                    const data = await downloadStorageAsset(parsed.bucket, parsed.path)
                    if (data) {
                        return await blobToPngDataUrl(data)
                    }
                }

                // Final fallback: server-side proxy (avoids browser CORS/canvas taint)
                const accessToken = await getAuthAccessToken()
                if (!accessToken) throw e

                const blob = await fetchImageViaProxy(url, accessToken)
                return await blobToPngDataUrl(blob)
            }
        }

        const parseContentToBlocks = (raw: string): { type: 'text'; text: string } | { type: 'mixed'; blocks } => {
            if (!raw || !raw.trim()) return { type: 'text', text: '' }

            const imgMatches: { index: number; length: number; url: string; caption?: string }[] = []

            // HTML <img src="..." alt="...">
            const htmlImgRegex = /<img\b[^>]*?src=["']([^"']+)["'][^>]*?>/gi
            let m: RegExpExecArray | null
            while ((m = htmlImgRegex.exec(raw)) !== null) {
                const full = m[0]
                const url = m[1]
                const altMatch = /alt=["']([^"']+)["']/i.exec(full)
                imgMatches.push({
                    index: m.index,
                    length: full.length,
                    url,
                    caption: altMatch?.[1]
                })
            }

            // Markdown images: ![alt](url)
            const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
            while ((m = mdImgRegex.exec(raw)) !== null) {
                const full = m[0]
                const caption = m[1] || undefined
                // Support optional title: ![alt](url "title")
                const url = (m[2] || '').trim().split(/\s+/)[0]
                imgMatches.push({ index: m.index, length: full.length, url, caption })
            }

            if (imgMatches.length === 0) return { type: 'text', text: raw }

            imgMatches.sort((a, b) => a.index - b.index)

            const out = []
            let cursor = 0
            for (const im of imgMatches) {
                if (im.index > cursor) {
                    const chunk = raw.slice(cursor, im.index)
                    if (chunk.trim()) out.push({ type: 'text', text: chunk })
                }
                if (im.url) {
                    out.push({ type: 'image', dataUrl: im.url, caption: im.caption })
                }
                cursor = im.index + im.length
            }
            if (cursor < raw.length) {
                const tail = raw.slice(cursor)
                if (tail.trim()) out.push({ type: 'text', text: tail })
            }

            return { type: 'mixed', blocks: out }
        }

        let embedFailures = 0
        const failureUrls: string[] = []

        const tryEmbedImage = async (url: string, caption?: string) => {
            if (!url) return
            try {
                const dataUrl = await toDataUrl(url)
                if (dataUrl && dataUrl.startsWith('data:image/')) {
                    blocks.push({ type: 'image', dataUrl, caption })
                } else {
                    embedFailures += 1
                    failureUrls.push(url)
                    blocks.push({ type: 'text', text: caption ? `Image: ${caption}\n${url}` : `Image\n${url}` })
                }
            } catch {
                embedFailures += 1
                failureUrls.push(url)
                blocks.push({ type: 'text', text: caption ? `Image: ${caption}\n${url}` : `Image\n${url}` })
            }
        }

        const contentParse = parseContentToBlocks(article.content || '')
        if (contentParse.type === 'text') {
            if (contentParse.text.trim()) blocks.push({ type: 'text', text: contentParse.text })
        } else {
            for (const b of contentParse.blocks) {
                if (b?.type === 'image' && b?.dataUrl) {
                    await tryEmbedImage(String(b.dataUrl), b.caption)
                } else if (b?.type === 'text' && b?.text) {
                    blocks.push(b)
                }
            }
        }

        if (Array.isArray(article.images) && article.images.length > 0) {
            const images = [...article.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            for (const img of images) {
                if (!img?.url) continue
                await tryEmbedImage(String(img.url), img.caption || undefined)
            }
        }

        if (Array.isArray(article.checklist_items) && article.checklist_items.length > 0) {
            const items = [...article.checklist_items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            blocks.push({
                type: 'checklist',
                items: items.map((i) => ({
                    text: i.text || i.task || '',
                    is_required: !!(i.is_required ?? i.required)
                }))
            })
        }

        if (Array.isArray(article.faq_items) && article.faq_items.length > 0) {
            const items = [...article.faq_items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            blocks.push({
                type: 'faq',
                items: items.map((i) => ({
                    question: i.question || '',
                    answer: i.answer || ''
                }))
            })
        }

        if (embedFailures > 0) {
            toast.error(`Some images could not be embedded in the PDF (${embedFailures}). Check image access/CORS.`)
            console.warn('PDF image embed failures:', failureUrls)
        }

        await downloadReport(
            {
                reportType: 'knowledge_article',
                title: article.title,
                hotelName: currentOrganization?.name || 'ALTUS',
                period: {
                    start: article.created_at || new Date().toISOString(),
                    end: article.updated_at || new Date().toISOString()
                },
                generatedBy: {
                    name: profile?.full_name || user?.email || 'System',
                    role: profile?.job_title || undefined
                },
                orientation: 'portrait',
                confidentialFooter: true,
            },
            {
                content: [
                    {
                        title: article.description || undefined,
                        content: '',
                        blocks: blocks.length > 0 ? blocks : undefined
                    }
                ],
                notes: [
                    `Department: ${article.department?.id === 'multiple' ? t('viewer.multiple_departments', 'Multiple Departments') : (article.department?.name || 'General')}`,
                    `Category: ${article.category?.name || 'Uncategorized'}`,
                    `Status: ${article.status}`,
                    `Version: v${article.current_version || article.version || 1}`
                ]
            },
            logo || undefined
        )
    }

    // Parse TOC from content and add section link buttons
    useEffect(() => {
        if (contentRef.current) {
            const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4')
            const items: TOCItem[] = []
            headings.forEach((heading, index) => {
                const id = `section-${index}`
                heading.setAttribute('id', id)

                // Add section link button if not already present
                if (!heading.querySelector('.section-link-btn')) {
                    heading.classList.add('group', 'relative')
                    ;(heading as HTMLElement).style.position = 'relative'
                }

                items.push({
                    id,
                    text: heading.textContent || '',
                    level: parseInt(heading.tagName[1])
                })
            })
            setTocItems(items)
        }
    }, [article?.content])

    // Estimated Reading Time
    const readingTime = useMemo(() => {
        if (!article?.content) return 1
        // Use recursive sanitization to prevent bypass attempts with nested tags
        let previous: string;
        let sanitized = article.content;
        do {
          previous = sanitized;
          sanitized = previous.replace(/<[^>]*>/g, '');
        } while (sanitized !== previous);
        const words = sanitized.split(/\s+/).length
        return Math.max(1, Math.ceil(words / 200)) // 200 wpm
    }, [article?.content])

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const handleComment = () => {
        if (!newComment.trim() || !id) return
        createComment.mutate({
            documentId: id,
            content: newComment,
            isQuestion
        }, {
            onSuccess: () => {
                setNewComment('')
                setIsQuestion(false)
            }
        })
    }

    const handleAITranslate = async (targetOverride?: TranslationTargetLanguage, options?: { force?: boolean }) => {
        if (!article || !id) return

        const currentLang = article.title_ar && article.content?.includes('\u0600') ? 'ar' : 'en'
        const targetLang = targetOverride || (currentLang === 'en' ? 'ar' : 'en')

        if (translatedDataByLanguage[targetLang] && !options?.force) {
            setTranslationTarget(targetLang)
            return
        }

        setIsTranslating(true)
        setTranslationTarget(targetLang)
        setTranslationDiagnosticsByLanguage(prev => {
            const next = { ...prev }
            delete next[targetLang]
            return next
        })

        try {
            const title = article.title || ''
            const description = article.description || ''
            const content = article.content || ''
            const summary = article.summary || ''

            if (![title, description, content, summary].some(text => !!text)) {
                setTranslatedDataByLanguage(prev => ({
                    ...prev,
                    [targetLang]: {
                        title: '',
                        description: '',
                        content: '',
                        summary: ''
                    }
                }))
                setIsTranslating(false)
                return
            }

            const metaResult = await translateAI.mutateAsync({
                texts: [title, description, summary],
                target_lang: targetLang,
                source_lang: 'auto',
                preserve_format: false,
                strict_target_only: true
            })

            const metaTranslations = metaResult.translated_texts || []
            let translatedContent = ''
            let diagnostics: TranslationDiagnostics = {
                partialFailures: 0,
                totalSegments: 0
            }

            if (content) {
                let lastContentResult: Awaited<ReturnType<typeof translateAI.mutateAsync>> | null = null

                for (let pass = 1; pass <= 3; pass += 1) {
                    lastContentResult = await translateAI.mutateAsync({
                        text: content,
                        target_lang: targetLang,
                        source_lang: 'auto',
                        preserve_format: true,
                        strict_target_only: true
                    })

                    if ((lastContentResult.meta?.partial_failures ?? 0) === 0) {
                        break
                    }

                    await new Promise(resolve => setTimeout(resolve, 220 * pass))
                }

                translatedContent = lastContentResult?.translated_text || content
                diagnostics = {
                    partialFailures: lastContentResult?.meta?.partial_failures ?? 0,
                    totalSegments: lastContentResult?.meta?.total_segments ?? 0
                }
            }

            setTranslatedDataByLanguage(prev => ({
                ...prev,
                [targetLang]: {
                    title: metaTranslations[0] || title,
                    description: metaTranslations[1] || description,
                    content: translatedContent,
                    summary: metaTranslations[2] || summary
                }
            }))
            setTranslationDiagnosticsByLanguage(prev => ({
                ...prev,
                [targetLang]: diagnostics
            }))

            if (diagnostics.partialFailures > 0) {
                toast.warning(
                    t(
                        'viewer.translation_incomplete',
                        `Translation is incomplete. ${diagnostics.partialFailures} section${diagnostics.partialFailures === 1 ? '' : 's'} still need retry.`
                    )
                )
            } else {
                toast.success(t('viewer.translation_complete', 'Translation complete!'))
            }
        } catch (error) {
            console.error('Translation failed:', error)
            const errorMessage = normalizeTranslationErrorMessage(error instanceof Error ? error.message : '')
            const baseMessage = t('viewer.translation_error', 'Failed to translate article')
            toast.error(errorMessage ? `${baseMessage}: ${errorMessage}` : baseMessage)
            // Reset target on failure to avoid showing partial/broken translation
            setTranslationTarget(null)
        } finally {
            setIsTranslating(false)
        }
    }

    if (!id) return null

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-4 w-96 mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3">
                        <Skeleton className="h-96 w-full" />
                    </div>
                </div>
            </div>
        )
    }

    if (error || !article) {
        return (
            <div className="container mx-auto py-8 px-4 text-center">
                <AlertTriangle className="h-16 w-16 mx-auto text-ds-warning mb-4" />
                <h1 className="text-2xl font-bold mb-2">{t('viewer.not_found_title')}</h1>
                <p className="text-ds-ink-secondary mb-4">{t('viewer.not_found_desc')}</p>
                <Button onClick={() => navigate('/knowledge')}>
                    <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
                    {t('viewer.back_to_home')}
                </Button>
            </div>
        )
    }

    // Default to gray if status not found in config
    const statusConfig = STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG] || { label: article.status, color: 'gray' }
    const statusLabel = t(`status.${article.status}`, article.status)
    const translationTargetMeta = translationTarget
        ? SUPPORTED_TRANSLATION_LANGUAGES.find(lang => lang.code === translationTarget)
        : null
    const isRtlTarget = translationTargetMeta?.direction === 'rtl'
    const shouldUseRtl = isRtlTarget || (!translationTarget && !!article.content_ar)

    return (
        <div className={cn(
            "min-h-screen kb-focus-transition transition-colors duration-500",
            readerTheme === 'light' && "bg-ds-surface-subtle",
            readerTheme === 'sepia' && "kb-theme-sepia",
            readerTheme === 'dark' && "kb-theme-dark",
            isFocusMode && (readerTheme === 'light' ? "bg-ds-surface" : "bg-[var(--kb-bg-main)]")
        )}>
            <ReadingProgress targetRef={contentRef} />
            <HighlightPassage containerRef={contentRef} doneRef={highlightDoneRef} ready={!!article} />
            {/* Focus Mode Overlay */}
            <div className={cn("kb-focus-overlay", isFocusMode && "active")} />

            {/* Styles for Rich Text Content */}
            <style>{`
                /* Enhanced RTL Support & Typography */
                .prose[dir="rtl"],
                .prose [dir="rtl"] {
                    text-align: right;
                    direction: rtl;
                    font-family: 'Cairo', sans-serif;
                    line-height: 1.85; /* Better for Arabic script */
                }
                
                .prose {
                    font-family: 'Inter', sans-serif;
                    line-height: 1.6;
                }

                /* Structured Headings */
                .prose h1 {
                    font-size: 2.25rem;
                    font-weight: 800;
                    color: rgb(var(--ds-ink));
                    border-bottom: 2px solid rgb(var(--ds-border));
                    padding-bottom: 0.5rem;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                }
                .prose h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: rgb(var(--ds-ink));
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .prose h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: rgb(var(--ds-ink-secondary));
                    margin-top: 1.25rem;
                    margin-bottom: 0.5rem;
                }

                /* Smart Alerts */
                .smart-alert {
                    padding: 1.25rem;
                    border-radius: 0.5rem;
                    margin: 1.5rem 0;
                    border-left: 4px solid transparent;
                    font-size: 0.95rem;
                }
                .smart-alert-important {
                    background-color: rgb(var(--ds-warning-soft));
                    border-color: rgb(var(--ds-warning));
                    color: rgb(var(--ds-warning));
                }
                .smart-alert-warning {
                    background-color: rgb(var(--ds-danger-soft));
                    border-color: rgb(var(--ds-danger));
                    color: rgb(var(--ds-danger));
                }
                .smart-alert-note {
                    background-color: rgb(var(--ds-info-soft));
                    border-color: rgb(var(--ds-info));
                    color: rgb(var(--ds-info));
                }
                .smart-alert-caution {
                    background-color: rgb(var(--ds-warning-soft));
                    border-color: rgb(var(--ds-warning));
                    color: rgb(var(--ds-warning));
                }

                /* Tables */
                .prose table {
                    border-collapse: separate;
                    border-spacing: 0;
                    margin: 1.5rem 0;
                    width: 100%;
                    border: 1px solid rgb(var(--ds-border));
                    border-radius: 0.5rem;
                    overflow-x: auto;
                    display: block;
                }
                .prose table td,
                .prose table th {
                    border: 1px solid rgb(var(--ds-border));
                    padding: 0.875rem 1.25rem;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    min-width: 120px;
                }
                .prose table th {
                    background: rgb(var(--ds-surface-subtle));
                    font-weight: 600;
                    color: rgb(var(--ds-muted));
                    text-align: left;
                }

                /* RTL table alignment */
                .prose[dir="rtl"] table td,
                .prose[dir="rtl"] table th {
                    text-align: right;
                    line-height: 1.85;
                }

                /* ========================================
                   PRINT STYLES - Clean Article Output
                   ======================================== */
                @media print {
                    /* Hide all navigation, sidebar, and UI elements */
                    header, nav, aside, footer,
                    .sidebar, .sidebar-navigation,
                    [data-sidebar], [data-header],
                    .no-print, .print\\:hidden,
                    button, .btn,
                    [role="navigation"],
                    .breadcrumb, .breadcrumbs,
                    .sticky, .fixed,
                    .comments-section,
                    .related-articles,
                    .feedback-section,
                    .acknowledgment-section,
                    .table-of-contents,
                    .toc-sidebar,
                    .space-y-6.print\\:hidden {
                        display: none !important;
                        visibility: hidden !important;
                    }

                    /* Reset page styling */
                    body, html {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }

                    /* Force container to be full width */
                    .container, .container-fluid, 
                    [class*="container"] {
                        max-width: 100% !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    /* Make grid single column full width */
                    .grid {
                        display: block !important;
                        width: 100% !important;
                    }

                    /* Force main content to full width */
                    .lg\\:col-span-3,
                    [class*="col-span"] {
                        width: 100% !important;
                        max-width: 100% !important;
                        grid-column: 1 / -1 !important;
                        flex: none !important;
                    }

                    /* Main print container */
                    .print-content, .article-content, .prose {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-size: 11pt !important;
                        line-height: 1.6 !important;
                        color: black !important;
                    }

                    /* Cards should be borderless in print */
                    .card, [class*="Card"] {
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        padding: 0 !important;
                    }

                    /* Article header for print: always black-on-white on paper, regardless of
                       the app's theme, so this is a literal, not a design token. */
                    .print-header {
                        display: block !important;
                        text-align: center;
                        margin-bottom: 1.5rem;
                        padding-bottom: 1rem;
                        border-bottom: 2px solid #333;
                    }

                    .print-header h1 {
                        font-size: 20pt !important;
                        margin-bottom: 0.5rem !important;
                        color: black !important;
                    }

                    /* Ensure content is visible and readable */
                    .prose h1, .prose h2, .prose h3, .prose h4 {
                        page-break-after: avoid;
                        color: black !important;
                        margin-top: 1rem !important;
                    }

                    .prose p, .prose li {
                        orphans: 3;
                        widows: 3;
                    }

                    .prose img {
                        max-width: 100% !important;
                        page-break-inside: avoid;
                    }

                    .prose table {
                        page-break-inside: avoid;
                        width: 100% !important;
                    }

                    /* PDF viewer styling for print */
                    iframe, embed, object {
                        max-width: 100% !important;
                        page-break-inside: avoid;
                    }

                    /* Page setup */
                    @page {
                        margin: 1.5cm;
                        size: A4;
                    }
                }
            `}</style>
            {/* Header - Back Navigation & Actions */}
            <div className={cn(
                "bg-ds-surface border-b border-ds-border text-ds-ink sticky top-14 z-30 kb-focus-transition print:hidden",
                isFocusMode && "-translate-y-full opacity-0"
            )}>
                <div className="max-w-[1400px] mx-auto px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(-1)}
                                className="hover:bg-muted rounded-full h-9 w-9 p-0 md:h-9 md:w-auto md:px-3 text-foreground"
                            >
                                <ArrowLeft className="h-4 w-4 md:me-2" />
                                <span className="hidden md:inline">{t('viewer.back')}</span>
                            </Button>
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <Breadcrumbs items={[
                                { label: t('viewer.library', 'Library'), href: '/knowledge' },
                                { label: article.department?.id === 'multiple' ? t('viewer.multiple_departments', 'Multiple Departments') : (article.department?.name || t('viewer.no_dept', 'General')), href: `/knowledge?department=${article.department_id}` },
                                { label: article.title }
                            ]} className="hidden md:flex" />
                            <div className="md:hidden text-xs font-semibold text-muted-foreground truncate max-w-[150px]">
                                {article.title}
                            </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                            {(canEdit || canDelete) && (
                                <div className="flex items-center gap-1 sm:gap-2 me-1 sm:me-2">
                                    {canEdit && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/studio/articles/${id}/edit`)}
                                            className="h-9 px-2 sm:px-3 border-border hover:border-ds-brass hover:text-ds-brass rounded-lg group transition-all"
                                        >
                                            <Pencil className="h-3.5 w-3.5 sm:me-2 group-hover:scale-110 transition-transform" />
                                            <span className="hidden sm:inline">{t('viewer.edit')}</span>
                                        </Button>
                                    )}

                                    {canDelete && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 px-2 sm:px-3 text-ds-danger hover:text-ds-danger hover:bg-ds-danger-soft hover:border-ds-danger/30 rounded-lg group"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 sm:me-2 group-hover:scale-110 transition-transform" />
                                                    <span className="hidden sm:inline">{t('viewer.delete')}</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('viewer.delete_title')}</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {t('viewer.delete_desc', { title: article.title })}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('viewer.cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={handleDelete}
                                                        disabled={isDeleting}
                                                        className="bg-ds-danger hover:bg-ds-danger"
                                                    >
                                                        {isDeleting ? t('viewer.deleting') : t('viewer.delete_confirm')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}

                                    <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
                                </div>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                            "h-9 px-3 gap-2 rounded-lg transition-all",
                                            translatedData ? "bg-ds-brass/10 border-ds-brass/30 text-ds-brass" : "border-border hover:border-ds-brass hover:text-ds-brass"
                                        )}
                                        disabled={isTranslating}
                                    >
                                        {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                                        <span className="hidden sm:inline">
                                            {translatedData
                                                ? t('viewer.translated', { lang: translationTargetMeta?.label })
                                                : t('viewer.translate', 'Translate')}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {!translatedData ? (
                                        <>
                                            <div className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                                {t('viewer.translate_ai', 'Translate to')}
                                            </div>
                                            {SUPPORTED_TRANSLATION_LANGUAGES.map(lang => (
                                                <DropdownMenuItem key={lang.code} onClick={() => handleAITranslate(lang.code)} className="gap-2">
                                                    <Sparkles className="h-3.5 w-3.5 text-ds-brass" />
                                                    {lang.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuItem onClick={() => setShowBilingual(!showBilingual)}>
                                                <Maximize2 className="h-4 w-4 me-2" />
                                                {showBilingual ? t('viewer.show_single', 'Show Single') : t('viewer.show_bilingual', 'Show Bilingual')}
                                            </DropdownMenuItem>
                                            {translationTarget && translationDiagnostics?.partialFailures ? (
                                                <DropdownMenuItem onClick={() => handleAITranslate(translationTarget, { force: true })}>
                                                    <Sparkles className="h-4 w-4 me-2 text-ds-warning" />
                                                    {t('viewer.retry_translation', 'Retry Translation')}
                                                </DropdownMenuItem>
                                            ) : null}
                                            <DropdownMenuItem onClick={() => {
                                                if (translationTarget) {
                                                    setTranslatedDataByLanguage(prev => {
                                                        const next = { ...prev }
                                                        delete next[translationTarget]
                                                        return next
                                                    })
                                                    setTranslationDiagnosticsByLanguage(prev => {
                                                        const next = { ...prev }
                                                        delete next[translationTarget]
                                                        return next
                                                    })
                                                }
                                                setShowBilingual(false)
                                                setTranslationTarget(null)
                                            }}>
                                                <Trash2 className="h-4 w-4 me-2 text-ds-danger" />
                                                {t('viewer.clear_translation', 'Clear')}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex items-center ms-1 gap-x-0.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleBookmark.mutate(id!)}
                                    className={cn(
                                        "h-9 w-9 p-0 rounded-full transition-colors",
                                        isBookmarked ? "text-ds-brass bg-ds-brass/10" : "text-muted-foreground hover:text-ds-brass hover:bg-muted"
                                    )}
                                    aria-label={isBookmarked ? t('accessibility.remove_bookmark', 'Remove bookmark') : t('accessibility.add_bookmark', 'Add bookmark')}
                                >
                                    {isBookmarked ? <BookmarkCheck className="h-5 w-5 fill-ds-brass/30 text-ds-brass" /> : <Bookmark className="h-5 w-5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleShare}
                                    className="h-9 w-9 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                                    aria-label={t('accessibility.share', 'Share article')}
                                >
                                    <Share2 className="h-5 w-5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePrint}
                                    className="h-9 w-9 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                                    aria-label={t('accessibility.print', 'Print article')}
                                >
                                    <Printer className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {translationTarget && translationDiagnostics?.partialFailures ? (
                <div className="max-w-[1400px] mx-auto px-3 pt-3 sm:px-4 print:hidden">
                    <div className="rounded-[8px] border border-ds-warning/30 bg-ds-warning-soft px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-ds-warning">
                            {t(
                                'viewer.translation_incomplete_banner',
                                `Translation is incomplete. ${translationDiagnostics.partialFailures} section${translationDiagnostics.partialFailures === 1 ? '' : 's'} are still using the original language.`
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-ds-warning/30 bg-ds-surface text-ds-warning hover:bg-ds-warning-soft"
                            onClick={() => handleAITranslate(translationTarget, { force: true })}
                            disabled={isTranslating}
                        >
                            {isTranslating ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Sparkles className="h-4 w-4 me-2" />}
                            {t('viewer.retry_translation', 'Retry Translation')}
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* Premium Article Hero Section */}
            <ArticleHeader
                article={article}
                statusColor={statusConfig.color}
                statusLabel={statusLabel}
                hasBeenUpdatedSinceLastView={article?.id ? hasBeenUpdatedSinceLastView(article.id, article.updated_at) : false}
                translatedData={translatedData}
                showBilingual={showBilingual}
                isRtlTarget={isRtlTarget}
                shouldUseRtl={shouldUseRtl}
                readingTime={readingTime}
                className={cn(
                    "kb-article-header pt-10 sm:pt-14 kb-focus-transition",
                    isFocusMode && "opacity-0 -translate-y-8 pointer-events-none"
                )}
            />

            <div className={cn(
                "container max-w-[1400px] mx-auto py-6 px-3 sm:py-10 sm:px-4 print:py-0 print:px-0 transition-all duration-500",
                isFocusMode ? "max-w-4xl py-24 z-[45] relative kb-focus-content" : "relative z-10"
            )}>
                {/* Print Header - only visible when printing */}
                <div className="hidden print:block print-header mb-8 pb-4 border-b-2 border-ds-border">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
                        <p className="text-sm text-ds-ink-secondary">
                            Altus Connect · Knowledge | {article.department?.id === 'multiple' ? t('viewer.multiple_departments', 'Multiple Departments') : (article.department?.name || 'General')} | Last updated: {new Date(article.updated_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className={cn(
                    "grid grid-cols-1 lg:grid-cols-12 gap-10 print:block",
                    isFocusMode && "block"
                )}>
                    {/* Main Content Pane */}
                    <div className={cn(
                        "lg:col-span-9 space-y-8 print-content content-contain",
                        isFocusMode && "lg:col-span-12"
                    )}>

                        {/* Mobile TOC - Quick Jump */}
                        {tocItems.length > 0 && (
                            <div className="lg:hidden no-print">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full flex items-center justify-between border-border bg-card">
                                            <div className="flex items-center gap-2">
                                                <List className="h-4 w-4 text-ds-brass" />
                                                <span className="text-sm font-semibold text-foreground">{t('viewer.on_this_page', 'Jump to Section')}</span>
                                            </div>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-[calc(100vw-1.5rem)] max-h-64 overflow-y-auto">
                                        {tocItems.map(item => (
                                            <DropdownMenuItem key={item.id} onClick={() => scrollToSection(item.id)}>
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full me-2",
                                                    activeSection === item.id ? "bg-ds-brass" : "bg-muted"
                                                )} />
                                                {item.text}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* TL;DR Quick Summary */}
                        {article.summary && (
                            <div className="relative group p-[1px] rounded-[8px] bg-gradient-to-br from-ds-brass/30 via-ds-brass/20 to-transparent">
                                <div className="bg-card rounded-[15px] p-6 shadow-xs overflow-hidden relative border border-border">
                                    <div className="absolute -top-4 -end-4 h-24 w-24 bg-ds-brass/10 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                                    <h3 className="text-[11px] font-bold text-ds-brass uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <Zap className="h-3.5 w-3.5 fill-ds-brass" />
                                        {t('viewer.tldr', 'Quick Summary')}
                                    </h3>
                                    <div className="relative z-10 text-foreground text-base sm:text-lg font-medium leading-relaxed italic">
                                        {showBilingual && translatedData ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="border-e border-border pe-6">"{article.summary}"</div>
                                                <div
                                                    dir={isRtlTarget ? 'rtl' : 'ltr'}
                                                    className={cn(
                                                        "text-ds-brass",
                                                        isRtlTarget ? "text-end font-arabic" : "text-start"
                                                    )}
                                                >
                                                    "{translatedData.summary}"
                                                </div>
                                            </div>
                                        ) : (
                                            translatedData && translatedData.summary ? `"${translatedData.summary}"` : `"${article.summary}"`
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Revision Release Notes */}
                        {article.content_data?.release_notes && (
                            <div className="rounded-[8px] border border-ds-info/80 bg-gradient-to-br from-ds-info-soft/70 via-white to-background p-5 sm:p-6 shadow-2xs">
                                <div className="flex items-start gap-3.5">
                                    <div className="h-9 w-9 rounded-[8px] bg-ds-info/10 text-ds-info flex items-center justify-center border border-ds-info/20 shrink-0 mt-0.5 shadow-2xs">
                                        <History className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-ds-ink">
                                                {t('viewer.release_notes_title', 'Revision Release Notes & Guidance')}
                                            </h4>
                                            <Badge variant="outline" className="text-[11px] bg-ds-info-soft/60 text-ds-info border-ds-info/30 font-semibold">
                                                {`v${article.current_version || article.version || 1}`}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-ds-muted">
                                            {t('viewer.release_notes_desc', 'Key operational updates and standard procedural directives introduced in this revision.')}
                                        </p>
                                        <div className="mt-3 p-3.5 rounded-[8px] bg-white/80 border border-ds-info/30 text-sm text-ds-ink leading-relaxed whitespace-pre-wrap font-sans">
                                            {article.content_data.release_notes}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* File Attachment Quick Preview */}
                        {article.file_url && (!translationTarget || translationTarget === 'en' || (!article.content_ar && !translatedData)) && (
                            <div className="bg-muted/40 border border-border rounded-[8px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-ds-brass/10 flex items-center justify-center text-ds-brass">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{t('viewer.attached_file', 'Attached Document')}</p>
                                        <p className="text-xs text-muted-foreground">{article.file_url.split('/').pop()}</p>
                                    </div>
                                </div>
                                <div className="flex w-full sm:w-auto gap-2">
                                    <Button variant="ghost" size="sm" className="h-9 flex-1 sm:flex-none px-3 sm:px-4 rounded-lg hover:bg-card text-foreground" disabled={!resolvedFileUrl} onClick={() => resolvedFileUrl && window.open(resolvedFileUrl, '_blank')}>
                                        <Eye className="h-4 w-4 me-2" />
                                        {t('viewer.view')}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none px-3 sm:px-4 rounded-lg bg-card border-border text-foreground" disabled={!resolvedFileUrl} onClick={() => resolvedFileUrl && window.open(resolvedFileUrl, '_blank')}>
                                        <Download className="h-4 w-4 me-2" />
                                        {t('viewer.download')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* PDF Viewer if applicable */}
                        {article.file_url?.toLowerCase().endsWith('.pdf') && resolvedFileUrl && (
                            <div className="mt-4 rounded-[8px] overflow-hidden shadow-sm border border-ds-border">
                                <PdfViewer url={resolvedFileUrl} />
                            </div>
                        )}

                        {/* Main Article Content Card */}
                        <Card className={cn(
                            "kb-reader-card transition-all duration-500 overflow-hidden",
                            isFocusMode && "border-none shadow-none bg-transparent",
                            readerTheme === 'sepia' && "kb-theme-sepia",
                            readerTheme === 'dark' && "kb-theme-dark"
                        )}>
                            <CardContent className={cn(
                                "p-3 sm:p-5 md:p-10 lg:p-14 transition-all duration-500",
                                isFocusMode && "px-0"
                            )}>
                                {translatedData || article.content_ar ? (
                                    showBilingual ? (
                                        <div ref={mermaidRef} className="grid grid-cols-1 lg:grid-cols-2 gap-16 text-ds-ink">
                                            <InlineErrorBoundary>
                                                <div
                                                    className={cn(
                                                        "prose max-w-none transition-all duration-300",
                                                        fontSize === 'sm' && "text-kb-sm",
                                                        fontSize === 'base' && "text-kb-base",
                                                        fontSize === 'lg' && "text-kb-lg",
                                                        fontSize === 'xl' && "text-kb-xl",
                                                    )}
                                                    dangerouslySetInnerHTML={htmlContentSanitized}
                                                />
                                            </InlineErrorBoundary>
                                            <InlineErrorBoundary>
                                                <div
                                                    dir={shouldUseRtl ? 'rtl' : 'ltr'}
                                                    className={cn(
                                                        "prose max-w-none transition-all duration-300",
                                                        shouldUseRtl
                                                            ? "border-e-2 border-ds-info/30 pe-10 text-end font-arabic"
                                                            : "border-s-2 border-ds-info/30 ps-10",
                                                        fontSize === 'sm' && "text-kb-sm",
                                                        fontSize === 'base' && "text-kb-base",
                                                        fontSize === 'lg' && "text-kb-lg",
                                                        fontSize === 'xl' && "text-kb-xl",
                                                    )}
                                                    dangerouslySetInnerHTML={translatedHtmlSanitized}
                                                />
                                            </InlineErrorBoundary>
                                        </div>
                                    ) : (
                                        <div ref={mermaidRef}>
                                            <InlineErrorBoundary>
                                                <article
                                                    dir={shouldUseRtl ? 'rtl' : 'ltr'}
                                                    className={cn(
                                                        "prose md:prose-lg max-w-none transition-all duration-300",
                                                        shouldUseRtl ? "text-end font-arabic break-words" : "text-start",
                                                        fontSize === 'sm' && "text-kb-sm",
                                                        fontSize === 'base' && "text-kb-base",
                                                        fontSize === 'lg' && "text-kb-lg",
                                                        fontSize === 'xl' && "text-kb-xl",
                                                    )}
                                                    style={shouldUseRtl ? { wordBreak: 'break-word', overflowWrap: 'break-word' } : undefined}
                                                    dangerouslySetInnerHTML={translatedHtmlSanitized}
                                                />
                                            </InlineErrorBoundary>
                                        </div>
                                    )
                                ) : article.content ? (
                                    <div ref={mermaidRef}>
                                        <InlineErrorBoundary>
                                            <ArticleContent
                                                content={article.content || ''}
                                                className={cn(
                                                    "prose md:prose-lg max-w-none text-ds-ink kb-prose transition-all duration-300",
                                                    fontFamily === 'serif' && "kb-prose-serif",
                                                    fontSize === 'sm' && "text-kb-sm",
                                                    fontSize === 'base' && "text-kb-base",
                                                    fontSize === 'lg' && "text-kb-lg",
                                                    fontSize === 'xl' && "text-kb-xl",
                                                )}
                                                cacheVersion={article.updated_at}
                                            />
                                        </InlineErrorBoundary>
                                    </div>
                                ) : (
                                    !article.file_url && (
                                        <div className="flex flex-col items-center justify-center py-12 text-ds-muted">
                                            <AlertTriangle className="h-10 w-10 mb-3 opacity-20" />
                                            <p className="italic">{t('viewer.no_content')}</p>
                                        </div>
                                    )
                                )}

                                {/* Section Link Injector - Adds copy buttons to headings */}
                                <SectionLinkInjector containerRef={contentRef} isActive={!!article.content} />

                                {/* Property Local Addendum Box */}
                                {article.content_data?.local_addendum && (article.content_data.local_addendum.en || article.content_data.local_addendum.ar) && (
                                    <div className="mt-10 rounded-[8px] border border-ds-warning/80 bg-gradient-to-br from-ds-warning-soft/60 via-ds-warning-soft/20 to-card p-6 sm:p-7 shadow-xs">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ds-warning/80">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-[8px] bg-ds-warning/15 text-ds-warning flex items-center justify-center border border-ds-warning/25 shadow-2xs shrink-0">
                                                    <Building className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-bold text-ds-ink">
                                                            {t('viewer.local_addendum_title', 'Property Local Addendum & Operational Annex')}
                                                        </h3>
                                                        <Badge variant="outline" className="text-[11px] font-semibold bg-ds-warning-soft/70 text-ds-warning border-ds-warning/30">
                                                            {t('viewer.property_specific', 'Property-Specific')}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-ds-ink-secondary mt-0.5">
                                                        {t('viewer.local_addendum_desc', 'Local operational modifications and property-specific protocols preserved from central blueprint synchronization.')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-5">
                                            {showBilingual && article.content_data.local_addendum.en && article.content_data.local_addendum.ar ? (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <div className="p-4 rounded-[8px] bg-white/90 border border-ds-warning/30 space-y-2">
                                                        <div className="text-[11px] font-bold text-ds-warning uppercase tracking-wider">
                                                            {t('viewer.english_version', 'English Version')}
                                                        </div>
                                                        <div className="text-sm text-ds-ink whitespace-pre-wrap leading-relaxed">
                                                            {article.content_data.local_addendum.en}
                                                        </div>
                                                    </div>
                                                    <div dir="rtl" className="p-4 rounded-[8px] bg-white/90 border border-ds-warning/30 space-y-2 font-arabic text-end">
                                                        <div className="text-[11px] font-bold text-ds-warning uppercase tracking-wider">
                                                            {t('viewer.arabic_version', 'النسخة العربية')}
                                                        </div>
                                                        <div className="text-sm text-ds-ink whitespace-pre-wrap leading-relaxed">
                                                            {article.content_data.local_addendum.ar}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : article.content_data.local_addendum.en && article.content_data.local_addendum.ar ? (
                                                <Tabs defaultValue={shouldUseRtl ? "ar" : "en"} className="w-full">
                                                    <TabsList className="bg-ds-warning-soft/60 p-1 border border-ds-warning/30">
                                                        <TabsTrigger value="en" className="text-xs font-semibold data-[state=active]:bg-ds-surface dark:data-[state=active]:bg-ds-ink">
                                                            {t('viewer.english_version', 'English Version')}
                                                        </TabsTrigger>
                                                        <TabsTrigger value="ar" className="text-xs font-semibold data-[state=active]:bg-ds-surface dark:data-[state=active]:bg-ds-ink font-arabic">
                                                            {t('viewer.arabic_version', 'النسخة العربية')}
                                                        </TabsTrigger>
                                                    </TabsList>
                                                    <TabsContent value="en" className="mt-3 p-4 rounded-[8px] bg-white/90 border border-ds-warning/30 text-sm text-ds-ink whitespace-pre-wrap leading-relaxed">
                                                        {article.content_data.local_addendum.en}
                                                    </TabsContent>
                                                    <TabsContent value="ar" dir="rtl" className="mt-3 p-4 rounded-[8px] bg-white/90 border border-ds-warning/30 text-sm text-ds-ink whitespace-pre-wrap leading-relaxed font-arabic text-end">
                                                        {article.content_data.local_addendum.ar}
                                                    </TabsContent>
                                                </Tabs>
                                            ) : (
                                                <div
                                                    dir={article.content_data.local_addendum.ar ? 'rtl' : 'ltr'}
                                                    className={cn(
                                                        "p-4 rounded-[8px] bg-white/90 border border-ds-warning/30 text-sm text-ds-ink whitespace-pre-wrap leading-relaxed",
                                                        article.content_data.local_addendum.ar && "font-arabic text-end"
                                                    )}
                                                >
                                                    {article.content_data.local_addendum.en || article.content_data.local_addendum.ar}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Content Type Specific Renderers */}
                                <div className="mt-12 space-y-12">
                                    {article.content_type === 'video' && article.video_url && (
                                        <VideoPlayer videoUrl={article.video_url} title={article.title} />
                                    )}

                                    {article.checklist_items && article.checklist_items.length > 0 && (
                                        <div className="pt-8 border-t border-ds-border">
                                            <ChecklistRenderer items={article.checklist_items} />
                                        </div>
                                    )}

                                    {article.faq_items && article.faq_items.length > 0 && (
                                        <div className="pt-8 border-t border-ds-border">
                                            <FAQAccordion items={article.faq_items} />
                                        </div>
                                    )}

                                    {article.content_type === 'visual' && article.images && article.images.length > 0 && (
                                        <div className="pt-8 border-t border-ds-border">
                                            <ImageGalleryRenderer
                                                images={article.images}
                                                cacheVersion={article.updated_at || undefined}
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Conclusion: the reader's acknowledgement, then feedback */}
                        <div className="space-y-6 print:hidden">
                            {article.requires_acknowledgment && (
                                <section
                                    aria-labelledby="kb-ack"
                                    className={cn(
                                        "border-y-2 px-1 py-6",
                                        article.is_acknowledged ? "border-ds-success" : "border-ds-ink"
                                    )}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            {article.is_acknowledged
                                                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ds-success" />
                                                : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ds-ink" />}
                                            <div>
                                                <h2 id="kb-ack" className="text-base font-semibold text-ds-ink">
                                                    {article.is_acknowledged ? t('viewer.already_acknowledged', 'Acknowledged') : t('viewer.acknowledge_title')}
                                                </h2>
                                                <p className="mt-0.5 text-sm text-ds-ink-secondary">
                                                    {article.is_acknowledged
                                                        ? t('viewer.acknowledged_on', 'You acknowledged this on {{date}}', { date: new Date(article.acknowledged_at!).toLocaleDateString() })
                                                        : t('viewer.acknowledge_desc')}
                                                </p>
                                            </div>
                                        </div>
                                        {!article.is_acknowledged && (
                                            <Button
                                                className="h-12 shrink-0 rounded-md bg-ds-ink px-6 text-ds-on-ink hover:bg-ds-ink/90"
                                                onClick={() => acknowledgeArticle.mutate(id!)}
                                                disabled={acknowledgeArticle.isPending}
                                            >
                                                {acknowledgeArticle.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle2 className="h-4 w-4 me-2" />}
                                                {t('viewer.i_acknowledge')}
                                            </Button>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Feedback Section */}
                            <ArticleFeedback
                                isSuccess={submitFeedback.isSuccess}
                                showFeedbackInput={showFeedbackInput}
                                feedbackHelpful={feedbackHelpful}
                                feedbackText={feedbackText}
                                isPending={submitFeedback.isPending}
                                onFeedbackTextChange={setFeedbackText}
                                onCancel={() => setShowFeedbackInput(false)}
                                onSubmit={() => submitFeedback.mutate({ documentId: id!, helpful: feedbackHelpful, feedbackText })}
                                onMarkHelpful={() => submitFeedback.mutate({ documentId: id!, helpful: true })}
                                onMarkNotHelpful={() => {
                                    setFeedbackHelpful(false)
                                    setShowFeedbackInput(true)
                                }}
                            />
                        </div>

                        {/* Comments Section */}
                        <Card className={cn(
                            "border-none shadow-sm bg-ds-surface-subtle/50 print:hidden transition-all duration-500",
                            isFocusMode && "opacity-0 pointer-events-none translate-y-8"
                        )}>
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-ds-brass" />
                                        {t('viewer.discussion')}
                                        <span className="text-sm font-normal text-muted-foreground ms-1">({comments?.length || 0})</span>
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setShowComments(!showComments)} aria-label={showComments ? t('accessibility.collapse_comments', 'Collapse comments') : t('accessibility.expand_comments', 'Expand comments')}>
                                        {showComments ? <ChevronUp className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </CardHeader>
                            {showComments && (
                                <CardContent className="space-y-6">
                                    <div className="space-y-3 bg-card p-4 rounded-[8px] border border-border shadow-2xs">
                                        <Textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={t('viewer.leave_comment')}
                                            className="min-h-[80px] border-none focus-visible:ring-0 p-0 text-sm resize-none bg-transparent"
                                        />
                                        <div className="flex justify-end pt-2 border-t border-border">
                                            <Button size="sm" onClick={handleComment} disabled={!newComment.trim() || createComment.isPending} className="bg-ds-ink hover:bg-ds-ink-secondary text-ds-on-ink font-semibold">
                                                <Send className="h-3.5 w-3.5 me-2" /> {t('viewer.post')}
                                            </Button>
                                        </div>
                                    </div>

                                    {comments?.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p className="text-sm italic">{t('viewer.no_comments')}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {comments?.map((comment) => (
                                                <div key={comment.id} className="flex gap-4 group">
                                                    <Avatar className="h-10 w-10 border border-border shadow-xs shrink-0">
                                                        <AvatarImage src={comment.author?.avatar_url} />
                                                        <AvatarFallback className="bg-ds-ink text-ds-brass font-bold">
                                                            {comment.author?.full_name?.charAt(0) || '?'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 space-y-1.5 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold text-foreground">{comment.author?.full_name || t('viewer.unknown_author')}</span>
                                                            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-tight">
                                                                {new Date(comment.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-foreground/90 leading-relaxed bg-muted/40 p-3.5 rounded-[8px] rounded-ss-none border border-border shadow-2xs">
                                                            {comment.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    </div>

                    {/* Premium Editorial Sidebar */}
                    {!isFocusMode && (
                        <aside className="lg:col-span-3 space-y-8 sticky top-20 h-fit print:hidden">
                            {/* Table of Contents - Primary Sidebar Widget */}
                            {tocItems.length > 0 && (
                                <div className="space-y-4 bg-card/85 border border-border rounded-[8px] p-4 shadow-xs">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">{t('viewer.on_this_page')}</h4>
                                    <nav className="space-y-0.5">
                                        {tocItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => scrollToSection(item.id)}
                                                className={cn(
                                                    "kb-sidebar-item w-full text-start text-sm py-2 px-3 rounded-[8px] transition-all flex items-center gap-3",
                                                    activeSection === item.id ? "bg-ds-brass/10 text-ds-brass font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                    activeSection === item.id ? "bg-ds-brass" : "bg-muted"
                                                )} />
                                                <span className="truncate">{item.text}</span>
                                            </button>
                                        ))}
                                    </nav>
                                </div>
                            )}

                            {/* Tags */}
                            {article.tags && article.tags.length > 0 && (
                                <div className="space-y-4 bg-card/85 border border-border rounded-[8px] p-4 shadow-xs">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">{t('viewer.tags')}</h4>
                                    <div className="flex flex-wrap gap-2 px-2">
                                        {article.tags.map(tag => (
                                            <Badge
                                                key={tag.id}
                                                variant="outline"
                                                className="bg-card border-border text-foreground hover:border-ds-brass hover:text-ds-brass transition-colors cursor-default"
                                                style={{ borderInlineStart: `3px solid ${tag.color}` }}
                                            >
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Linked Learning */}
                            {(article.linked_training_id || article.linked_quiz_id) ? (
                                <div className="p-[1px] rounded-[8px] bg-ds-info">
                                    <div className="bg-white/95 rounded-[15px] p-5">
                                        <div className="flex items-center gap-2 text-ds-info mb-3">
                                            <GraduationCap className="h-5 w-5" />
                                            <span className="text-[11px] font-black uppercase tracking-wider">{t('viewer.linked_learning', 'Linked Learning')}</span>
                                        </div>

                                        <div className="space-y-4">
                                            {article.linked_training_id && (
                                                <div className="space-y-3">
                                                    <p className="text-xs text-ds-muted leading-relaxed font-medium">{t('viewer.training_hint', 'Complete this interactive training course based on this SOP.')}</p>
                                                    <Button
                                                        className="w-full bg-ds-info hover:bg-ds-info text-white dark:text-ds-on-ink dark:shadow-none rounded-[8px]"
                                                        onClick={() => navigate(`/learn/player/${article.linked_training_id}`)}
                                                    >
                                                        <PlayCircle className="h-4 w-4 me-2" />
                                                        {t('viewer.start_training', 'Start Training Course')}
                                                    </Button>
                                                </div>
                                            )}

                                            {article.linked_quiz_id && (
                                                <div className="space-y-3">
                                                    {article.linked_training_id && <div className="h-px bg-ds-surface-subtle" />}
                                                    <p className="text-xs text-ds-muted leading-relaxed font-medium">{t('viewer.quiz_hint', 'Verify your procedural understanding with a quick checkpoint assessment.')}</p>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full border-ds-info/30 text-ds-info hover:bg-ds-info-soft rounded-[8px]"
                                                        onClick={() => navigate(`/learn/quizzes/${article.linked_quiz_id}`)}
                                                    >
                                                        <Lightbulb className="h-4 w-4 me-2" />
                                                        {t('viewer.take_quiz', 'Take Assessment')}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* AI Course & Quiz Generation Quick Actions for Authors/Managers */
                                (hasPermission('training.create') || profile?.role === 'super_admin' || profile?.role === 'administrator') && (
                                    <div className="p-[1px] rounded-[8px] bg-ds-warning">
                                        <div className="bg-white/95 rounded-[15px] p-5 space-y-3">
                                            <div className="flex items-center gap-2 text-ds-warning">
                                                <Sparkles className="h-4 w-4 text-ds-warning" />
                                                <span className="text-[11px] font-black uppercase tracking-wider">{t('viewer.ai_learning_pipeline', 'AI Learning Pipeline')}</span>
                                            </div>
                                            <p className="text-xs text-ds-muted leading-relaxed font-medium">
                                                {t('viewer.ai_pipeline_desc', 'Convert this verified SOP into an interactive course with Bloom-level quizzes.')}
                                            </p>
                                            <div className="space-y-2 pt-1">
                                                <Button
                                                    size="sm"
                                                    className="w-full bg-ds-ink hover:bg-ds-ink/90 text-ds-on-ink shadow-sm rounded-[8px] text-xs font-semibold"
                                                    onClick={() => navigate(`/studio/courses/new?source_doc_id=${article.id}`)}
                                                >
                                                    <GraduationCap className="h-3.5 w-3.5 me-1.5" />
                                                    {t('viewer.generate_course_from_sop', 'Generate Course from SOP')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full border-ds-warning/30 text-ds-warning hover:bg-ds-warning-soft rounded-[8px] text-xs font-semibold"
                                                    onClick={() => navigate(`/studio/quizzes/generate?source_doc_id=${article.id}`)}
                                                >
                                                    <Lightbulb className="h-3.5 w-3.5 me-1.5" />
                                                    {t('viewer.generate_quiz_from_sop', 'Generate Quiz from SOP')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Related Articles */}
                            {relatedArticles && relatedArticles.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black text-ds-muted uppercase tracking-[0.2em] px-2">{t('viewer.related')}</h4>
                                    <RelatedArticles
                                        articles={relatedArticles}
                                        sourceId={article.id}
                                    />
                                </div>
                            )}

                            {/* Cross-Link to Documents */}
                            <ContentCrossLinks
                                documentId={article.id}
                                mode="knowledge"
                            />
                        </aside>
                    )}
                </div>
            </div>

            {/* Premium Floating Readability Toolbar */}
            <div className={cn(
                "kb-floating-toolbar fixed bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+1rem))] md:bottom-8 start-1/2 -translate-x-1/2 h-14 max-w-[calc(100vw-1rem)] flex items-center px-1 py-1 rounded-[8px] print:hidden z-50 transition-all duration-500 ease-out",
                isFocusMode ? "ring-2 ring-ds-info ring-offset-4 ring-offset-ds-background" : "bg-white/80"
            )}>
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setIsFocusMode(!isFocusMode)
                            toast.info(isFocusMode ? "Exited Focus Mode" : "Entered Focus Mode", { duration: 1500 })
                        }}
                        className={cn(
                            "h-12 w-12 rounded-[14px] transition-all duration-300",
                            isFocusMode ? "text-ds-info bg-ds-info-soft scale-105" : "text-ds-muted hover:bg-ds-surface-subtle"
                        )}
                        title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                        aria-label={isFocusMode ? t('accessibility.exit_focus', 'Exit focus mode') : t('accessibility.enter_focus', 'Enter focus mode')}
                    >
                        {isFocusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </Button>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                aria-label={t('common:a11y.textSettings', 'Text settings')}
                                variant="ghost"
                                size="icon"
                                className="h-12 w-12 rounded-[14px] text-ds-muted hover:bg-ds-surface-subtle transition-all"
                            >
                                <Type className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-64 p-5 rounded-[8px] shadow-2xl border-ds-border/60 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-black text-ds-muted uppercase tracking-widest">{t('viewer.font_size', 'Font Size')}</p>
                                        <span className="text-[11px] font-bold text-ds-info uppercase">{fontSize}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 bg-ds-surface-subtle p-1 rounded-[8px]">
                                        {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => setFontSize(size)}
                                                className={cn(
                                                    "py-2 rounded-lg text-[11px] font-black transition-all uppercase",
                                                    fontSize === size ? "bg-ds-surface text-ds-info shadow-sm" : "text-ds-muted hover:text-ds-ink-secondary"
                                                )}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[11px] font-black text-ds-muted uppercase tracking-widest">{t('viewer.typeface', 'Typeface')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setFontFamily('sans')}
                                            className={cn(
                                                "py-3 rounded-[8px] border-2 transition-all flex flex-col items-center gap-1",
                                                fontFamily === 'sans' ? "border-ds-info bg-ds-info-soft/50" : "border-ds-border hover:border-ds-border"
                                            )}
                                        >
                                            <span className="text-lg font-bold">Aa</span>
                                            <span className="text-[11px] font-bold text-ds-muted">SANS</span>
                                        </button>
                                        <button
                                            onClick={() => setFontFamily('serif')}
                                            className={cn(
                                                "py-3 rounded-[8px] border-2 transition-all flex flex-col items-center gap-1",
                                                fontFamily === 'serif' ? "border-ds-info bg-ds-info-soft/50" : "border-ds-border hover:border-ds-border"
                                            )}
                                        >
                                            <span className="text-lg font-bold italic">Aa</span>
                                            <span className="text-[11px] font-bold text-ds-muted">SERIF</span>
                                        </button>
                                    </div>
                                </div>

                                <Separator className="bg-ds-surface-subtle" />

                                <div className="space-y-3">
                                    <p className="text-[11px] font-black text-ds-muted uppercase tracking-widest">{t('viewer.appearance', 'Appearance')}</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setReaderTheme('light')}
                                            className={cn(
                                                "h-10 rounded-[8px] border-2 transition-all flex items-center justify-center",
                                                readerTheme === 'light' ? "border-ds-info ring-2 ring-ds-info ring-offset-1" : "border-ds-border bg-ds-surface"
                                            )}
                                        >
                                            <div className="w-5 h-5 bg-ds-surface rounded-full border border-ds-border" title="Light" />
                                        </button>
                                        <button
                                            onClick={() => setReaderTheme('sepia')}
                                            className={cn(
                                                "h-10 rounded-[8px] border-2 transition-all flex items-center justify-center",
                                                readerTheme === 'sepia' ? "border-ds-info ring-2 ring-ds-info ring-offset-1" : "border-ds-border bg-[#FDF6E3]" // eslint-disable-line no-restricted-syntax -- reading-theme swatch preview, not app chrome
                                            )}
                                        >
                                            <div className="w-5 h-5 bg-[#FDF6E3] rounded-full border border-ds-border" title="Sepia" /> {/* eslint-disable-line no-restricted-syntax -- reading-theme swatch preview */}
                                        </button>
                                        <button
                                            onClick={() => setReaderTheme('dark')}
                                            className={cn(
                                                "h-10 rounded-[8px] border-2 transition-all flex items-center justify-center",
                                                readerTheme === 'dark' ? "border-ds-info ring-2 ring-ds-info ring-offset-1" : "border-ds-border bg-ds-ink"
                                            )}
                                        >
                                            <div className="w-5 h-5 bg-ds-ink rounded-full border border-ds-ink-secondary" title="Dark" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="hidden sm:flex items-center">
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleShare}
                            className="h-12 w-12 rounded-[14px] text-ds-muted hover:bg-ds-surface-subtle transition-all"
                            title="Share"
                        >
                            <Share2 className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrint}
                            className="h-12 w-12 rounded-[14px] text-ds-muted hover:bg-ds-surface-subtle transition-all"
                            title="Print"
                        >
                            <Printer className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * ?highlight=<first words of a passage> - set by "Ask the knowledge base"
 * citations. Finds the first text node containing that phrase (or, failing
 * that, its first three words), marks it and scrolls it into view once.
 */
function HighlightPassage({ containerRef, doneRef, ready }: { containerRef: RefObject<HTMLDivElement | null>; doneRef: MutableRefObject<string | null>; ready: boolean }) {
    const location = useLocation()
    useEffect(() => {
        const phrase = new URLSearchParams(location.search).get('highlight')?.trim()
        const root = containerRef.current
        if (!ready || !phrase || !root || doneRef.current === phrase) return
        const timer = window.setTimeout(() => {
            const candidates = [phrase, phrase.split(/\s+/).slice(0, 3).join(' ')]
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            for (const needle of candidates) {
                walker.currentNode = root
                let node = walker.nextNode()
                while (node) {
                    const text = node.textContent ?? ''
                    const at = text.toLowerCase().indexOf(needle.toLowerCase())
                    if (at >= 0 && node.parentElement) {
                        const block = node.parentElement.closest('p, li, h1, h2, h3, h4, td, blockquote') ?? node.parentElement
                        block.classList.add('kb-highlight')
                        block.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        doneRef.current = phrase
                        return
                    }
                    node = walker.nextNode()
                }
            }
        }, 300)
        return () => window.clearTimeout(timer)
    }, [location.search, containerRef, doneRef, ready])
    return null
}
