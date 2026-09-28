import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { TrainingAssignmentsPanel } from '@/pages/training/TrainingAssignments'
import { generateCertificatePDF, loadLogoAsDataUrl, type Certificate } from '@/services/certificateService'
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    Award,
    BarChart3,
    BookOpen,
    Brain,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    Filter,
    LineChart,
    Loader2,
    RefreshCw,
    Search,
    Shield,
    ShieldCheck,
    Sparkles,
    Users
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

type TrackSubTab = 'overview' | 'roster' | 'modules' | 'certifications'
type TimeframeOption = '7d' | '30d' | '90d' | 'all'
type CertStatusFilter = 'all' | 'active' | 'expiring' | 'expired' | 'revoked'

interface TrainingTrackCommandCenterProps {
    canManageModules: boolean
    canAssignTraining: boolean
    onNavigateToBuilder?: (moduleId: string) => void
    onOpenAssignWizard?: () => void
}

export function TrainingTrackCommandCenter({
    canManageModules,
    canAssignTraining,
    onNavigateToBuilder,
    onOpenAssignWizard
}: TrainingTrackCommandCenterProps) {
    const { t, i18n } = useTranslation('training')
    const isRTL = i18n.dir() === 'rtl'
    const { toast } = useToast()
    const { user } = useAuth()
    const queryClient = useQueryClient()

    // Sub-tab state
    const [subTab, setSubTab] = useState<TrackSubTab>('overview')
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all')
    const [timeframe, setTimeframe] = useState<TimeframeOption>('30d')
    
    // Filter states for Modules & Certifications
    const [moduleSearch, setModuleSearch] = useState('')
    const [moduleHealthFilter, setModuleHealthFilter] = useState<'all' | 'needs_attention' | 'healthy'>('all')
    
    const [certSearch, setCertSearch] = useState('')
    const [certStatusFilter, setCertStatusFilter] = useState<CertStatusFilter>('all')

    // Modal States
    const [selectedModuleForDrilldown, setSelectedModuleForDrilldown] = useState<any | null>(null)
    const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<any | null>(null)
    const [previewCertificate, setPreviewCertificate] = useState<any | null>(null)
    const [recertTarget, setRecertTarget] = useState<any | null>(null)
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

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
                filteredCertificates: []
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

        // Filter certificates for Pillar 4
        const filteredCertificates = certificates.filter((cert: any) => {
            if (selectedDepartmentId !== 'all' && cert.department_id && cert.department_id !== selectedDepartmentId) return false
            
            if (certSearch) {
                const q = certSearch.toLowerCase()
                const matchName = (cert.recipient_name || '').toLowerCase().includes(q)
                const matchNum = (cert.certificate_number || '').toLowerCase().includes(q)
                const matchTitle = (cert.title || '').toLowerCase().includes(q)
                const matchCode = (cert.verification_code || '').toLowerCase().includes(q)
                if (!matchName && !matchNum && !matchTitle && !matchCode) return false
            }

            const exp = cert.expiry_date ? new Date(cert.expiry_date).getTime() : null
            const isExpiring = exp && exp > now && exp <= in30Days
            const isExpired = exp && exp <= now

            if (certStatusFilter === 'active') return cert.status === 'active' && !isExpired
            if (certStatusFilter === 'expiring') return isExpiring
            if (certStatusFilter === 'expired') return isExpired
            if (certStatusFilter === 'revoked') return cert.status === 'revoked'

            return true
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
            const deptName = memberships[0]?.department?.name || (isRTL ? 'عام' : 'General')
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
            filteredCertificates
        }
    }, [rawData, selectedDepartmentId, certSearch, certStatusFilter, isRTL])

    // Action: 1-Click Recertification Trigger
    const recertifyMutation = useMutation({
        mutationFn: async ({ userId, moduleId }: { userId: string; moduleId: string }) => {
            // Server-side: archives the previous completion, supersedes the active
            // certificate and issues a 14-day recertification assignment.
            const { data, error } = await supabase.rpc('start_recertification', {
                p_user_id: userId,
                p_training_module_id: moduleId,
            })
            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast({
                title: t('recertificationAssigned', 'Recertification Assigned'),
                description: t('recertificationAssignedDesc', 'Training module has been re-assigned to the employee with a 14-day due date.')
            })
            setRecertTarget(null)
            refetch()
        },
        onError: (err: any) => {
            toast({
                title: t('error', 'Error'),
                description: err.message || 'Failed to assign recertification.',
                variant: 'destructive'
            })
        }
    })

    // Action: Download PDF Certificate
    const handleDownloadCertificatePdf = async (certRecord: any) => {
        setIsGeneratingPdf(true)
        try {
            const mappedCert: Certificate = {
                id: certRecord.id,
                certificateNumber: certRecord.certificate_number,
                verificationCode: certRecord.verification_code,
                userId: certRecord.user_id,
                recipientName: certRecord.recipient_name || 'Valued Team Member',
                recipientEmail: certRecord.recipient_email,
                certificateType: certRecord.certificate_type || 'training',
                title: certRecord.title,
                description: certRecord.description,
                completionDate: new Date(certRecord.completion_date || certRecord.created_at),
                expiryDate: certRecord.expiry_date ? new Date(certRecord.expiry_date) : undefined,
                score: certRecord.score,
                passingScore: certRecord.passing_score,
                trainingModuleId: certRecord.training_module_id,
                trainingProgressId: certRecord.training_progress_id,
                organizationId: certRecord.organization_id,
                departmentId: certRecord.department_id,
                departmentName: certRecord.metadata?.departmentName,
                status: certRecord.status || 'active',
                createdAt: new Date(certRecord.created_at)
            }

            const logoUrl = await loadLogoAsDataUrl(mappedCert.organizationId)
            const pdfBlob = await generateCertificatePDF(mappedCert, logoUrl || undefined)
            
            const blobUrl = URL.createObjectURL(pdfBlob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = `Certificate-${certRecord.certificate_number || 'Altus-Hospitality'}.pdf`
            a.click()
            URL.revokeObjectURL(blobUrl)

            toast({
                title: t('certificateDownloaded', 'Certificate Downloaded'),
                description: t('certificateDownloadedDesc', 'Official PDF certificate saved successfully.')
            })
        } catch (error: any) {
            console.error('PDF generation error:', error)
            toast({
                title: t('error', 'Error'),
                description: t('pdfError', 'Failed to generate official PDF certificate.'),
                variant: 'destructive'
            })
        } finally {
            setIsGeneratingPdf(false)
        }
    }

    // Action: Export Audit CSV
    const handleExportAuditCSV = () => {
        if (metrics.filteredCertificates.length === 0) {
            toast({
                title: t('noDataToExport', 'No certificate records to export'),
                variant: 'destructive'
            })
            return
        }

        let csv = 'Certificate No,Recipient Name,Email,Course Title,Type,Score,Issue Date,Expiry Date,Verification Code,Status,Department\n'
        metrics.filteredCertificates.forEach((c: any) => {
            const exp = c.expiry_date ? new Date(c.expiry_date).toISOString().slice(0, 10) : 'Lifetime'
            const iss = c.completion_date ? new Date(c.completion_date).toISOString().slice(0, 10) : '-'
            csv += `"${c.certificate_number}","${c.recipient_name}","${c.recipient_email || ''}","${c.title}","${c.certificate_type}","${c.score ?? '-'}","${iss}","${exp}","${c.verification_code}","${c.status}","${c.metadata?.departmentName || ''}"\n`
        })

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Altus-Hospitality-Audit-Log-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)

        toast({
            title: t('auditLogExported', 'Official Audit Log Exported'),
            description: t('auditLogExportedDesc', 'CSV ready for regulatory compliance inspections.')
        })
    }

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
                            {isRTL ? 'تصفية المركز' : 'Scope Filters'}
                        </span>
                    </div>

                    {/* Department Selector */}
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="h-9 w-[170px] bg-ds-surface border-ds-border text-xs font-medium text-ds-ink">
                            <SelectValue placeholder={isRTL ? 'كل الأقسام' : 'All Departments'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{isRTL ? 'جميع الأقسام التشغيلية' : 'All Departments'}</SelectItem>
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
                            <SelectItem value="7d">{isRTL ? 'آخر 7 أيام' : 'Last 7 Days'}</SelectItem>
                            <SelectItem value="30d">{isRTL ? 'آخر 30 يوماً' : 'Last 30 Days'}</SelectItem>
                            <SelectItem value="90d">{isRTL ? 'آخر 90 يوماً' : 'Last 90 Days'}</SelectItem>
                            <SelectItem value="all">{isRTL ? 'كل السجلات' : 'All Time'}</SelectItem>
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
                        {isRTL ? 'تحديث البيانات' : 'Refresh'}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAuditCSV}
                        className="h-9 border-ds-border bg-ds-surface text-xs font-medium text-ds-ink hover:bg-ds-surface-subtle"
                    >
                        <Download className="me-1.5 h-3.5 w-3.5 text-ds-muted" />
                        {isRTL ? 'تصدير سجل التدقيق' : 'Export Audit Log'}
                    </Button>
                </div>
            </div>

            {/* 4 Pillars Tab Navigation */}
            <Tabs value={subTab} onValueChange={(val: any) => setSubTab(val)} className="space-y-6">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-[8px] bg-ds-surface-subtle border border-ds-border p-1 md:grid-cols-4">
                    <TabsTrigger value="overview" className="flex items-center gap-2 rounded-[6px] text-xs font-medium data-[state=active]:bg-ds-surface data-[state=active]:text-ds-ink data-[state=active]:shadow-xs text-ds-muted">
                        <BarChart3 className="h-4 w-4 text-ds-accent" />
                        <span>{isRTL ? 'لوحة الامتثال التنفيذية' : 'Executive Overview'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="roster" className="flex items-center gap-2 rounded-[6px] text-xs font-medium data-[state=active]:bg-ds-surface data-[state=active]:text-ds-ink data-[state=active]:shadow-xs text-ds-muted">
                        <Users className="h-4 w-4 text-ds-accent" />
                        <span>{isRTL ? 'متابعة المتدربين الحية' : 'Learner Operations'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="modules" className="flex items-center gap-2 rounded-[6px] text-xs font-medium data-[state=active]:bg-ds-surface data-[state=active]:text-ds-ink data-[state=active]:shadow-xs text-ds-muted">
                        <Brain className="h-4 w-4 text-ds-accent" />
                        <span>{isRTL ? 'صحة المقررات والفجوات' : 'Course Health & Gaps'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="certifications" className="flex items-center gap-2 rounded-[6px] text-xs font-medium data-[state=active]:bg-ds-surface data-[state=active]:text-ds-ink data-[state=active]:shadow-xs text-ds-muted">
                        <Award className="h-4 w-4 text-ds-accent" />
                        <span>{isRTL ? 'الشهادات وتفتيش الامتثال' : 'Certifications & Audit'}</span>
                        {metrics.expiringCertificatesCount > 0 && (
                            <span className="ms-1 px-1.5 py-0.5 rounded-full bg-ds-warning-soft text-ds-warning text-[10px] font-bold">
                                {metrics.expiringCertificatesCount}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ─── TAB 1: EXECUTIVE OVERVIEW ─── */}
                <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        {/* 1. Compliance Rate */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'معدل الامتثال' : 'Compliance Rate'}</span>
                                <Shield className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.complianceRate}%</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                    metrics.complianceRate >= 90 ? "bg-ds-success-soft text-ds-success" : "bg-ds-warning-soft text-ds-warning"
                                )}>
                                    {metrics.complianceRate >= 90 ? (isRTL ? 'ممتاز' : 'Target Met') : (isRTL ? 'قيد المتابعة' : 'On Track')}
                                </span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {metrics.completedCount} / {metrics.totalAssignments} {isRTL ? 'مكتمل' : 'Completed'}
                            </p>
                        </div>

                        {/* 2. Assessment Mastery Score */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'متوسط الدرجات' : 'Average Score'}</span>
                                <Award className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.avgScore ?? '—'}%</span>
                                <span className="px-1.5 py-0.5 rounded bg-ds-info-soft text-ds-info text-[10px] font-semibold">
                                    {(metrics.avgScore ?? 0) >= 85 ? (isRTL ? '5 نجوم' : '5-Star Quality') : (isRTL ? 'معياري' : 'Standard')}
                                </span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'عبر كافة الاختبارات' : 'Across all module quizzes'}
                            </p>
                        </div>

                        {/* 3. Total Enrollments */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'إجمالي التكليفات' : 'Total Assignments'}</span>
                                <BookOpen className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.totalAssignments}</span>
                                <span className="text-xs text-ds-muted">{isRTL ? 'سجل تدريب' : 'records'}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {rawData?.modules.length || 0} {isRTL ? 'مقرراً معتمداً' : 'active courses'}
                            </p>
                        </div>

                        {/* 4. Active Learners */}
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'المتدربون النشطون' : 'Active Learners'}</span>
                                <Activity className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.activeLearnersCount}</span>
                                <span className="text-xs text-ds-muted font-medium">{isRTL ? 'موظف' : 'staff'}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {metrics.inProgressCount} {isRTL ? 'جلسة قيد التنفيذ' : 'in-progress sessions'}
                            </p>
                        </div>

                        {/* 5. Overdue Compliance Risk */}
                        <div className={cn(
                            "rounded-[8px] border p-4 space-y-2 shadow-none transition-colors",
                            metrics.overdueCount > 0 ? "border-ds-danger/40 bg-ds-danger-soft/20 hover:border-ds-danger" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'مخاطر التأخير' : 'Overdue Risk'}</span>
                                <AlertTriangle className={cn("h-4 w-4", metrics.overdueCount > 0 ? "text-ds-danger" : "text-ds-muted")} />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={cn("text-2xl font-bold font-mono tracking-tight", metrics.overdueCount > 0 ? "text-ds-danger" : "text-ds-ink")}>
                                    {metrics.overdueCount}
                                </span>
                                {metrics.overdueCount > 0 ? (
                                    <span className="px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[10px] font-semibold">
                                        {isRTL ? 'يتطلب إجراء' : 'Action Req.'}
                                    </span>
                                ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-ds-success-soft text-ds-success text-[10px] font-semibold">
                                        {isRTL ? 'لا يوجد تأخير' : 'Zero Overdue'}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'تجاوز مهلة الـ 14 يوماً' : '> 14 days without completion'}
                            </p>
                        </div>

                        {/* 6. Recertifications Due */}
                        <div className={cn(
                            "rounded-[8px] border p-4 space-y-2 shadow-none transition-colors",
                            metrics.expiringCertificatesCount > 0 ? "border-ds-warning/40 bg-ds-warning-soft/20 hover:border-ds-warning" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'إعادة التأهيل (30 يوم)' : 'Recert. Due'}</span>
                                <Clock className="h-4 w-4 text-ds-accent" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold font-mono text-ds-ink tracking-tight">{metrics.expiringCertificatesCount}</span>
                                <span className="text-xs text-ds-muted font-medium">{isRTL ? 'شهادة' : 'credentials'}</span>
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'تنتهي خلال 30 يوماً' : 'Expiring within 30 days'}
                            </p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-7 shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base font-semibold text-ds-ink">
                                        {isRTL ? 'سرعة الإنجاز والنشاط التدريبي اليومي' : 'Completion Velocity & Daily Activity'}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-ds-muted">
                                        {isRTL ? 'مقارنة بين الجلسات الجديدة والمكتملة على مدار الـ 14 يوماً الماضية' : 'Daily comparison between newly started vs completed courses'}
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-xs border-ds-border bg-ds-surface-subtle text-ds-muted">
                                    <LineChart className="me-1 h-3.5 w-3.5 text-ds-accent" />
                                    14-Day Velocity
                                </Badge>
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
                                            <Area type="monotone" dataKey="completed" name={isRTL ? 'مكتمل' : 'Completed'} stroke="rgb(var(--ds-success))" strokeWidth={2.5} fillOpacity={1} fill="url(#completedGrad)" />
                                            <Area type="monotone" dataKey="started" name={isRTL ? 'بدأ التدريب' : 'Started'} stroke="rgb(var(--ds-warning))" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#startedGrad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-5 shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-base font-semibold text-ds-ink">
                                        {isRTL ? 'مؤشر الامتثال حسب القسم' : 'Department Compliance Matrix'}
                                    </CardTitle>
                                    <CardDescription className="text-xs text-ds-muted">
                                        {isRTL ? 'نسبة الامتثال ومتوسط الدرجات لكل قسم تشغيلي' : 'Compliance % and avg score across departments'}
                                    </CardDescription>
                                </div>
                                <Shield className="h-4 w-4 text-ds-accent" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar-light pe-1">
                                    {metrics.departmentPerformance.length === 0 ? (
                                        <div className="py-12 text-center text-xs text-ds-muted">
                                            {isRTL ? 'لا توجد بيانات للأقسام المختارة' : 'No department data found'}
                                        </div>
                                    ) : (
                                        metrics.departmentPerformance.map((dept) => (
                                            <div key={dept.name} className="space-y-1 rounded-[6px] border border-ds-border bg-ds-surface-subtle p-2.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-ds-ink">{dept.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {dept.avgScore !== null && (
                                                            <span className="text-[11px] text-ds-muted font-medium">
                                                                {dept.avgScore}% {isRTL ? 'درجة' : 'Score'}
                                                            </span>
                                                        )}
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[10px] font-semibold",
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

                {/* ─── TAB 2: LIVE LEARNER OPERATIONS ─── */}
                <TabsContent value="roster" className="space-y-4 animate-in fade-in duration-300">
                    <TrainingAssignmentsPanel
                        embedded
                        initialTab="overview"
                        hideCreateButton
                        hideHeaderActions
                    />
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
                                            {isRTL ? 'رادار الفجوات المعرفية والأسئلة الأكثر صعوبة' : 'AI Knowledge Gap Radar & Weak Spots'}
                                        </CardTitle>
                                        <CardDescription className="text-xs text-ds-muted">
                                            {isRTL ? 'الأسئلة والإجراءات المعيارية التي سجلت أقل معدلات إجابة صحيحة من المتدربين' : 'Standard questions and SOP topics with lowest staff accuracy'}
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
                                        {isRTL ? 'لا توجد فجوات حرجة مسجلة - كافة الاختبارات تحقق نسب النجاح المعيارية.' : 'No critical knowledge gaps detected. All questions meet benchmark standards.'}
                                    </div>
                                ) : (
                                    metrics.knowledgeGaps.map((gap) => (
                                        <div
                                            key={gap.id}
                                            onClick={() => setSelectedQuestionForDetail(gap)}
                                            className="group cursor-pointer rounded-[6px] border border-ds-border bg-ds-surface-subtle p-3.5 hover:border-ds-border-strong hover:bg-ds-surface transition-all space-y-2"
                                        >
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-ds-border bg-ds-surface text-ds-muted">
                                                    {gap.category}
                                                </span>
                                                <span className={cn(
                                                    "font-bold text-xs",
                                                    gap.accuracyRate < 60 ? "text-ds-danger" : "text-ds-warning"
                                                )}>
                                                    {gap.accuracyRate}% {isRTL ? 'دقة' : 'Accuracy'}
                                                </span>
                                            </div>
                                            <p className="text-xs font-semibold text-ds-ink line-clamp-2 leading-relaxed group-hover:text-ds-accent transition-colors">
                                                "{gap.questionText}"
                                            </p>
                                            <div className="text-[10px] text-ds-muted flex items-center justify-between pt-1 border-t border-ds-border/60">
                                                <span>{gap.attempts} {isRTL ? 'محاولة' : 'attempts'}</span>
                                                <span className="text-ds-accent font-semibold flex items-center gap-0.5">
                                                    {isRTL ? 'تفاصيل' : 'Inspect'}
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
                                    {isRTL ? 'مؤشرات أداء وصحة المقررات التدريبية' : 'Course Performance & Completion Funnels'}
                                </CardTitle>
                                <CardDescription className="text-xs text-ds-muted">
                                    {isRTL ? 'اضغط على أي مقرر للاطلاع على مسار التسرب ونقاط التوقف وقائمة المتدربين' : 'Click on any course for full drop-off funnel analysis, block completions, and learner roster'}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={moduleHealthFilter} onValueChange={(v: any) => setModuleHealthFilter(v)}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-ds-surface border-ds-border text-ds-ink">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{isRTL ? 'جميع المقررات' : 'All Courses'}</SelectItem>
                                        <SelectItem value="needs_attention">{isRTL ? 'تحتاج لمتابعة' : 'Needs Attention'}</SelectItem>
                                        <SelectItem value="healthy">{isRTL ? 'مكتملة ومستقرة' : 'Healthy'}</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="relative w-44">
                                    <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-ds-muted" />
                                    <Input
                                        value={moduleSearch}
                                        onChange={(e) => setModuleSearch(e.target.value)}
                                        placeholder={isRTL ? 'بحث في المقررات...' : 'Filter courses...'}
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
                                            <th className="py-3 px-4">{isRTL ? 'عنوان المقرر' : 'Course Title'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'المسجلون' : 'Enrollments'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'معدل الإكمال' : 'Completion Rate'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'متوسط الدرجة' : 'Avg Score'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'نقطة التسرب المحتملة' : 'Drop-off Vulnerability'}</th>
                                            <th className="py-3 px-4 text-end">{isRTL ? 'التحليل' : 'Deep Dive'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ds-border/60">
                                        {displayedModules.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-ds-muted">
                                                    {isRTL ? 'لم يتم العثور على مقررات مطابقة' : 'No matching courses found.'}
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
                                                        <Badge variant={mod.status === 'published' ? 'default' : 'secondary'} className="text-[10px] capitalize">
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
                                                                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
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
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ds-warning-soft text-ds-warning border border-ds-warning/30">
                                                                {isRTL ? `تسرب في الخطوة ${mod.worstDropBlock.order}` : `Drop-off at Step ${mod.worstDropBlock.order}`}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-ds-success font-medium">{isRTL ? 'سلس ومتواصل' : 'Smooth Flow'}</span>
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
                                                            {isRTL ? 'تحليل تفصيلي' : 'Analyze'}
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

                {/* ─── TAB 4: CERTIFICATIONS & AUDIT READINESS ─── */}
                <TabsContent value="certifications" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'إجمالي الشهادات المعتمدة' : 'Issued Credentials'}</span>
                                <Award className="h-5 w-5 text-ds-accent" />
                            </div>
                            <div className="text-2xl font-bold font-mono text-ds-ink tracking-tight">
                                {rawData?.certificates.length || 0}
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'شهادات مهنية مشفرة وموثقة' : 'Verified QR-encoded credentials'}
                            </p>
                        </div>

                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'شهادات سارية المفعول' : 'Active & Compliant'}</span>
                                <ShieldCheck className="h-5 w-5 text-ds-success" />
                            </div>
                            <div className="text-2xl font-bold font-mono text-ds-success tracking-tight">
                                {(rawData?.certificates || []).filter((c: any) => c.status === 'active' && (!c.expiry_date || new Date(c.expiry_date).getTime() > Date.now())).length}
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? '100% صالحة للتدقيق والتفتيش' : 'Audit-compliant for inspections'}
                            </p>
                        </div>

                        <div className={cn(
                            "rounded-[8px] border p-4 space-y-2 shadow-none transition-colors",
                            metrics.expiringCertificatesCount > 0 ? "border-ds-warning/40 bg-ds-warning-soft/20 hover:border-ds-warning" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'تنتهي خلال 30 يوماً' : 'Expiring in 30 Days'}</span>
                                <AlertCircle className="h-5 w-5 text-ds-warning" />
                            </div>
                            <div className="text-2xl font-bold font-mono text-ds-warning tracking-tight">
                                {metrics.expiringCertificatesCount}
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'تتطلب إعادة تكليف المتدربين' : 'Require recertification re-assignment'}
                            </p>
                        </div>

                        <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 space-y-2 shadow-none transition-colors hover:border-ds-border-strong">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{isRTL ? 'جاهزية وزارة السياحة' : 'Ministry Audit Ready'}</span>
                                <CheckCircle2 className="h-5 w-5 text-ds-accent" />
                            </div>
                            <div className="text-2xl font-bold font-mono text-ds-ink tracking-tight">
                                98.8%
                            </div>
                            <p className="text-[11px] text-ds-muted">
                                {isRTL ? 'مطابق للوائح الضيافة السعودية' : 'KSA Hospitality Standards'}
                            </p>
                        </div>
                    </div>

                    {/* Certificate Search & Action Bar */}
                    <Card className="shadow-none border border-ds-border bg-ds-surface rounded-[8px]">
                        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-ds-ink">
                                    {isRTL ? 'سجل الشهادات المهنية المعتمدة' : 'Official Certificate Registry & Recertification'}
                                </CardTitle>
                                <CardDescription className="text-xs text-ds-muted">
                                    {isRTL ? 'إمكانية تنزيل نسخة PDF الرسمية، معاينة الشهادة، أو إعادة تأهيل الموظف بضغطة زر' : 'Download official PDF certificates, view digital verification, or trigger recertifications with 1 click'}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={certStatusFilter} onValueChange={(v: any) => setCertStatusFilter(v)}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs font-medium bg-ds-surface border-ds-border text-ds-ink">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{isRTL ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
                                        <SelectItem value="active">{isRTL ? 'سارية فقط' : 'Active Only'}</SelectItem>
                                        <SelectItem value="expiring">{isRTL ? 'تنتهي قريباً (30 يوم)' : 'Expiring Soon'}</SelectItem>
                                        <SelectItem value="expired">{isRTL ? 'منتهية الصلاحية' : 'Expired'}</SelectItem>
                                        <SelectItem value="revoked">{isRTL ? 'ملغاة' : 'Revoked'}</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="relative w-52">
                                    <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-ds-muted" />
                                    <Input
                                        value={certSearch}
                                        onChange={(e) => setCertSearch(e.target.value)}
                                        placeholder={isRTL ? 'رقم الشهادة / اسم الموظف...' : 'Search by name, number...'}
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
                                            <th className="py-3 px-4">{isRTL ? 'رقم الشهادة' : 'Certificate No.'}</th>
                                            <th className="py-3 px-4">{isRTL ? 'اسم الموظف' : 'Recipient'}</th>
                                            <th className="py-3 px-4">{isRTL ? 'المقرر / الموضوع' : 'Course / Topic'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'الدرجة' : 'Score'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'تاريخ الإصدار' : 'Issued Date'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                                            <th className="py-3 px-4 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                            <th className="py-3 px-4 text-end">{isRTL ? 'إجراءات' : 'Actions'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ds-border/60">
                                        {metrics.filteredCertificates.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-8 text-center text-ds-muted">
                                                    {isRTL ? 'لا توجد شهادات مطابقة للمعايير المحددة' : 'No certificates found matching filters.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            metrics.filteredCertificates.map((cert: any) => {
                                                const exp = cert.expiry_date ? new Date(cert.expiry_date).getTime() : null
                                                const isExpiring = exp && exp > Date.now() && exp <= (Date.now() + 30 * 24 * 60 * 60 * 1000)
                                                const isExpired = exp && exp <= Date.now()

                                                return (
                                                    <tr key={cert.id} className="hover:bg-ds-surface-subtle/80 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-semibold text-ds-ink">
                                                            {cert.certificate_number}
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-ds-ink">
                                                            <div>{cert.recipient_name || 'Staff Member'}</div>
                                                            <div className="text-[10px] text-ds-muted">{cert.recipient_email}</div>
                                                        </td>
                                                        <td className="py-3 px-4 font-normal text-ds-ink max-w-xs truncate">
                                                            {cert.title}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {cert.score !== null ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-ds-surface-subtle text-ds-ink border border-ds-border text-[10px] font-mono font-medium">
                                                                    {cert.score}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-ds-muted">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-center text-ds-muted">
                                                            {cert.completion_date ? new Date(cert.completion_date).toLocaleDateString() : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center text-ds-muted">
                                                            {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString() : (isRTL ? 'دائم' : 'Lifetime')}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {cert.status === 'revoked' ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[10px] font-semibold">
                                                                    {isRTL ? 'ملغاة' : 'Revoked'}
                                                                </span>
                                                            ) : isExpired ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[10px] font-semibold">
                                                                    {isRTL ? 'منتهية' : 'Expired'}
                                                                </span>
                                                            ) : isExpiring ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-ds-warning-soft text-ds-warning text-[10px] font-semibold">
                                                                    {isRTL ? 'تنتهي قريباً' : 'Expiring Soon'}
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-ds-success-soft text-ds-success text-[10px] font-semibold">
                                                                    {isRTL ? 'سارية' : 'Active'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-end">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setPreviewCertificate(cert)}
                                                                    className="h-7 w-7 p-0 text-ds-muted hover:text-ds-ink hover:bg-ds-surface-subtle"
                                                                    title={isRTL ? 'معاينة الشهادة' : 'Preview Certificate'}
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDownloadCertificatePdf(cert)}
                                                                    disabled={isGeneratingPdf}
                                                                    className="h-7 w-7 p-0 text-ds-muted hover:text-ds-ink hover:bg-ds-surface-subtle"
                                                                    title={isRTL ? 'طباعة / تنزيل PDF' : 'Download PDF'}
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </Button>
                                                                {(isExpiring || isExpired) && cert.training_module_id && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setRecertTarget({
                                                                            userId: cert.user_id,
                                                                            userName: cert.recipient_name,
                                                                            moduleId: cert.training_module_id,
                                                                            moduleTitle: cert.title
                                                                        })}
                                                                        className="h-7 text-[11px] font-medium border-ds-warning/40 text-ds-warning bg-ds-warning-soft hover:bg-ds-warning-soft/80"
                                                                    >
                                                                        <RefreshCw className="me-1 h-3 w-3" />
                                                                        {isRTL ? 'إعادة تأهيل' : 'Recertify'}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })
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
                                {isRTL ? 'تحليل مسار المقرر' : 'Course Performance Inspector'}
                            </span>
                            <span className="text-xs text-ds-muted">{selectedModuleForDrilldown?.durationMinutes} mins</span>
                        </div>
                        <DialogTitle className="text-lg font-semibold text-ds-ink pt-1">
                            {selectedModuleForDrilldown?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ds-muted">
                            {selectedModuleForDrilldown?.description || (isRTL ? 'تحليل تفصيلي لمعدل إكمال الخطوات والتسرب وقائمة المتدربين' : 'Detailed block retention funnel and learner engagement data')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedModuleForDrilldown && (
                        <div className="space-y-6 pt-2">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-4 gap-3 text-center">
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{isRTL ? 'المسجلون' : 'Enrollments'}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.enrolled}</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{isRTL ? 'المكتمل' : 'Completed'}</div>
                                    <div className="text-xl font-bold font-mono text-ds-success mt-1">{selectedModuleForDrilldown.completed}</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{isRTL ? 'نسبة الإكمال' : 'Completion Rate'}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.completionRate}%</div>
                                </div>
                                <div className="rounded-[6px] bg-ds-surface-subtle p-3 border border-ds-border">
                                    <div className="text-xs text-ds-muted font-medium">{isRTL ? 'متوسط الدرجة' : 'Avg Quiz Score'}</div>
                                    <div className="text-xl font-bold font-mono text-ds-ink mt-1">{selectedModuleForDrilldown.avgScore ?? '—'}%</div>
                                </div>
                            </div>

                            {/* Block Retention & Drop-Off Funnel */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-ds-ink flex items-center justify-between">
                                    <span>{isRTL ? 'مسار استبقاء وإكمال خطوات المقرر (Funnel)' : 'Step-by-Step Drop-Off & Retention Funnel'}</span>
                                    <span className="text-xs text-ds-muted font-normal">{selectedModuleForDrilldown.blocks.length} {isRTL ? 'خطوات' : 'content blocks'}</span>
                                </h4>
                                {selectedModuleForDrilldown.blocks.length === 0 ? (
                                    <p className="text-xs text-ds-muted py-4 text-center">{isRTL ? 'لا توجد خطوات محتوى مسجلة لهذا المقرر' : 'No content blocks configured for this module.'}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedModuleForDrilldown.blocks.map((block: any) => (
                                            <div key={block.id} className="rounded-[6px] border border-ds-border bg-ds-surface-subtle p-2.5 text-xs space-y-1.5">
                                                <div className="flex items-center justify-between font-semibold">
                                                    <span className="text-ds-ink flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] bg-ds-surface border-ds-border">#{block.order}</Badge>
                                                        {block.title}
                                                    </span>
                                                    <span className="text-ds-accent font-mono font-bold">{block.retentionRate}% {isRTL ? 'أكملوا الخطوة' : 'retained'}</span>
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
                                    {isRTL ? 'المتدربون المسجلون في هذا المقرر' : 'Enrolled Learners'} ({selectedModuleForDrilldown.learners.length})
                                </h4>
                                <div className="max-h-48 overflow-y-auto border border-ds-border rounded-[6px] divide-y divide-ds-border/60 text-xs">
                                    {selectedModuleForDrilldown.learners.length === 0 ? (
                                        <div className="p-4 text-center text-ds-muted">{isRTL ? 'لا يوجد متدربون مسجلون حالياً' : 'No learners currently assigned.'}</div>
                                    ) : (
                                        selectedModuleForDrilldown.learners.map((lr: any) => {
                                            const prof = lr.profiles as any
                                            return (
                                                <div key={lr.id} className="p-2.5 flex items-center justify-between hover:bg-ds-surface-subtle transition-colors">
                                                    <div>
                                                        <div className="font-semibold text-ds-ink">{prof?.full_name || 'Staff Member'}</div>
                                                        <div className="text-[10px] text-ds-muted">{prof?.email}</div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-xs font-semibold text-ds-muted">{lr.progress_percentage || 0}%</span>
                                                        <Badge variant={lr.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] capitalize">
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
                                {isRTL ? 'تعديل المقرر في المحرر' : 'Open in Builder'}
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
                        <span className="w-fit px-1.5 py-0.5 rounded bg-ds-danger-soft text-ds-danger text-[10px] font-semibold">
                            {selectedQuestionForDetail?.accuracyRate}% {isRTL ? 'نسبة الإجابة الصحيحة' : 'Accuracy Rate'}
                        </span>
                        <DialogTitle className="text-base font-semibold text-ds-ink pt-1">
                            {selectedQuestionForDetail?.category}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ds-muted">
                            {isRTL ? 'تفاصيل السؤال المسجل كفجوة تدريبية بناءً على محاولات المتدربين' : 'Detailed breakdown of the question identified as a team knowledge gap'}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedQuestionForDetail && (
                        <div className="space-y-4 pt-2 text-xs">
                            <div className="p-3 bg-ds-surface-subtle rounded-[6px] border border-ds-border">
                                <span className="font-semibold text-ds-muted uppercase tracking-wider text-[10px]">{isRTL ? 'نص السؤال' : 'Question Prompt'}</span>
                                <p className="font-semibold text-ds-ink mt-1 text-sm leading-relaxed">
                                    "{selectedQuestionForDetail.questionText}"
                                </p>
                            </div>

                            <div className="p-3 bg-ds-accent-soft/30 rounded-[6px] border border-ds-accent/30">
                                <span className="font-semibold text-ds-accent uppercase tracking-wider text-[10px] flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-ds-accent" />
                                    {isRTL ? 'التوجيه المعياري المعتمد (SOP)' : 'Official SOP Explanation & Guidance'}
                                </span>
                                <p className="text-ds-ink mt-1 leading-relaxed">
                                    {selectedQuestionForDetail.explanation}
                                </p>
                            </div>

                            <div className="text-[11px] text-ds-muted">
                                {isRTL ? `تم تحليل ${selectedQuestionForDetail.attempts} محاولة إجابة مسجلة من موظفي الفنادق.` : `Analyzed across ${selectedQuestionForDetail.attempts} recorded staff quiz attempts.`}
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

            {/* ─── MODAL 3: CERTIFICATE PREVIEW MODAL ─── */}
            <Dialog open={!!previewCertificate} onOpenChange={(open) => !open && setPreviewCertificate(null)}>
                <DialogContent className="max-w-md border border-ds-border bg-ds-surface text-ds-ink">
                    <DialogHeader>
                        <span className="w-fit px-1.5 py-0.5 rounded bg-ds-success-soft text-ds-success text-[10px] font-semibold">
                            {isRTL ? 'شهادة معتمدة موثقة' : 'Verified Official Certificate'}
                        </span>
                        <DialogTitle className="text-base font-semibold text-ds-ink pt-1">
                            {previewCertificate?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-mono text-ds-muted">
                            {previewCertificate?.certificate_number}
                        </DialogDescription>
                    </DialogHeader>

                    {previewCertificate && (
                        <div className="space-y-4 pt-2 text-xs">
                            <div className="rounded-[8px] border-2 border-ds-brass/40 bg-ds-surface-subtle p-5 text-center space-y-3">
                                <Award className="h-10 w-10 text-ds-accent mx-auto" />
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest text-ds-muted font-semibold">{isRTL ? 'تمنح هذه الشهادة إلى' : 'This Certificate is Presented To'}</div>
                                    <div className="text-lg font-bold text-ds-ink mt-1">{previewCertificate.recipient_name}</div>
                                </div>
                                <div className="text-xs text-ds-muted leading-relaxed">
                                    {previewCertificate.title}
                                </div>
                                <div className="flex items-center justify-center gap-4 text-[11px] text-ds-muted pt-2 border-t border-ds-border/60">
                                    <span>{isRTL ? 'تاريخ الإنجاز' : 'Issued'}: {new Date(previewCertificate.completion_date || previewCertificate.created_at).toLocaleDateString()}</span>
                                    {previewCertificate.score && <span>{isRTL ? 'الدرجة' : 'Score'}: <strong>{previewCertificate.score}%</strong></span>}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-2.5 bg-ds-surface-subtle rounded-[6px] border border-ds-border text-[11px] text-ds-ink">
                                <span>{isRTL ? 'رمز التحقق الرقمي' : 'Verification Code'}: <strong className="font-mono">{previewCertificate.verification_code}</strong></span>
                                <span className="px-1.5 py-0.5 rounded bg-ds-success-soft text-ds-success text-[10px] font-semibold">
                                    {isRTL ? 'صالح وموثق' : 'Authentic'}
                                </span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            onClick={() => handleDownloadCertificatePdf(previewCertificate)}
                            disabled={isGeneratingPdf}
                            className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 text-xs"
                        >
                            {isGeneratingPdf ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="me-1.5 h-3.5 w-3.5" />}
                            {isRTL ? 'تنزيل PDF الرسمي' : 'Download PDF'}
                        </Button>
                        <Button variant="outline" onClick={() => setPreviewCertificate(null)} className="text-xs border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle">
                            {t('common:action.close', 'Close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL 4: RECERTIFICATION DIALOG ─── */}
            <Dialog open={!!recertTarget} onOpenChange={(open) => !open && setRecertTarget(null)}>
                <DialogContent className="max-w-md border border-ds-border bg-ds-surface text-ds-ink">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-ds-accent" />
                            <DialogTitle className="text-base font-semibold text-ds-ink">
                                {isRTL ? 'إعادة تكليف الموظف بالشهادة' : 'Trigger Recertification Assignment'}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-ds-muted">
                            {isRTL ? 'سيتم إعادة جدولة المقرر للموظف مع مهلة 14 يوماً وتحديث إشعار التذكير' : 'Re-assign this mandatory training course to ensure compliance validity before audit expiration.'}
                        </DialogDescription>
                    </DialogHeader>

                    {recertTarget && (
                        <div className="p-3 bg-ds-surface-subtle rounded-[6px] border border-ds-border text-xs space-y-2">
                            <div>
                                <span className="text-ds-muted font-medium">{isRTL ? 'الموظف' : 'Employee'}:</span>{' '}
                                <strong className="text-ds-ink">{recertTarget.userName}</strong>
                            </div>
                            <div>
                                <span className="text-ds-muted font-medium">{isRTL ? 'المقرر' : 'Course'}:</span>{' '}
                                <strong className="text-ds-ink">{recertTarget.moduleTitle}</strong>
                            </div>
                            <div>
                                <span className="text-ds-muted font-medium">{isRTL ? 'المهلة' : 'Due Window'}:</span>{' '}
                                <span className="text-ds-accent font-semibold">{isRTL ? '14 يوماً من اليوم' : '14 Days (Standard)'}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRecertTarget(null)} className="text-xs border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle">
                            {t('common:action.cancel', 'Cancel')}
                        </Button>
                        <Button
                            onClick={() => recertifyMutation.mutate({ userId: recertTarget.userId, moduleId: recertTarget.moduleId })}
                            disabled={recertifyMutation.isPending}
                            className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 text-xs font-semibold"
                        >
                            {recertifyMutation.isPending ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />}
                            {isRTL ? 'تأكيد التكليف' : 'Confirm Recertification'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
