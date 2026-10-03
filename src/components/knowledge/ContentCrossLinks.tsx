/**
 * ContentCrossLinks - Cross-reference panel between Knowledge Base and Documents
 * 
 * Shows a contextual link card that directs users to the "other view"
 * of the same document record. Solves the confusion of identical content
 * appearing in both Knowledge Base and Documents sections.
 */

import { cn } from '@/lib/utils'
import { ArrowRight, BookOpen, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface ContentCrossLinksProps {
    /** The document ID (same in both KB and Documents) */
    documentId: string
    /** Which page we're currently on */
    mode: 'knowledge' | 'documents'
    /** Optional extra CSS classes */
    className?: string
}

export function ContentCrossLinks({ documentId, mode, className }: ContentCrossLinksProps) {
    const navigate = useNavigate()
    const { t } = useTranslation('common')

    const isKnowledge = mode === 'knowledge'

    const targetPath = isKnowledge
        ? `/documents/${documentId}`
        : `/knowledge/${documentId}`

    const Icon = isKnowledge ? FileText : BookOpen

    return (
        <button
            onClick={() => navigate(targetPath)}
            className={cn(
                "w-full group text-start p-4 rounded-[8px] border transition-all duration-300",
                " hover:-translate-y-0.5",
                isKnowledge
                    ? "border-ds-info/60 bg-ds-info-soft/80 hover:border-ds-info/30"
                    : "border-ds-info/60 bg-ds-info-soft/80 hover:border-ds-info/30",
                className
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110",
                    isKnowledge
                        ? "bg-ds-info-soft text-ds-info"
                        : "bg-ds-info-soft text-ds-info"
                )}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className={cn(
                            "text-sm font-bold",
                            isKnowledge ? "text-ds-info" : "text-ds-info"
                        )}>
                            {isKnowledge
                                ? t('cross_links.view_in_documents', 'View in Document Library')
                                : t('cross_links.view_in_knowledge', 'View in Knowledge Base')
                            }
                        </p>
                        <ArrowRight className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1",
                            isKnowledge ? "text-ds-info" : "text-ds-info"
                        )} />
                    </div>
                    <p className="text-xs text-ds-muted mt-1 leading-relaxed">
                        {isKnowledge
                            ? t('cross_links.documents_hint', 'Access version history, downloads, and file management')
                            : t('cross_links.knowledge_hint', 'Read with rich viewer, comments, bookmarks, and related articles')
                        }
                    </p>
                </div>
            </div>
        </button>
    )
}
