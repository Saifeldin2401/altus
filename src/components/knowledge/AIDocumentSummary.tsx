/**
 * AIDocumentSummary - Display AI-generated document summary
 * 
 * Shows summary, key changes, reading time, and target audience
 * Can either accept pre-computed summary OR content to analyze
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAIDocumentSummarizer } from '@/hooks/useAIDocumentSummarizer'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
    ChevronRight,
    Clock,
    ListChecks,
    RefreshCw,
    Sparkles,
    Users
} from 'lucide-react'

interface DocumentSummary {
    summary: string
    keyChanges?: string[]
    readingTime?: number
    targetAudience?: string
}

interface AIDocumentSummaryProps {
    /** Pre-computed summary data */
    summary?: DocumentSummary | null
    /** Loading state (for pre-computed) */
    loading?: boolean
    /** Error message */
    error?: string | null
    /** Regenerate callback */
    onRegenerate?: () => void
    /** OR: Content to analyze */
    content?: string
    /** Document title for context */
    title?: string
    /** Previous content for change detection */
    previousContent?: string
    className?: string
    compact?: boolean
}

export function AIDocumentSummary({
    summary: propSummary,
    loading: propLoading,
    error: propError,
    onRegenerate: propOnRegenerate,
    content,
    title,
    previousContent,
    className,
    compact = false
}: AIDocumentSummaryProps) {
    const {
        summary: hookSummary,
        loading: hookLoading,
        error: hookError,
        summarizeDocument    } = useAIDocumentSummarizer()

    // Determine which mode we're in
    const isContentMode = !!content && !propSummary
    const summary = isContentMode ? hookSummary : propSummary
    const loading = isContentMode ? hookLoading : (propLoading ?? false)
    const error = isContentMode ? hookError : propError

    const handleGenerate = () => {
        if (content) {
            summarizeDocument(content, title, previousContent)
        }
    }

    const handleRegenerate = () => {
        if (propOnRegenerate) {
            propOnRegenerate()
        } else if (content) {
            summarizeDocument(content, title, previousContent)
        }
    }

    // If in content mode and no summary yet, show generate button
    if (isContentMode && !summary && !loading) {
        return (
            <Card className={cn("border-dashed border-ds-accent/30 bg-ds-accent-soft/30", className)}>
                <CardContent className="py-6">
                    <div className="text-center space-y-3">
                        <div className="h-12 w-12 rounded-[8px] bg-ds-accent flex items-center justify-center mx-auto shadow-lg">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-medium text-ds-ink">AI Document Summary</h4>
                            <p className="text-sm text-ds-muted mt-1">
                                Generate a summary, identify key changes, and estimate reading time
                            </p>
                        </div>
                        <Button
                            onClick={handleGenerate}
                            className="bg-ds-accent hover:bg-ds-accent"
                        >
                            <Sparkles className="h-4 w-4 me-2" />
                            Analyze Document
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (loading) {
        return (
            <Card className={cn("", className)}>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-ds-accent animate-pulse" />
                        <span className="text-sm text-muted-foreground">Generating AI summary...</span>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className={cn("border-ds-danger/30", className)}>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-ds-danger">{error}</p>
                        <Button variant="ghost" size="sm" onClick={handleRegenerate}>
                            <RefreshCw className="h-4 w-4 me-1" />
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!summary) return null

    if (compact) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "p-3 rounded-lg bg-ds-accent-soft border border-ds-accent/30",
                    className
                )}
            >
                <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-ds-accent flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-ds-ink-secondary leading-relaxed">{summary.summary}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-ds-muted">
                            {summary.readingTime && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {summary.readingTime} min read
                                </span>
                            )}
                            {summary.targetAudience && (
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {summary.targetAudience}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className={cn("overflow-hidden", className)}>
                {/* Header */}
                <CardHeader className="pb-3 bg-ds-accent-soft border-b border-ds-accent/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-ds-accent flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <CardTitle className="text-base font-semibold">AI Summary</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-8">
                            <RefreshCw className="h-3.5 w-3.5 me-1" />
                            Regenerate
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                    {/* Summary */}
                    <div>
                        <p className="text-sm text-ds-ink-secondary leading-relaxed">{summary.summary}</p>
                    </div>

                    {/* Key Changes */}
                    {summary.keyChanges && summary.keyChanges.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-ds-ink-secondary">
                                <ListChecks className="h-4 w-4 text-ds-success" />
                                Key Changes
                            </div>
                            <ul className="space-y-1.5">
                                {summary.keyChanges.map((change, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-ds-ink-secondary">
                                        <ChevronRight className="h-4 w-4 text-ds-success mt-0.5 flex-shrink-0" />
                                        <span>{change}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-ds-border">
                        {summary.readingTime && (
                            <Badge variant="outline" className="gap-1 bg-ds-surface">
                                <Clock className="h-3 w-3" />
                                {summary.readingTime} min read
                            </Badge>
                        )}
                        {summary.targetAudience && (
                            <Badge variant="outline" className="gap-1 bg-ds-surface">
                                <Users className="h-3 w-3" />
                                {summary.targetAudience}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
