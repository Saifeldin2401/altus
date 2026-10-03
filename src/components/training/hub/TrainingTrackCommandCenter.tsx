import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Award,
    BarChart3,
    BookOpen,
    Brain,
    Clock,
    Eye,
    Filter,
    RefreshCw,
    Search,
    Shield,
    Sparkles,
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts'

type TrackSubTab = 'overview' | 'modules'
type TimeframeOption = '7d' | '30d' | '90d' | 'all'

interface TrainingTrackCommandCenterProps {
    canManageModules: boolean
    onNavigateToBuilder?: (moduleId: string) => void
}

export function TrainingTrackCommandCenter({
    canManageModules,
    onNavigateToBuilder,
}: TrainingTrackCommandCenterProps) {
    const { t, i18n } = useTranslation('training')
    const isRTL = i18n.dir() === 'rtl'

    // Sub-tab state
    const [subTab, setSubTab] = useState<TrackSubTab>('overview')
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all')
    const [timeframe, setTimeframe] = useState<TimeframeOption>('30d')
    
    // Course list filters
    const [moduleSearch, setModuleSearch] = useState('')
    const [moduleHealthFilter, setModuleHealthFilter] = useState<'all' | 'needs_attention' | 'healthy'>('all')
    

    // Modal States
    const [selectedModuleForDrilldown, setSelectedModuleForDrilldown] = useState<any | null>(null)
    const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<any | null>(null)

    // Fetch Departments
    const { data: departments = [] } = useQuery({
        queryKey: ['departments-list-tracking'],
        queryFn: async () => {
            const { data, error } = await supabase.from('departments').select('id, name').order('name')
            if (error) throw error
            return data || []
        }
    })

    // Fetch Comprehensive Real Progress, Certificates & Module Data
    const { data: rawData, isLoading, refetch } = useQuery({
        queryKey: ['track-command-center-data', selectedDepartmentId, timeframe],
        queryFn: async () => {
            // 1. Fetch modules
            const { data: modules, error: modErr } = await supabase
                .from('courses')
                .select('id, title, description, status, estimated_duration_minutes, passing_score_percentage, created_at, updated_at')
                .not('is_deleted', 'is', true)
                .order('title')
            if (modErr) throw modErr

            // 2. Fetch all progress records
            // lp_content_type filters to real module completions only - this table also
            // holds standalone quiz-attempt rows (lp_content_type='quiz'), which must not
            // be counted as training-module assignments/completions in these KPIs.
            const { data: progressRows, error: progErr } = await supabase
                .from('training_progress')
                .select(`
                    id,
                    user_id,
                    training_id,
                    assignment_id,
                    status,
                    progress_percentage,
                    score_percentage,
                    quiz_score,
                    passed,
                    time_spent_seconds,
                    created_at,
                    updated_at,
                    completed_at,
                    last_accessed_at,
                    metadata,
                    profiles:user_id (
                        id,
                        full_name,
                        email,
                        organization_memberships (
                            department_id,
                            department:departments (id, name)
                        )
                    )
                `)
                .eq('is_deleted', false)
                .eq('lp_content_type', 'module')
                .not('training_id', 'is', null)
            if (progErr) throw progErr

            // 2b. Assignment due dates + per-user overrides, needed to compute a real
            // overdue count (the correct data, joined per-row, below) instead of a
            // fixed days-since-created heuristic.
            const [{ data: assignmentRows, error: assignErr }, { data: overrideRows, error: overrideErr }] = await Promise.all([
                supabase
                    .from('assignments')
                    .select('id, due_date')
                    .eq('content_type', 'module')
                    .or('is_deleted.is.null,is_deleted.eq.false'),
                supabase
                    .from('learning_assignment_user_overrides')
                    .select('user_id, content_id, due_date')
                    .eq('content_type', 'module'),
            ])
            if (assignErr) console.warn('Assignment due-date warning:', assignErr)
            if (overrideErr) console.warn('Override due-date warning:', overrideErr)

            // 3. Fetch authoritative certificates from certificates table
            const { data: certificates, error: certErr } = await supabase
                .from('certificates')
                .select(`
                    id,
                    certificate_number,
                    verification_code,
                    user_id,
                    recipient_name,
                    recipient_email,
                    certificate_type,
                    title,
                    description,
                    completion_date,
                    expiry_date,
                    score,
                    passing_score,
                    training_module_id,
                    training_progress_id,
                    organization_id,
                    department_id,
                    status,
                    created_at,
                    metadata
                `)
                .order('completion_date', { ascending: false })
            if (certErr) throw certErr

            // 4. Fetch unified question attempts directly for gap analysis
            const { data: questionAttempts, error: attemptsErr } = await supabase
                .from('unified_question_attempts')
                .select(`
                    question_id,
                    is_correct,
                    selected_answer,
                    time_spent_seconds,
                    question:unified_questions (
                        id,
                        question_text,
                        question_type,
                        tags,
                        source_domain,
                        explanation
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(500)
            if (attemptsErr) console.warn('Question attempts warning:', attemptsErr)

            // 5. Fetch all training content blocks for course funnels
            const { data: contentBlocks, error: blocksErr } = await supabase
                .from('lessons')
                .select('id, training_module_id, title, block_type, block_order, is_mandatory')
                .eq('is_deleted', false)
                .order('block_order', { ascending: true })
            if (blocksErr) console.warn('Content blocks warning:', blocksErr)

            return {
                modules: modules || [],
                progressRows: progressRows || [],
                certificates: certificates || [],
                questionAttempts: questionAttempts || [],
                contentBlocks: contentBlocks || [],
                assignmentDueDates: assignmentRows || [],
                userOverrideDueDates: overrideRows || []
            }
        }
    })

    // Process Metrics & Aggregates
    const metrics = useMemo(() => {
        if (!rawData) {
            return {
                totalAssignments: 0,
                completedCount: 0,
                inProgressCount: 0,
                overdueCount: 0,
                complianceRate: 0,
                avgScore: 0,
                activeLearnersCount: 0,
                expiringCertificatesCount: 0,
                expiringCertificatesList: [],
                completionTrend: [],
                departmentPerformance: [],
                moduleHealthList: [],
                knowledgeGaps: [],
            }
        }

        const { modules, progressRows, certificates, questionAttempts, contentBlocks, assignmentDueDates, userOverrideDueDates } = rawData

        const dueDateByAssignmentId = new Map(
            (assignmentDueDates || []).map((a: any) => [a.id, a.due_date as string | null])
        )
        const overrideDueDateByUserAndModule = new Map(
            (userOverrideDueDates || []).map((o: any) => [`${o.user_id}:${o.content_id}`, o.due_date as string | null])
        )
        const resolveDueDate = (row: any): string | null => {
            const overrideKey = row.user_id && row.training_id ? `${row.user_id}:${row.training_id}` : null
            const overrideDue = overrideKey ? overrideDueDateByUserAndModule.get(overrideKey) : undefined
            if (overrideDue !== undefined) return overrideDue
            return row.assignment_id ? (dueDateByAssignmentId.get(row.assignment_id) ?? null) : null
        }

        // Filter rows by department
        const filteredProgress = progressRows.filter((row: any) => {
            const profile = row.profiles as any
            const memberships = profile?.organization_memberships || []
            if (selectedDepartmentId !== 'all') {
                const hasDept = memberships.some((m: any) => m.department_id === selectedDepartmentId || m.department?.id === selectedDepartmentId)
                if (!hasDept) return false
            }
            return true
        })

        const totalAssignments = filteredProgress.length
        const completedCount = filteredProgress.filter(r => r.status === 'completed').length
        const inProgressCount = filteredProgress.filter(r => r.status === 'in_progress').length
        const overdueCount = filteredProgress.filter(r => {
            if (r.status === 'completed') return false
            const dueDate = resolveDueDate(r)
            if (!dueDate) return false
            return new Date(dueDate).getTime() < Date.now()
        }).length

        const complianceRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

        const scoredRows = filteredProgress.filter(r => typeof (r.score_percentage ?? r.quiz_score) === 'number')
        const avgScore = scoredRows.length > 0
            ? Math.round(scoredRows.reduce((sum, r) => sum + (r.score_percentage ?? r.quiz_score ?? 0), 0) / scoredRows.length)
            : 0

        const activeLearnerIds = new Set(filteredProgress.filter(r => r.status === 'in_progress').map(r => r.user_id))
        const activeLearnersCount = activeLearnerIds.size

        // Expiring certificates (within 30 days)
        const now = Date.now()
        const in30Days = now + 30 * 24 * 60 * 60 * 1000
        const expiringCertificates = certificates.filter((c: any) => {
            if (!c.expiry_date || c.status === 'revoked') return false
            const exp = new Date(c.expiry_date).getTime()
            return exp > now && exp <= in30Days
        })

        // Completion Trend (Last 14 days)
        const trendMap = new Map<string, { date: string; completed: number; started: number }>()
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now - i * 24 * 60 * 60 * 1000)
            const key = d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })
            trendMap.set(key, { date: key, completed: 0, started: 0 })
        }

        filteredProgress.forEach(r => {
            if (r.completed_at) {
                const key = new Date(r.completed_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })
                if (trendMap.has(key)) {
                    trendMap.get(key)!.completed += 1
                }
            }
            if (r.created_at) {
                const key = new Date(r.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })
                if (trendMap.has(key)) {
                    trendMap.get(key)!.started += 1
                }
            }
        })
        const completionTrend = Array.from(trendMap.values())

        // Department Performance Matrix
        const deptMap = new Map<string, { name: string; total: number; completed: number; scoreSum: number; scoreCount: number }>()
        filteredProgress.forEach(r => {
            const profile = r.profiles as any
            const memberships = profile?.organization_memberships || []
            const deptName = memberships[0]?.department?.name || (t('tracking.cc.general', 'General'))
            if (!deptMap.has(deptName)) {
                deptMap.set(deptName, { name: deptName, total: 0, completed: 0, scoreSum: 0, scoreCount: 0 })
            }
            const record = deptMap.get(deptName)!
            record.total += 1
            if (r.status === 'completed') record.completed += 1
            const sc = r.score_percentage ?? r.quiz_score
            if (typeof sc === 'number') {
                record.scoreSum += sc
                record.scoreCount += 1
            }
        })

        const departmentPerformance = Array.from(deptMap.values()).map(d => ({
            name: d.name,
            compliance: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
            avgScore: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : null,
            total: d.total,
            completed: d.completed
        })).sort((a, b) => b.compliance - a.compliance)

        // Module Health List with real funnel drop-off points
        const moduleMap = new Map<string, {
            module: any
            enrolled: number
            completed: number
            inProgress: number
            scores: number[]
            learners: any[]
            blocks: any[]
        }>()

        modules.forEach(m => {
            const modBlocks = contentBlocks.filter((b: any) => b.training_module_id === m.id)
            moduleMap.set(m.id, {
                module: m,
                enrolled: 0,
                completed: 0,
                inProgress: 0,
                scores: [],
                learners: [],
                blocks: modBlocks
            })
        })

        filteredProgress.forEach(r => {
            if (r.training_id && moduleMap.has(r.training_id)) {
                const mRec = moduleMap.get(r.training_id)!
                mRec.enrolled += 1
                if (r.status === 'completed') mRec.completed += 1
                if (r.status === 'in_progress') mRec.inProgress += 1
                const sc = r.score_percentage ?? r.quiz_score
                if (typeof sc === 'number') mRec.scores.push(sc)
                mRec.learners.push(r)
            }
        })

        const moduleHealthList = Array.from(moduleMap.values()).map(({ module, enrolled, completed, inProgress, scores, learners, blocks }) => {
            const compRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0
            const modAvg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
            const passRate = scores.length > 0 ? Math.round((scores.filter(s => s >= (module.passing_score_percentage || 80)).length / scores.length) * 100) : null
            
            // Calculate Drop-off Funnel per block
            const blockFunnel = blocks.map((b, idx) => {
                const completedBlockCount = learners.filter(l => {
                    if (l.status === 'completed') return true
                    const completedIds = l.metadata?.completed_blocks || []
                    return Array.isArray(completedIds) && completedIds.includes(b.id)
                }).length
                const retentionRate = enrolled > 0 ? Math.round((completedBlockCount / enrolled) * 100) : 100
                return {
                    id: b.id,
                    order: b.block_order ?? idx + 1,
                    title: b.title || `Block ${idx + 1}`,
                    type: b.block_type || 'content',
                    isMandatory: b.is_mandatory !== false,
                    completedCount: completedBlockCount,
                    retentionRate
                }
            })

            // Find worst drop-off block
            let worstDropBlock = null
            if (blockFunnel.length > 1) {
                let maxDrop = 0
                for (let i = 1; i < blockFunnel.length; i++) {
                    const drop = blockFunnel[i - 1].retentionRate - blockFunnel[i].retentionRate
                    if (drop > maxDrop && drop >= 10) {
                        maxDrop = drop
                        worstDropBlock = { ...blockFunnel[i], dropAmount: drop }
                    }
                }
            }

            const isHealthy = compRate >= 70 && (modAvg === null || modAvg >= (module.passing_score_percentage || 80))

            return {
                id: module.id,
                title: module.title,
                description: module.description,
                status: module.status,
                enrolled,
                completed,
                inProgress,
                completionRate: compRate,
                avgScore: modAvg,
                passRate,
                passingScore: module.passing_score_percentage || 80,
                durationMinutes: module.estimated_duration_minutes || 15,
                learners,
                blocks: blockFunnel,
                worstDropBlock,
                isHealthy
            }
        }).sort((a, b) => b.enrolled - a.enrolled)

        // Knowledge Gap Analyzer from Question Attempts
        const questionMap = new Map<string, {
            id: string
            text: string
            type: string
            category: string
            explanation?: string
            total: number
            correct: number
            recentAttempts: any[]
        }>()

        ;(questionAttempts || []).forEach((att: any) => {
            const q = att.question
            if (!q) return
            if (!questionMap.has(q.id)) {
                const categoryTag = (Array.isArray(q.tags) && q.tags.length > 0 && q.tags[0])
                    ? q.tags[0]
                    : (q.source_domain === 'knowledge' ? 'Knowledge Base' : 'Hospitality Standards')

                questionMap.set(q.id, {
                    id: q.id,
                    text: q.question_text || 'SOP assessment question',
                    type: q.question_type || 'multiple_choice',
                    category: categoryTag,
                    explanation: q.explanation || 'Refer to the Altus Standard Operating Procedures repository.',
                    total: 0,
                    correct: 0,
                    recentAttempts: []
                })
            }
            const qRec = questionMap.get(q.id)!
            qRec.total += 1
            if (att.is_correct) qRec.correct += 1
            if (qRec.recentAttempts.length < 5) {
                qRec.recentAttempts.push({
                    selectedAnswer: att.selected_answer,
                    isCorrect: att.is_correct,
                    timeSpent: att.time_spent_seconds
                })
            }
        })

        const knowledgeGaps = Array.from(questionMap.values())
            .filter(q => q.total >= 1)
            .map(q => ({
                id: q.id,
                questionText: q.text,
                questionType: q.type,
                category: q.category,
                explanation: q.explanation,
                accuracyRate: Math.round((q.correct / q.total) * 100),
                attempts: q.total,
                recentAttempts: q.recentAttempts
            }))
            .sort((a, b) => a.accuracyRate - b.accuracyRate)
            .slice(0, 8)

        return {
            totalAssignments,
            completedCount,
            inProgressCount,
            overdueCount,
            complianceRate,
            avgScore,
            activeLearnersCount,
            expiringCertificatesCount: expiringCertificates.length,
            expiringCertificatesList: expiringCertificates,
            completionTrend,
            departmentPerformance,
            moduleHealthList,
            knowledgeGaps,
        }
    }, [rawData, selectedDepartmentId, isRTL])

    // Filtered module list based on health toggle
    const displayedModules = useMemo(() => {
        return metrics.moduleHealthList.filter(m => {
            if (moduleSearch && !m.title.toLowerCase().includes(moduleSearch.toLowerCase())) return false
            if (moduleHealthFilter === 'needs_attention') return !m.isHealthy
            if (moduleHealthFilter === 'healthy') return m.isHealthy
            return true
        })
    }, [metrics.moduleHealthList, moduleSearch, moduleHealthFilter])

    return (
        <div className="space-y-6">
            {/* Top Command Toolbar */}
            <div className="flex flex-col gap-3 rounded-[8px] border border-ds-border bg-ds-surface p-3.5 shadow-none lg:flex-row lg:items-center lg:justify-between">
                {/* Left: Filter Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-ds-accent" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">
                            {t('tracking.cc.filters', 'Show')}
                        </span>
                    </div>

                    {/* Department Selector */}
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="h-9 w-[170px] bg-ds-surface border-ds-border text-xs font-medium text-ds-ink">
                            <SelectValue placeholder={t('tracking.cc.allDepartments', 'All departments')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('tracking.cc.allDepartments', 'All departments')}</SelectItem>
                            {departments.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Timeframe */}
                    <Select value={timeframe} onValueChange={(val: any) => setTimeframe(val)}>
                        <SelectTrigger className="h-9 w-[120px] bg-ds-surface border-ds-border text-xs font-medium text-ds-ink">
                            <Clock className="me-1.5 h-3.5 w-3.5 text-ds-muted" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">{t('tracking.cc.last7', 'Last 7 days')}</SelectItem>
                            <SelectItem value="30d">{t('tracking.cc.last30', 'Last 30 days')}</SelectItem>
                            <SelectItem value="90d">{t('tracking.cc.last90', 'Last 90 days')}</SelectItem>
                            <SelectItem value="all">{t('tracking.cc.allTime', 'All time')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="h-9 border-ds-border bg-ds-surface text-xs font-medium text-ds-ink hover:bg-ds-surface-subtle"
                    >
                        <RefreshCw className={cn("me-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
                        {t('tracking.cc.refresh', 'Refresh')}
                    </Button>
                </div>
            </div>

            {/* 4 Pillars Tab Navigation */}
            <Tabs value={subTab} onValueChange={(val: any) => setSubTab(val)} className="space-y-6">
                <TabsList className="flex h-auto min-h-0 w-full justify-start gap-1 overflow-x-auto rounded-none border-0 border-b border-ds-border bg-transparent p-0">
                    <TabsTrigger value="overview" className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-ds-muted shadow-none hover:text-ds-ink data-[state=active]:border-ds-brass data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ds-ink data-[state=active]:shadow-none">
                        <BarChart3 aria-hidden="true" className="h-4 w-4" />
                        <span>{t('tracking.cc.tabOverview', 'Overview')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="modules" className="min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-ds-muted shadow-none hover:text-ds-ink data-[state=active]:border-ds-brass data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ds-ink data-[state=active]:shadow-none">
                        <Brain aria-hidden="true" className="h-4 w-4" />
                        <span>{t('tracking.cc.tabCourses', 'Courses')}</span>
                    </TabsTrigger>
                </TabsList>

                {/* ─── TAB 1: EXECUTIVE OVERVIEW ─── */}
                <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {/* 1. Compliance Rate */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.complianceRate', 'Completed on time')}</span>
                                <Shield className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.complianceRate}%</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                                    metrics.complianceRate >= 90 ? "bg-ds-success-soft text-ds-success" : "bg-ds-warning-soft text-ds-warning"
                                )}>
                                    {metrics.complianceRate >= 90 ? (t('tracking.cc.targetMet', 'On target')) : (t('tracking.cc.belowTarget', 'Below 90%'))}
                                </span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {metrics.completedCount} / {metrics.totalAssignments} {t('tracking.cc.completed', 'completed')}
                            </p>
                        </div>

                        {/* 2. Assessment Mastery Score */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.averageScore', 'Average quiz score')}</span>
                                <Award className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.avgScore ?? '—'}%</span>
                                <span className="px-1.5 py-0.5 rounded bg-ds-info-soft text-ds-info text-[11px] font-semibold">
                                    {(metrics.avgScore ?? 0) >= 85 ? (t('tracking.cc.scoreStrong', 'Strong')) : (t('tracking.cc.scoreOk', 'Fair'))}
                                </span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {t('tracking.cc.acrossQuizzes', 'Across all course quizzes')}
                            </p>
                        </div>

                        {/* 3. Total Enrollments */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.totalAssignments', 'Assignments')}</span>
                                <BookOpen className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.totalAssignments}</span>
                                <span className="text-xs text-ds-muted">{t('tracking.cc.records', 'in total')}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {rawData?.modules.length || 0} {t('tracking.cc.activeCourses', 'courses')}
                            </p>
                        </div>

                        {/* 4. Active Learners */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.activeLearners', 'People learning')}</span>
                                <Activity className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.activeLearnersCount}</span>
                                <span className="text-xs text-ds-muted font-medium">{t('tracking.cc.people', 'people')}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {metrics.inProgressCount} {t('tracking.cc.inProgress', 'in progress')}
                            </p>
                        </div>

                        {/* 5. Overdue: the risk queue owns follow-up */}
                        <Link to="/manage/risk" className={cn(
                            "block rounded-[8px] border p-4 space-y-2 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent",
                            metrics.overdueCount > 0 ? "border-ds-danger/40 bg-ds-danger-soft/20 hover:border-ds-danger" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.overdue', 'Overdue')}</span>
                                <AlertTriangle className={cn("h-4 w-4", metrics.overdueCount > 0 ? "text-ds-danger" : "text-ds-muted")} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={cn("text-2xl font-bold font-mono tracking-tight", metrics.overdueCount > 0 ? "text-ds-danger" : "text-ds-ink")}>
                                    {metrics.overdueCount}
                                </span>
                                {metrics.overdueCount > 0 ? (
                                    <span className="px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[11px] font-semibold">
                                        {t('tracking.cc.needsFollowUp', 'Follow up')}
                                    </span>
                                ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-ds-success-soft text-ds-success text-[11px] font-semibold">
                                        {t('tracking.cc.noneOverdue', 'None overdue')}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {t('tracking.cc.overdueHint', 'Open the risk queue to follow up')}
                            </p>
                        </Link>

                        {/* 6. Recertifications due: the certificate register owns recertifying */}
                        <Link to="/manage/certificates?filter=expiring" className={cn(
                            "block rounded-[8px] border p-4 space-y-2 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent",
                            metrics.expiringCertificatesCount > 0 ? "border-ds-warning/40 bg-ds-warning-soft/20 hover:border-ds-warning" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{t('tracking.cc.recertDue', 'Certificates expiring')}</span>
                                <Clock className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.expiringCertificatesCount}</span>
                                <span className="text-xs text-ds-muted font-medium">{t('tracking.cc.certificatesUnit', 'certificates')}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {t('tracking.cc.recertHint', 'Within 30 days. Open certificates to recertify')}
                            </p>
                        </Link>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-7 shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base font-semibold text-ds-ink">
                                        {t('tracking.cc.activityTitle', 'Started and completed per day')}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-ds-muted">
                                        {t('tracking.cc.activityHint', 'Last 14 days')}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="h-[280px] w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                                        <AreaChart data={metrics.completionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="rgb(var(--ds-success))" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="rgb(var(--ds-success))" stopOpacity={0.0}/>
                                                </linearGradient>
                                                <linearGradient id="startedGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="rgb(var(--ds-warning))" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="rgb(var(--ds-warning))" stopOpacity={0.0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--ds-border))" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgb(var(--ds-muted))' }} />
                                            <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--ds-muted))' }} allowDecimals={false} />
                                            <Tooltip contentStyle={{ backgroundColor: 'rgb(var(--ds-surface))', borderColor: 'rgb(var(--ds-border))', borderRadius: '8px', color: 'rgb(var(--ds-ink))', fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="completed" name={t('tracking.cc.completed', 'completed')} stroke="rgb(var(--ds-success))" strokeWidth={2.5} fillOpacity={1} fill="url(#completedGrad)" />
                                            <Area type="monotone" dataKey="started" name={t('tracking.cc.started', 'Started')} stroke="rgb(var(--ds-warning))" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#startedGrad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-5 shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base font-semibold text-ds-ink">
                                        {t('tracking.cc.deptTitle', 'By department')}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-ds-muted">
                                        {t('tracking.cc.deptHint', 'Share completed on time, and average quiz score')}
                                    </CardDescription>
                                </div>
                                <Shield className="h-4 w-4 text-ds-accent" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar-light pe-1">
                                    {metrics.departmentPerformance.length === 0 ? (
                                        <div className="py-12 text-center text-xs text-ds-muted">
                                            {t('tracking.cc.deptEmpty', 'No department data yet')}
                                        </div>
                                    ) : (
                                        metrics.departmentPerformance.map((dept) => (
                                            <div key={dept.name} className="space-y-1 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-2.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-ds-ink">{dept.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {dept.avgScore !== null && (
                                                            <span className="text-[11px] text-ds-muted font-medium">
                                                                {dept.avgScore}% {t('tracking.cc.score', 'score')}
                                                            </span>
                                                        )}
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                                                            dept.compliance >= 90 ? "bg-ds-success-soft text-ds-success" :
                                                            dept.compliance >= 75 ? "bg-ds-warning-soft text-ds-warning" : "bg-ds-danger-soft text-ds-danger"
                                                        )}>
                                                            {dept.compliance}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-ds-border rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all",
                                                            dept.compliance >= 90 ? "bg-ds-success" :
                                                            dept.compliance >= 75 ? "bg-ds-warning" : "bg-ds-danger"
                                                        )}
                                                        style={{ width: `${dept.compliance}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ─── TAB 3: COURSE HEALTH & KNOWLEDGE GAPS ─── */}
                <TabsContent value="modules" className="space-y-6 animate-in fade-in duration-300">
                    {/* Top Radar: Tricky Knowledge Gaps */}
                    <Card className="border border-ds-border bg-ds-surface rounded-[8px] shadow-none">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-[6px] bg-ds-accent-soft flex items-center justify-center text-ds-accent shadow-none">
                                        <Brain className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-semibold text-ds-ink">
                                            {t('tracking.cc.gapsTitle', 'Questions people get wrong most')}
                                        </CardTitle>
                                        <CardDescription className="text-xs text-ds-muted">
                                            {t('tracking.cc.gapsHint', 'Lowest share of correct answers. These topics may need clearer training.')}
                                        </CardDescription>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-[4px] bg-ds-accent-soft text-ds-accent font-semibold text-xs border border-ds-accent/30">
                                    AI Analyzed
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                                {metrics.knowledgeGaps.length === 0 ? (
                                    <div className="col-span-full py-8 text-center text-xs text-ds-muted">
                                        {t('tracking.cc.gapsEmpty', 'No weak questions. Most people answer every question correctly.')}
                                    </div>
                                ) : (
                                    metrics.knowledgeGaps.map((gap) => (
                                        <div
                                            key={gap.id}
                                            onClick={() => setSelectedQuestionForDetail(gap)}
                                            className="group cursor-pointer rounded-[6px] border border-ds-border bg-ds-surface-subtle p-3.5 hover:border-ds-border-strong hover:bg-ds-surface transition-all space-y-2"
                                        >
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="px-1.5 py-0.5 rounded text-[11px] font-medium border border-ds-border bg-ds-surface text-ds-muted">
                                                    {gap.category}
                                                </span>
                                                <span className={cn(
                                                    "font-bold text-xs",
                                                    gap.accuracyRate < 60 ? "text-ds-danger" : "text-ds-warning"
                                                )}>
                                                    {gap.accuracyRate}% {t('tracking.cc.accuracy', 'correct')}
                                                </span>
                                            </div>
                                            <p className="text-xs font-semibold text-ds-ink line-clamp-2 leading-relaxed group-hover:text-ds-accent transition-colors">
                                                "{gap.questionText}"
                                            </p>
                                            <div className="text-[11px] text-ds-muted flex items-center justify-between pt-1 border-t border-ds-border/60">
                                                <span>{gap.attempts} {t('tracking.cc.attempts', 'attempts')}</span>
                                                <span className="text-ds-accent font-semibold flex items-center gap-0.5">
                                                    {t('tracking.cc.view', 'View')}
                                                    <ArrowRight className="h-2.5 w-2.5 rtl:rotate-180" />
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Course Health & Pass Rate Matrix */}
                    <Card className="shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-ds-ink">
                                    {t('tracking.cc.coursesTitle', 'Courses')}
                                </CardTitle>
                                <CardDescription className="text-xs text-ds-muted">
                                    {t('tracking.cc.coursesHint', 'Select a course to see where people stop and who is enrolled.')}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={moduleHealthFilter} onValueChange={(v: any) => setModuleHealthFilter(v)}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-ds-surface border-ds-border text-ds-ink">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('tracking.cc.allCourses', 'All')}</SelectItem>
                                        <SelectItem value="needs_attention">{t('tracking.cc.needsAttention', 'Needs attention')}</SelectItem>
                                        <SelectItem value="healthy">{t('tracking.cc.healthy', 'On track')}</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="relative w-44">
                                    <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-ds-muted" />
                                    <Input
                                        value={moduleSearch}
                                        onChange={(e) => setModuleSearch(e.target.value)}
                                        placeholder={t('tracking.cc.searchCourses', 'Search courses')}
                                        className="h-8 text-xs ps-8 bg-ds-surface border-ds-border text-ds-ink"
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-start text-xs">
                                    <thead className="bg-ds-surface-subtle text-ds-muted uppercase tracking-wider font-semibold border-y border-ds-border">
                                        <tr>
                                            <th className="py-3 px-4">{t('tracking.cc.course', 'Course')}</th>
                                            <th className="py-3 px-4 text-center">{t('tracking.cc.status', 'Status')}</th>
                                            <th className="py-3 px-4 text-center">{t('tracking.cc.enrolled', 'Enrolled')}</th>
                                            <th className="py-3 px-4 text-center">{t('tracking.cc.completionRate', 'Completed')}</th>
                                            <th className="py-3 px-4 text-center">{t('tracking.cc.avgScore', 'Avg score')}</th>
                                            <th className="py-3 px-4 text-center">{t('tracking.cc.dropOff', 'Most people stop at')}</th>
                                            <th className="py-3 px-4 text-end">{t('tracking.cc.details', 'Details')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ds-border/60">
                                        {displayedModules.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-ds-muted">
                                                    {t('tracking.cc.noCourses', 'No courses match.')}
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedModules.map((mod) => (
                                                <tr key={mod.id} className="hover:bg-ds-surface-subtle/80 transition-colors">
                                                    <td className="py-3 px-4 font-semibold text-ds-ink max-w-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn(
                                                                "h-2 w-2 rounded-full shrink-0",
                                                                mod.isHealthy ? "bg-ds-success" : "bg-ds-warning"
                                                            )} />
                                                            <span className="truncate">{mod.title}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge variant={mod.status === 'published' ? 'default' : 'secondary'} className="text-[11px] capitalize">
                                                            {mod.status || 'published'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-medium text-ds-ink">
                                                        {mod.enrolled}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="w-14 bg-ds-border h-1.5 rounded-full overflow-hidden hidden sm:block">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full",
                                                                        mod.completionRate >= 80 ? "bg-ds-success" :
                                                                        mod.completionRate >= 50 ? "bg-ds-warning" : "bg-ds-muted"
                                                                    )}
                                                                    style={{ width: `${mod.completionRate}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-semibold text-ds-ink">{mod.completionRate}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {mod.avgScore !== null ? (
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                                                                mod.avgScore >= mod.passingScore ? "bg-ds-success-soft text-ds-success" : "bg-ds-danger-soft text-ds-danger"
                                                            )}>
                                                                {mod.avgScore}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-ds-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {mod.worstDropBlock ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-ds-warning-soft text-ds-warning border border-ds-warning/30">
                                                                {t('tracking.cc.dropStep', 'Step {{step}}', { step: mod.worstDropBlock.order })}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-ds-success font-medium">{t('tracking.cc.noDropOff', 'No clear drop-off')}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-end">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedModuleForDrilldown(mod)}
                                                            className="h-7 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle"
                                                        >
                                                            <Eye className="me-1 h-3.5 w-3.5 text-ds-muted" />
                                                            {t('tracking.cc.open', 'Open')}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* ─── MODAL 1: COURSE DRILLDOWN INSPECTOR ─── */}
            <Dialog open={!!selectedModuleForDrilldown} onOpenChange={(open) => !open && setSelectedModuleForDrilldown(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border border-ds-border bg-ds-surface text-ds-ink">
                    <DialogHeader>
                        <div className="flex items-center justify-between pe-6">
                            <span className="px-2 py-0.5 rounded-[4px] bg-ds-accent-soft text-ds-accent font-semibold text-xs border border-ds-accent/30">
                                {t('tracking.cc.courseDetails', 'Course details')}
                            </span>
                            <span className="text-xs text-ds-muted">{selectedModuleForDrilldown?.durationMinutes} mins</span>
                        </div>
                        <DialogTitle className="text-lg font-semibold text-ds-ink pt-1">
                            {selectedModuleForDrilldown?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ds-muted">
                            {selectedModuleForDrilldown?.description || (t('tracking.cc.courseDetailsHint', 'How many people finish each step, and who is enrolled.'))}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedModuleForDrilldown && (
                        <div className="space-y-6 pt-2">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-4 gap-3 text-center">
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{t('tracking.cc.enrolled', 'Enrolled')}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.enrolled}</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{t('tracking.cc.completedLabel', 'Completed')}</div>
                                    <div className="text-xl font-bold font-mono text-ds-success mt-1">{selectedModuleForDrilldown.completed}</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{t('tracking.cc.completionRateDetail', 'Completion rate')}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.completionRate}%</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{t('tracking.cc.avgQuizScore', 'Avg quiz score')}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.avgScore ?? '—'}%</div>
                                </div>
                            </div>

                            {/* Block Retention & Drop-Off Funnel */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-ds-ink flex items-center justify-between">
                                    <span>{t('tracking.cc.stepsTitle', 'Step by step')}</span>
                                    <span className="text-xs text-ds-muted font-normal">{selectedModuleForDrilldown.blocks.length} {t('tracking.cc.steps', 'steps')}</span>
                                </h4>
                                {selectedModuleForDrilldown.blocks.length === 0 ? (
                                    <p className="text-xs text-ds-muted py-4 text-center">{t('tracking.cc.noSteps', 'This course has no steps yet.')}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedModuleForDrilldown.blocks.map((block: any) => (
                                            <div key={block.id} className="rounded-[6px] border border-ds-border bg-ds-surface-subtle p-2.5 text-xs space-y-1.5">
                                                <div className="flex items-center justify-between font-semibold">
                                                    <span className="text-ds-ink flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[11px] bg-ds-surface border-ds-border">#{block.order}</Badge>
                                                        {block.title}
                                                    </span>
                                                    <span className="text-ds-accent font-mono font-bold">{block.retentionRate}% {t('tracking.cc.finished', 'finished')}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-ds-border rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all",
                                                            block.retentionRate >= 80 ? "bg-ds-success" :
                                                            block.retentionRate >= 50 ? "bg-ds-warning" : "bg-ds-danger"
                                                        )}
                                                        style={{ width: `${block.retentionRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Enrolled Learners Roster for this module */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-ds-ink">
                                    {t('tracking.cc.enrolledPeople', 'Enrolled people')} ({selectedModuleForDrilldown.learners.length})
                                </h4>
                                <div className="max-h-48 overflow-y-auto border border-ds-border rounded-[6px] divide-y divide-ds-border/60 text-xs">
                                    {selectedModuleForDrilldown.learners.length === 0 ? (
                                        <div className="p-4 text-center text-ds-muted">{t('tracking.cc.noEnrolled', 'Nobody is enrolled yet.')}</div>
                                    ) : (
                                        selectedModuleForDrilldown.learners.map((lr: any) => {
                                            const prof = lr.profiles as any
                                            return (
                                                <div key={lr.id} className="p-2.5 flex items-center justify-between hover:bg-ds-surface-subtle transition-colors">
                                                    <div>
                                                        <div className="font-semibold text-ds-ink">{prof?.full_name || 'Staff Member'}</div>
                                                        <div className="text-[11px] text-ds-muted">{prof?.email}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-xs font-semibold text-ds-muted">{lr.progress_percentage || 0}%</span>
                                                        <Badge variant={lr.status === 'completed' ? 'default' : 'secondary'} className="text-[11px] capitalize">
                                                            {lr.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        {canManageModules && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    onNavigateToBuilder?.(selectedModuleForDrilldown?.id)
                                    setSelectedModuleForDrilldown(null)
                                }}
                                className="text-xs border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle"
                            >
                                {t('tracking.cc.editCourse', 'Edit course')}
                            </Button>
                        )}
                        <Button onClick={() => setSelectedModuleForDrilldown(null)} className="text-xs bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90">
                            {t('common:action.close', 'Close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL 2: QUESTION GAP DETAIL MODAL ─── */}
            <Dialog open={!!selectedQuestionForDetail} onOpenChange={(open) => !open && setSelectedQuestionForDetail(null)}>
                <DialogContent className="max-w-lg border border-ds-border bg-ds-surface text-ds-ink">
                    <DialogHeader>
                        <span className="w-fit px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[11px] font-semibold">
                            {selectedQuestionForDetail?.accuracyRate}% {t('tracking.cc.accuracyRate', 'Answered correctly')}
                        </span>
                        <DialogTitle className="text-base font-semibold text-ds-ink pt-1">
                            {selectedQuestionForDetail?.category}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ds-muted">
                            {t('tracking.cc.questionHint', 'Many people answer this question wrong.')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedQuestionForDetail && (
                        <div className="space-y-4 pt-2 text-xs">
                            <div className="p-3 bg-ds-surface-subtle rounded-[6px] border border-ds-border">
                                <span className="font-semibold text-ds-muted uppercase tracking-wider text-[11px]">{t('tracking.cc.question', 'Question')}</span>
                                <p className="font-semibold text-ds-ink mt-1 text-sm leading-relaxed">
                                    "{selectedQuestionForDetail.questionText}"
                                </p>
                            </div>

                            <div className="p-3 bg-ds-accent-soft/30 rounded-[6px] border border-ds-accent/30">
                                <span className="font-semibold text-ds-accent uppercase tracking-wider text-[11px] flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-ds-accent" />
                                    {t('tracking.cc.explanation', 'Explanation')}
                                </span>
                                <p className="text-ds-ink mt-1 leading-relaxed">
                                    {selectedQuestionForDetail.explanation}
                                </p>
                            </div>

                            <div className="text-[11px] text-ds-muted">
                                {t('tracking.cc.basedOnAttempts', 'Based on {{count}} answers.', { count: selectedQuestionForDetail.attempts })}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setSelectedQuestionForDetail(null)} className="text-xs bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90">
                            {t('common:action.close', 'Close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
