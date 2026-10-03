import { WorkspaceHeader, headerActionClass } from '@/ui'
import { DeleteConfirmation } from '@/components/shared/DeleteConfirmation'
import { ModuleQuickActions } from '@/components/training/hub/ModuleQuickActions'
import { ModuleQuickPreviewSheet } from '@/components/training/hub/ModuleQuickPreviewSheet'
import { ModuleTemplateSelector } from '@/components/training/hub/ModuleTemplateSelector'
import { SmartAICourseCreatorModal } from '@/components/training/hub/SmartAICourseCreatorModal'
import { TrainingCategoryBadge } from '@/components/training/hub/TrainingCategoryBadge'
import { TrainingTrackCommandCenter } from '@/components/training/hub/TrainingTrackCommandCenter'
import { AssignTrainingWizardModal } from '@/components/training/AssignTrainingWizardModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/contexts/TenantContext'
import { useDebounce } from '@/hooks/useDebounce'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    AlertCircle,
    Archive,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Crown,
    Eye,
    FileText,
    FilterX,
    Grid3X3,
    HeartHandshake,
    Layers,
    List,
    Loader2,
    Plus,
    Search,
    Settings,
    Sparkles,
    Tag,
    Trash2,
    TrendingUp,
    Users,
    Utensils,
    Wand2,
    X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TrainingAssignmentsPanel } from './TrainingAssignments'
import { TrainingBuilder } from './TrainingBuilder'
import { MasterVersionSyncModal } from '@/components/platform/MasterVersionSyncModal'
import { platformService } from '@/services/platformService'

// Lazy load heavy chart component
type ModuleStatus = 'draft' | 'pending_review' | 'published' | 'archived'
type ViewMode = 'list' | 'builder' | 'assignments' | 'insights'
type StatusFilterType = 'all' | 'published' | 'draft' | 'pending_review' | 'archived' | 'assigned' | 'trash'
type LayoutMode = 'grid' | 'table'

interface TrainingModule {
  id: string
  title: string
  description?: string | null
  category?: string | null
  estimated_duration_minutes?: number | null
  status?: ModuleStatus
  organization_id?: string | null
  brand_id?: string | null
  scope_type?: string | null
  is_master_template?: boolean | null
  master_source_id?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export default function TrainingHub() {
  const { primaryRole } = useAuth()
  const { currentOrganization, currentBrand, isPlatformAdmin, isPlatformScope } = useTenant()
  const navigate = useNavigate()
  const { id: moduleId } = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'
  const { toast } = useToast()

  const isMasterMode = searchParams.get('master') === 'true' || searchParams.get('isMaster') === 'true'
  const canManageModules = isPlatformAdmin || isPlatformScope || isMasterMode || ['administrator', 'super_admin', 'corporate_admin', 'training_manager', 'author', 'regional_admin', 'regional_hr', 'property_manager'].includes(primaryRole || '')
  const canAssignTraining = ['administrator', 'super_admin', 'corporate_admin', 'training_manager', 'regional_admin', 'regional_hr', 'property_manager', 'property_hr', 'department_head'].includes(primaryRole || '')
  const canReviewModules = isPlatformAdmin || isPlatformScope || ['administrator', 'super_admin', 'corporate_admin', 'training_manager', 'regional_admin', 'regional_hr'].includes(primaryRole || '')

  const rawViewParam = searchParams.get('view')
  const viewParam = (rawViewParam === 'analytics' ? 'insights' : rawViewParam) as ViewMode | null
  const validViews: ViewMode[] = ['list', 'builder', 'assignments', 'insights']
  useEffect(() => {
    if (viewParam === 'assignments') navigate('/manage/assignments', { replace: true })
    else if (viewParam === 'insights') navigate('/manage/compliance', { replace: true })
  }, [viewParam, navigate])

  const viewMode: ViewMode = validViews.includes(viewParam as ViewMode)
    ? (viewParam as ViewMode)
    : (moduleId ? 'builder' : 'list')

  const setViewMode = (
    mode: ViewMode,
    options?: { moduleId?: string; assignModuleId?: string; openAssign?: boolean }
  ) => {
    // Studio authors content. Assigning and tracking belong to the Manage
    // workspace, so those views hand over to it instead of rendering here.
    if (mode === 'assignments') {
      navigate(options?.assignModuleId ? `/manage/assignments?course=${options.assignModuleId}` : '/manage/assignments')
      return
    }
    if (mode === 'insights') {
      navigate('/manage/compliance')
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', mode)

    if (options?.assignModuleId) {
      nextParams.set('assignModuleId', options.assignModuleId)
    } else {
      nextParams.delete('assignModuleId')
    }

    if (options?.openAssign) {
      nextParams.set('openAssign', '1')
    } else {
      nextParams.delete('openAssign')
    }

    if (mode !== 'builder') {
      nextParams.delete('template')
    }

    const builderId = options?.moduleId || moduleId || 'new'
    const targetPath = mode === 'builder' ? `/studio/courses/${builderId}` : '/studio/courses'
    const query = nextParams.toString()
    navigate(query ? `${targetPath}?${query}` : targetPath)
  }

  // Filter & Search state
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all')
  const [durationFilter, setDurationFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('created_at_desc')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid')

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(12)

  // Multi-selection state
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  // Quick Preview Sheet state
  const [previewModuleId, setPreviewModuleId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const assignModuleId = searchParams.get('assignModuleId') || undefined
  const shouldOpenAssign = searchParams.get('openAssign') === '1'

  // Dialog states
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showSmartAIModal, setShowSmartAIModal] = useState(false)
  const [assignWizardOpen, setAssignWizardOpen] = useState(false)

  // Delete states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [moduleToDelete, setModuleToDelete] = useState<TrainingModule | null>(null)

  // Purge states
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false)
  const [moduleToPurge, setModuleToPurge] = useState<TrainingModule | null>(null)

  // Review states
  const [moduleToReject, setModuleToReject] = useState<TrainingModule | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Data fetching: fetch all non-deleted modules scoped to tenant
  const { data: activeModules, isLoading: isActiveLoading } = useQuery({
    queryKey: ['training-modules', currentOrganization?.id, currentBrand?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return []

      let query = supabase
        .from('courses')
        .select('*')
        .not('is_deleted', 'is', true)
        .order('created_at', { ascending: false })

      query = query.or(`organization_id.eq.${currentOrganization.id},is_master_template.eq.true`)

      const { data, error } = await query
      if (error) throw error
      return data as TrainingModule[]
    },
    enabled: !!currentOrganization?.id && canManageModules
  })

  // Data fetching: fetch soft-deleted modules in trash scoped to tenant
  const { data: trashModules, isLoading: isTrashLoading } = useQuery({
    queryKey: ['training-modules-trash', currentOrganization?.id, currentBrand?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return []

      let query = supabase
        .from('courses')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false })

      query = query.or(`organization_id.eq.${currentOrganization.id},is_master_template.eq.true`)

      const { data, error } = await query
      if (error) throw error
      return data as TrainingModule[]
    },
    enabled: !!currentOrganization?.id && canManageModules
  })

  const rawModules = statusFilter === 'trash' ? trashModules : activeModules
  const isLoading = statusFilter === 'trash' ? isTrashLoading : isActiveLoading

  const { data: assignmentLinks } = useQuery({
    queryKey: ['learning-assignments-module-links', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return []

      let query = supabase
        .from('assignments')
        .select('content_id')
        .eq('content_type', 'module')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .eq('organization_id', currentOrganization.id)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!currentOrganization?.id && canManageModules
  })

  // Master Content Deployments & Version Sync query
  const { data: masterDeployments, refetch: refetchMasterDeployments } = useQuery({
    queryKey: ['master-content-deployments', currentOrganization?.id],
    queryFn: () => platformService.getDeploymentsForTenant(currentOrganization?.id || ''),
    enabled: !!currentOrganization?.id && canManageModules
  })

  const deploymentsByTargetId = useMemo(() => {
    const map = new Map<string, any>()
    masterDeployments?.forEach((dep) => {
      map.set(dep.target_content_id, dep)
    })
    return map
  }, [masterDeployments])

  // Sync with Master Modal State
  const [syncModalState, setSyncModalState] = useState<{
    open: boolean
    module: TrainingModule | null
  }>({ open: false, module: null })

  const assignedModuleIds = useMemo(() => {
    return new Set((assignmentLinks || []).map((a) => a.content_id))
  }, [assignmentLinks])

  // Extract categories dynamically
  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    rawModules?.forEach((m) => {
      if (m.category && m.category.trim()) {
        cats.add(m.category.trim())
      }
    })
    return Array.from(cats).sort()
  }, [rawModules])

  // Compute status counts & KPIs from active courses catalog
  const statusCounts = useMemo(() => {
    if (!activeModules) return { all: 0, published: 0, draft: 0, pending_review: 0, archived: 0, assigned: 0 }
    return {
      all: activeModules.length,
      published: activeModules.filter((m) => m.status === 'published').length,
      draft: activeModules.filter((m) => !m.status || m.status === 'draft').length,
      pending_review: activeModules.filter((m) => m.status === 'pending_review').length,
      archived: activeModules.filter((m) => m.status === 'archived').length,
      assigned: activeModules.filter((m) => assignedModuleIds.has(m.id)).length
    }
  }, [activeModules, assignedModuleIds])

  const totalCatalogMinutes = useMemo(() => {
    if (!activeModules) return 0
    return activeModules.reduce((acc, m) => acc + (m.estimated_duration_minutes || 0), 0)
  }, [activeModules])

  const totalCatalogHoursFormatted = useMemo(() => {
    const hours = Math.floor(totalCatalogMinutes / 60)
    const mins = totalCatalogMinutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }, [totalCatalogMinutes])

  // Multi-criteria filtering & sorting
  const filteredModules = useMemo(() => {
    if (!rawModules) return []
    let list = [...rawModules]

    if (statusFilter === 'published') {
      list = list.filter((m) => m.status === 'published')
    } else if (statusFilter === 'draft') {
      list = list.filter((m) => !m.status || m.status === 'draft')
    } else if (statusFilter === 'pending_review') {
      list = list.filter((m) => m.status === 'pending_review')
    } else if (statusFilter === 'archived') {
      list = list.filter((m) => m.status === 'archived')
    } else if (statusFilter === 'assigned') {
      list = list.filter((m) => assignedModuleIds.has(m.id))
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter((m) =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
      )
    }

    if (categoryFilter !== 'all') {
      list = list.filter((m) => m.category === categoryFilter)
    }

    if (assignmentFilter === 'assigned') {
      list = list.filter((m) => assignedModuleIds.has(m.id))
    } else if (assignmentFilter === 'unassigned') {
      list = list.filter((m) => !assignedModuleIds.has(m.id))
    }

    if (durationFilter === 'under_15') {
      list = list.filter((m) => (m.estimated_duration_minutes || 0) < 15)
    } else if (durationFilter === '15_to_45') {
      list = list.filter((m) => {
        const d = m.estimated_duration_minutes || 0
        return d >= 15 && d <= 45
      })
    } else if (durationFilter === '45_to_90') {
      list = list.filter((m) => {
        const d = m.estimated_duration_minutes || 0
        return d > 45 && d <= 90
      })
    } else if (durationFilter === 'over_90') {
      list = list.filter((m) => (m.estimated_duration_minutes || 0) > 90)
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'created_at_desc':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'created_at_asc':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        case 'updated_at_desc':
          return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
        case 'title_asc':
          return (a.title || '').localeCompare(b.title || '')
        case 'title_desc':
          return (b.title || '').localeCompare(a.title || '')
        case 'duration_asc':
          return (a.estimated_duration_minutes || 0) - (b.estimated_duration_minutes || 0)
        case 'duration_desc':
          return (b.estimated_duration_minutes || 0) - (a.estimated_duration_minutes || 0)
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })

    return list
  }, [rawModules, statusFilter, debouncedSearch, categoryFilter, assignmentFilter, durationFilter, sortBy, assignedModuleIds])

  // Pagination calculations
  const totalItems = filteredModules.length
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedModules = useMemo(() => {
    if (pageSize === -1) return filteredModules
    const start = (safeCurrentPage - 1) * pageSize
    return filteredModules.slice(start, start + pageSize)
  }, [filteredModules, safeCurrentPage, pageSize])

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all' || categoryFilter !== 'all' || assignmentFilter !== 'all' || durationFilter !== 'all'

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setAssignmentFilter('all')
    setDurationFilter('all')
    setCurrentPage(1)
  }

  const handleToggleSelect = (id: string) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllOnPage = () => {
    const allPageIds = paginatedModules.map((m) => m.id)
    const isAllSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedModuleIds.has(id))
    setSelectedModuleIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        allPageIds.forEach((id) => next.delete(id))
      } else {
        allPageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleDeselectAll = () => {
    setSelectedModuleIds(new Set())
  }

  const handleOpenPreview = (id: string) => {
    setPreviewModuleId(id)
    setPreviewOpen(true)
  }

  // Column sort toggler
  const handleSortColumn = (columnKey: 'title' | 'category' | 'status' | 'duration' | 'updated') => {
    if (columnKey === 'title') {
      setSortBy((prev) => (prev === 'title_asc' ? 'title_desc' : 'title_asc'))
    } else if (columnKey === 'duration') {
      setSortBy((prev) => (prev === 'duration_asc' ? 'duration_desc' : 'duration_asc'))
    } else if (columnKey === 'updated') {
      setSortBy((prev) => (prev === 'updated_at_desc' ? 'created_at_desc' : 'updated_at_desc'))
    }
  }

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ModuleStatus }) => {
      const { error } = await supabase
        .from('courses')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      toast({
        title: t('statusUpdated', { defaultValue: 'Status Updated' }),
        description: t('moduleSavedDescription')
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('statusUpdateError'), variant: 'destructive' })
    }
  })

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('courses')
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      queryClient.invalidateQueries({ queryKey: ['training-modules-trash'] })
      toast({
        title: t('trash.moved_to_trash_title', 'Moved to Trash'),
        description: t('trash.moved_to_trash_desc', 'Course moved to Trash. You can restore it anytime from the Trash tab.')
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('moduleDeleteError'), variant: 'destructive' })
    }
  })

  const restoreModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('courses')
        .update({ is_deleted: false, deleted_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      queryClient.invalidateQueries({ queryKey: ['training-modules-trash'] })
      toast({
        title: t('trash.restored_title', 'Course Restored'),
        description: t('trash.restored_desc', 'The course has been restored from Trash to active status.')
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('trash.restore_error', 'Failed to restore course.'), variant: 'destructive' })
    }
  })

  const purgeModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('purge_course', { p_course_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules-trash'] })
      setPurgeConfirmOpen(false)
      setModuleToPurge(null)
      toast({
        title: t('trash.purged_title', 'Course Permanently Purged'),
        description: t('trash.purged_desc', 'Course and draft assets were permanently removed from the database.')
      })
    },
    onError: (err: any) => {
      toast({
        title: t('trash.purge_failed_title', 'Purge Denied'),
        description: err.message || t('error'),
        variant: 'destructive'
      })
    }
  })

  const bulkPublishMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('courses')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      setSelectedModuleIds(new Set())
      toast({
        title: t('modulePublished'),
        description: t('bulkPublishSuccess', { count: ids.length })
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('bulkPublishError'), variant: 'destructive' })
    }
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('courses')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      setSelectedModuleIds(new Set())
      toast({
        title: t('archived'),
        description: t('bulkArchiveSuccess', { count: ids.length })
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('bulkArchiveError'), variant: 'destructive' })
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('courses')
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      queryClient.invalidateQueries({ queryKey: ['training-modules-trash'] })
      setSelectedModuleIds(new Set())
      setBulkDeleteConfirmOpen(false)
      toast({
        title: t('trash.moved_to_trash_title', 'Moved to Trash'),
        description: t('bulkDeleteSuccess', { count: ids.length })
      })
    },
    onError: () => {
      toast({ title: t('error'), description: t('bulkDeleteError'), variant: 'destructive' })
    }
  })

  const submitForReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('submit_training_module_for_review', { p_module_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      toast({ title: t('review.submitted'), description: t('review.submittedDesc') })
    },
    onError: () => {
      toast({ title: t('error'), description: t('review.submitError'), variant: 'destructive' })
    }
  })

  const approveModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_training_module', { p_module_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      toast({ title: t('review.approved'), description: t('review.approvedDesc') })
    },
    onError: () => {
      toast({ title: t('error'), description: t('review.approveError'), variant: 'destructive' })
    }
  })

  const rejectModuleMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reject_training_module', {
        p_module_id: id,
        p_reason: reason
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      setModuleToReject(null)
      setRejectReason('')
      toast({ title: t('review.rejected'), description: t('review.rejectedDesc') })
    },
    onError: () => {
      toast({ title: t('error'), description: t('review.rejectError'), variant: 'destructive' })
    }
  })

  const handleStartFromScratch = () => {
    setViewMode('builder', { moduleId: 'new' })
  }

  const handleCreateFromTemplate = () => {
    setShowTemplateDialog(true)
  }

  // Studio > Create links here with ?create=ai|template to open that flow once.
  const createParam = searchParams.get('create')
  useEffect(() => {
    if (createParam !== 'ai' && createParam !== 'template') return
    if (createParam === 'ai') setShowSmartAIModal(true)
    else setShowTemplateDialog(true)
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    navigate({ search: next.toString() }, { replace: true })
  }, [createParam, searchParams, navigate])

  const handleCreateWithAI = () => {
    setShowSmartAIModal(true)
  }

  const handleEdit = (module: TrainingModule) => {
    setViewMode('builder', { moduleId: module.id })
  }

  const handleView = (module: TrainingModule) => {
    navigate(`/learn/player/${module.id}`)
  }

  const handleDelete = (module: TrainingModule) => {
    setModuleToDelete(module)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (moduleToDelete) {
      await deleteModuleMutation.mutateAsync(moduleToDelete.id)
      setModuleToDelete(null)
    }
  }

  const handlePurge = (module: TrainingModule) => {
    setModuleToPurge(module)
    setPurgeConfirmOpen(true)
  }

  const confirmPurge = async () => {
    if (moduleToPurge) {
      await purgeModuleMutation.mutateAsync(moduleToPurge.id)
    }
  }

  const handleAssign = (id: string) => {
    setViewMode('assignments', { assignModuleId: id, openAssign: true })
  }

  const handleClone = async (module: TrainingModule) => {
    try {
      const { error } = await supabase.rpc('duplicate_training_module', { p_module_id: module.id })
      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
      toast({
        title: t('moduleCloned'),
        description: t('moduleClonedDesc')
      })
    } catch (error) {
      console.error('Error cloning module:', error)
      toast({
        title: t('error'),
        description: t('cloneError'),
        variant: 'destructive'
      })
    }
  }

  const handleSubmitForReview = (module: TrainingModule) => {
    submitForReviewMutation.mutate(module.id)
  }

  const handleApprove = (module: TrainingModule) => {
    approveModuleMutation.mutate(module.id)
  }

  const handleRequestReject = (module: TrainingModule) => {
    setModuleToReject(module)
    setRejectReason('')
  }

  const confirmReject = () => {
    if (moduleToReject) {
      rejectModuleMutation.mutate({ id: moduleToReject.id, reason: rejectReason })
    }
  }

  const workflowSteps: Array<{
    key: ViewMode
    label: string
    description: string
    icon: typeof FileText
    visible: boolean
  }> = [
    {
      key: 'list' as ViewMode,
      label: t('workflow.design'),
      description: t('workflow.designDesc'),
      icon: FileText,
      visible: canManageModules
    },
    {
      key: 'builder' as ViewMode,
      label: t('workflow.build'),
      description: t('workflow.buildDesc'),
      icon: Wand2,
      visible: canManageModules
    },
  ].filter((step) => step.visible)

  const headerActions = (() => {
    if (viewMode === 'list') {
      if (!canManageModules) return null
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            data-tour="training-create-course-btn"
            onClick={() => setShowSmartAIModal(true)}
            className="h-9 px-4 text-xs font-semibold bg-ds-accent text-ds-ink-contrast hover:bg-ds-accent/90 shadow-none rounded-md"
          >
            <Sparkles className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('createWithAI', 'Create with AI')}
          </Button>
          <Button
            variant="outline"
            onClick={handleCreateFromTemplate}
            className="h-9 px-3.5 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
          >
            <Layers className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('createFromTemplate', 'From Template')}
          </Button>
          <Button
            variant="outline"
            onClick={handleStartFromScratch}
            className="h-9 px-3.5 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
          >
            <Plus className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('startFromScratch', 'Start Blank')}
          </Button>
        </div>
      )
    }
    if (viewMode === 'assignments') {
      if (!canAssignTraining) return null
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/manage/assignments/rules')}
            className="h-9 px-3.5 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
          >
            <Settings className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('autoAssignRules')}
          </Button>
          <Button
            onClick={() => setViewMode('assignments', { openAssign: true, assignModuleId })}
            className="h-9 px-4 text-xs font-semibold bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 rounded-md shadow-none"
          >
            <Plus className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('createAssignment')}
          </Button>
        </div>
      )
    }
    if (viewMode === 'builder') {
      if (!canManageModules) return null
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setViewMode('list')}
            className="h-9 px-3.5 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
          >
            <BookOpen className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('library')}
          </Button>
          {moduleId && moduleId !== 'new' && (
            <Button
              onClick={() => handleAssign(moduleId)}
              className="h-9 px-4 text-xs font-semibold bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 rounded-md shadow-none"
            >
              <Users className={cn("h-3.5 w-3.5", "me-1.5")} />
              {t('assign')}
            </Button>
          )}
        </div>
      )
    }
    if (viewMode === 'insights') {
      if (!canAssignTraining && !canManageModules) return null
      return (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setViewMode('assignments')}
            className="h-9 px-3.5 text-xs font-medium border-ds-border bg-ds-surface text-ds-ink hover:bg-ds-surface-subtle rounded-md"
          >
            <Users className={cn("h-3.5 w-3.5", "me-1.5")} />
            {t('manageAssignments')}
          </Button>
        </div>
      )
    }
    return null
  })()

  const renderAccessNotice = (actionLabel?: string, onAction?: () => void) => (
    <div className="rounded-[8px] border border-dashed border-ds-border bg-ds-surface-subtle p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-ds-danger-soft text-ds-danger mb-4 mx-auto border border-ds-danger/20">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-ds-ink mb-1">{t('accessRestrictedTitle')}</h3>
      <p className="text-xs text-ds-muted mb-6 max-w-md mx-auto">{t('accessRestrictedDesc')}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="border-ds-border text-xs h-9">
          {actionLabel}
        </Button>
      )}
    </div>
  )

  if (viewMode === 'builder' && moduleId && canManageModules) {
    return <TrainingBuilder />
  }

  const statusPills: Array<{
    id: StatusFilterType
    label: string
    count: number
    dotColor: string
  }> = [
    { id: 'all', label: t('allModules'), count: statusCounts.all, dotColor: 'bg-ds-ink' },
    { id: 'published', label: t('published', 'Published'), count: statusCounts.published, dotColor: 'bg-ds-success' },
    { id: 'draft', label: t('draft', 'Draft'), count: statusCounts.draft, dotColor: 'bg-ds-muted' },
    { id: 'pending_review', label: t('pending_review', 'Pending Review'), count: statusCounts.pending_review, dotColor: 'bg-ds-warning' },
    { id: 'assigned', label: t('assigned', 'Assigned'), count: statusCounts.assigned, dotColor: 'bg-ds-accent' },
    { id: 'archived', label: t('archived', 'Archived'), count: statusCounts.archived, dotColor: 'bg-ds-danger' },
    { id: 'trash', label: t('trash.filter_label', 'Trash'), count: trashModules?.length ?? 0, dotColor: 'bg-ds-danger' }
  ]

  const isAllOnPageSelected = paginatedModules.length > 0 && paginatedModules.every((m) => selectedModuleIds.has(m.id))
  const isSomeOnPageSelected = paginatedModules.some((m) => selectedModuleIds.has(m.id)) && !isAllOnPageSelected

  // Saudi Hospitality 1-Click AI Starter suggestions
  const hospitalityAiStarters = [
    {
      title: t('starterHafawa', 'VIP Arrival & Saudi Hafawa Etiquette'),
      category: 'Front Office & Hafawa',
      icon: Crown
    },
    {
      title: t('starterHaccp', 'HACCP Food Safety & Kitchen Hygiene'),
      category: 'Food & Beverage',
      icon: Utensils
    },
    {
      title: t('starterCheckIn', 'Luxury Front Desk Check-in Standards'),
      category: 'Front Office',
      icon: HeartHandshake
    },
    {
      title: t('starterHousekeeping', 'Housekeeping Turndown & Inspection SOP'),
      category: 'Housekeeping',
      icon: Sparkles
    }
  ]

  const tenantContextLabel = [currentOrganization?.name, currentBrand?.name].filter(Boolean).join(' › ')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 text-start">
      <WorkspaceHeader
        eyebrow={t('myContent.eyebrow', 'Studio')}
        title={t('studio.title', 'Courses')}
        context={tenantContextLabel || t('studio.description', 'Create, edit, review and publish your organization’s courses.')}
        actions={headerActions}
      />

      <div className="flex items-center gap-1.5 p-1 rounded-[8px] bg-ds-surface-subtle border border-ds-border w-fit" data-tour="training-workflow-steps">
        {workflowSteps.map((step) => {
          const Icon = step.icon
          const isActive = viewMode === step.key
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => setViewMode(step.key, step.key === 'builder' ? { moduleId: moduleId || 'new' } : undefined)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all",
                isActive
                  ? "bg-ds-surface text-ds-ink shadow-2xs border border-ds-border"
                  : "text-ds-muted hover:text-ds-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{step.label}</span>
            </button>
          )
        })}
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
        <TabsContent value="list" className="space-y-4">
          {!canManageModules ? (
            renderAccessNotice(t('goToAssignments'), () => setViewMode('assignments'))
          ) : (
            <>
              {/* Executive KPI Summary Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div
                  onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
                  className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong cursor-pointer flex items-center justify-between shadow-none"
                >
                  <div>
                    <p className="text-xs font-semibold text-ds-muted uppercase tracking-wider">{t('allModules', 'Total Modules')}</p>
                    <h4 className="font-mono text-2xl font-bold text-ds-ink mt-1">{statusCounts.all}</h4>
                    <p className="text-[11px] text-ds-muted mt-0.5">
                      {statusCounts.draft} {t('draft', 'drafts')} · {statusCounts.published} {t('published', 'published')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-[6px] border border-ds-border bg-ds-surface-subtle flex items-center justify-center text-ds-muted shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>

                <div
                  onClick={() => { setStatusFilter('published'); setCurrentPage(1) }}
                  className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong cursor-pointer flex items-center justify-between shadow-none"
                >
                  <div>
                    <p className="text-xs font-semibold text-ds-success uppercase tracking-wider">{t('readyRate', 'Published')}</p>
                    <h4 className="font-mono text-2xl font-bold text-ds-success mt-1">{statusCounts.published}</h4>
                    <p className="text-[11px] text-ds-success font-medium mt-0.5">
                      {statusCounts.all > 0 ? Math.round((statusCounts.published / statusCounts.all) * 100) : 0}% {t('readyRate', 'readiness')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-[6px] border border-ds-success/30 bg-ds-success-soft text-ds-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>

                <div
                  onClick={() => { setStatusFilter('assigned'); setCurrentPage(1) }}
                  className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong cursor-pointer flex items-center justify-between shadow-none"
                >
                  <div>
                    <p className="text-xs font-semibold text-ds-accent uppercase tracking-wider">{t('coverageRate', 'Assigned')}</p>
                    <h4 className="font-mono text-2xl font-bold text-ds-accent mt-1">{statusCounts.assigned}</h4>
                    <p className="text-[11px] text-ds-accent font-medium mt-0.5">
                      {statusCounts.all > 0 ? Math.round((statusCounts.assigned / statusCounts.all) * 100) : 0}% {t('coverageRate', 'coverage')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-[6px] border border-ds-accent/30 bg-ds-accent-soft text-ds-accent flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="rounded-[8px] border border-ds-border bg-ds-surface p-4 transition-colors hover:border-ds-border-strong flex items-center justify-between shadow-none">
                  <div>
                    <p className="text-xs font-semibold text-ds-muted uppercase tracking-wider">{t('totalTrainingHours', 'Content Duration')}</p>
                    <h4 className="font-mono text-2xl font-bold text-ds-ink mt-1">{totalCatalogHoursFormatted}</h4>
                    <p className="text-[11px] text-ds-muted mt-0.5">{t('allModules', 'across catalog')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-[6px] border border-ds-border bg-ds-surface-subtle flex items-center justify-center text-ds-muted shrink-0">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Status Filter Pills Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {statusPills.map((pill) => {
                  const isSelected = statusFilter === pill.id
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(pill.id)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                        isSelected
                          ? "bg-ds-ink text-ds-on-ink border-ds-ink shadow-2xs"
                          : "bg-ds-surface border-ds-border text-ds-ink hover:border-ds-border-strong hover:bg-ds-surface-subtle"
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", isSelected ? "bg-ds-on-ink" : pill.dotColor)} />
                      <span>{pill.label}</span>
                      <span className={cn(
                        "px-1.5 py-0.2 rounded-full text-[11px] font-bold font-mono",
                        isSelected ? "bg-white/20 text-ds-on-ink" : "bg-ds-surface-subtle text-ds-muted border border-ds-border"
                      )}>
                        {pill.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Multi-Filters & Search Toolbar */}
              <div data-tour="training-search-toolbar" className="p-3.5 bg-ds-surface rounded-[8px] border border-ds-border shadow-none space-y-3">
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className={cn("absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ds-muted", "start-3")} />
                    <Input
                      data-tour="training-search-input"
                      type="text"
                      placeholder={t('searchEmployeeOrModule', { defaultValue: 'Search modules by title, category, description...' })}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        "ps-9 pe-8",
                        "h-9 text-xs border-ds-border bg-ds-surface-subtle text-ds-ink placeholder:text-ds-muted focus:border-ds-border-strong transition-all"
                      )}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('')
                          setCurrentPage(1)
                        }}
                        className={cn("absolute top-1/2 -translate-y-1/2 text-ds-muted hover:text-ds-ink p-1", "end-2")}
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
                    {/* Category Filter */}
                    <Select
                      value={categoryFilter}
                      onValueChange={(val) => {
                        setCategoryFilter(val)
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-9 w-[130px] sm:w-[150px] text-xs border-ds-border bg-ds-surface-subtle text-ds-ink">
                        <Tag className="h-3.5 w-3.5 me-1.5 text-ds-muted" />
                        <SelectValue placeholder={t('allCategories', 'Category')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allCategories', 'All Categories')}</SelectItem>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Assignment Filter */}
                    <Select
                      value={assignmentFilter}
                      onValueChange={(val) => {
                        setAssignmentFilter(val)
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-9 w-[130px] sm:w-[150px] text-xs border-ds-border bg-ds-surface-subtle text-ds-ink">
                        <Users className="h-3.5 w-3.5 me-1.5 text-ds-muted" />
                        <SelectValue placeholder={t('assignedFilter', 'Assignment')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allAssignments', 'All Modules')}</SelectItem>
                        <SelectItem value="assigned">{t('assignedOnly', 'Assigned Only')}</SelectItem>
                        <SelectItem value="unassigned">{t('unassignedOnly', 'Unassigned Only')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Duration Filter */}
                    <Select
                      value={durationFilter}
                      onValueChange={(val) => {
                        setDurationFilter(val)
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-9 w-[120px] sm:w-[140px] text-xs border-ds-border bg-ds-surface-subtle text-ds-ink">
                        <Clock className="h-3.5 w-3.5 me-1.5 text-ds-muted" />
                        <SelectValue placeholder={t('durationFilter', 'Duration')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allDurations', 'All Durations')}</SelectItem>
                        <SelectItem value="under_15">{t('durationUnder15', '< 15 min')}</SelectItem>
                        <SelectItem value="15_to_45">{t('duration15to45', '15–45 min')}</SelectItem>
                        <SelectItem value="45_to_90">{t('duration45to90', '45–90 min')}</SelectItem>
                        <SelectItem value="over_90">{t('durationOver90', '> 90 min')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Sort Dropdown */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs border-ds-border bg-ds-surface-subtle text-ds-ink">
                        <ArrowUpDown className="h-3.5 w-3.5 me-1.5 text-ds-muted" />
                        <SelectValue placeholder={t('sortBy')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at_desc">{t('sortByNewest', 'Newest Created')}</SelectItem>
                        <SelectItem value="created_at_asc">{t('sortByOldest', 'Oldest Created')}</SelectItem>
                        <SelectItem value="updated_at_desc">{t('sortByUpdated', 'Recently Modified')}</SelectItem>
                        <SelectItem value="title_asc">{t('sortByTitleAZ', 'Title (A-Z)')}</SelectItem>
                        <SelectItem value="title_desc">{t('sortByTitleZA', 'Title (Z-A)')}</SelectItem>
                        <SelectItem value="duration_asc">{t('sortByDurationAsc', 'Shortest Duration')}</SelectItem>
                        <SelectItem value="duration_desc">{t('sortByDurationDesc', 'Longest Duration')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        className="h-9 px-2.5 text-xs text-ds-muted hover:text-ds-danger hover:bg-ds-danger-soft gap-1"
                        title={t('clearFilters', 'Clear Filters')}
                      >
                        <FilterX className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t('clearFilters', 'Clear')}</span>
                      </Button>
                    )}

                    {/* View Switcher: Grid vs Table */}
                    <div className="flex items-center bg-ds-surface-subtle rounded-md p-0.5 border border-ds-border">
                      <Button
                        variant={layoutMode === 'grid' ? 'default' : 'ghost'}
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded",
                          layoutMode === 'grid' ? "bg-ds-surface text-ds-ink shadow-2xs font-semibold" : "text-ds-muted hover:text-ds-ink"
                        )}
                        onClick={() => setLayoutMode('grid')}
                        aria-label={t('viewAsGrid', 'Grid view')}
                        title={t('viewAsGrid', 'Grid view')}
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant={layoutMode === 'table' ? 'default' : 'ghost'}
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded",
                          layoutMode === 'table' ? "bg-ds-surface text-ds-ink shadow-2xs font-semibold" : "text-ds-muted hover:text-ds-ink"
                        )}
                        onClick={() => setLayoutMode('table')}
                        aria-label={t('viewAsTable', 'Table view')}
                        title={t('viewAsTable', 'Table view')}
                      >
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ds-border text-xs text-ds-muted">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-ds-ink">
                      <Checkbox
                        checked={isAllOnPageSelected ? true : isSomeOnPageSelected ? 'indeterminate' : false}
                        onCheckedChange={handleSelectAllOnPage}
                        aria-label={t('selectAll', 'Select all on page')}
                      />
                      <span>{t('selectAll', 'Select All on Page')}</span>
                    </label>
                    <span className="text-ds-border">|</span>
                    <span>
                      {t('showingModules', {
                        from: totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1,
                        to: Math.min(safeCurrentPage * pageSize, totalItems),
                        total: totalItems,
                        defaultValue: `Showing ${totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}–${Math.min(safeCurrentPage * pageSize, totalItems)} of ${totalItems} modules`
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>{t('itemsPerPage', 'Per page:')}</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(val) => {
                        setPageSize(Number(val))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="h-7 w-[70px] text-xs border-ds-border bg-ds-surface text-ds-ink">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="48">48</SelectItem>
                        <SelectItem value="-1">{t('all', 'All')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Bulk Action Sticky Toolbar */}
              {selectedModuleIds.size > 0 && (
                <div className="sticky top-4 z-30 p-3 bg-ds-ink text-ds-on-ink rounded-[8px] border border-ds-border shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-ds-accent text-ds-ink-contrast font-bold px-2.5 py-0.5">
                      {t('selectedCount_other', { count: selectedModuleIds.size, defaultValue: `${selectedModuleIds.size} modules selected` })}
                    </Badge>
                    <span className="text-xs text-ds-on-ink/80 hidden md:inline">
                      {t('chooseBulkAction', { defaultValue: 'Perform batch actions on selected modules' })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs font-semibold bg-ds-on-ink/10 hover:bg-ds-on-ink/20 text-ds-on-ink border-0"
                      onClick={() => setAssignWizardOpen(true)}
                    >
                      <Users className="h-3.5 w-3.5 me-1.5" />
                      {t('bulkAssign', 'Assign to Team')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs font-semibold bg-ds-success hover:bg-ds-success/90 text-ds-on-ink dark:text-ds-on-ink border-0"
                      onClick={() => bulkPublishMutation.mutate(Array.from(selectedModuleIds))}
                      disabled={bulkPublishMutation.isPending}
                    >
                      {bulkPublishMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                      )}
                      {t('bulkPublish', 'Publish')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs font-semibold bg-ds-on-ink/20 hover:bg-ds-on-ink/30 text-ds-on-ink border-0"
                      onClick={() => bulkArchiveMutation.mutate(Array.from(selectedModuleIds))}
                      disabled={bulkArchiveMutation.isPending}
                    >
                      {bulkArchiveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5 me-1.5" />
                      )}
                      {t('bulkArchive', 'Archive')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs font-semibold bg-ds-danger hover:bg-ds-danger/90 text-ds-on-ink border-0"
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 me-1.5" />
                      {t('bulkDelete', 'Delete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-ds-on-ink/70 hover:text-ds-on-ink hover:bg-ds-on-ink/10"
                      onClick={handleDeselectAll}
                    >
                      <X className="h-3.5 w-3.5 me-1" />
                      {t('deselectAll', 'Deselect')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Main Results View */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-ds-surface rounded-[8px] border border-ds-border">
                  <Loader2 className="h-8 w-8 animate-spin text-ds-accent mb-3" />
                  <p className="text-xs font-medium text-ds-muted">{t('loading', 'Loading training modules...')}</p>
                </div>
              ) : paginatedModules.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-ds-border bg-ds-surface-subtle p-12 text-center">
                  <div className="h-12 w-12 rounded-[8px] bg-ds-surface border border-ds-border flex items-center justify-center text-ds-muted mb-3 mx-auto shadow-2xs">
                    {statusFilter === 'trash' ? (
                      <Trash2 className="h-6 w-6 text-ds-muted" />
                    ) : hasActiveFilters ? (
                      <FilterX className="h-6 w-6" />
                    ) : (
                      <Sparkles className="h-6 w-6 text-ds-accent" />
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-ds-ink mb-1">
                    {statusFilter === 'trash'
                      ? t('trash.empty_title', 'Trash is Empty')
                      : hasActiveFilters
                      ? t('noMatchingModules', 'No matching modules found')
                      : t('noModules', 'Build your training catalog')}
                  </h3>
                  <p className="text-xs text-ds-muted mb-6 max-w-md mx-auto">
                    {statusFilter === 'trash'
                      ? t('trash.empty_desc', 'No deleted courses in trash. Trashed courses will appear here where they can be restored or purged.')
                      : hasActiveFilters
                      ? t('noMatchingModulesDesc', 'No training modules match your current filters or search terms.')
                      : t('noModulesDesc', 'Create rich interactive modules or start with AI-generated Saudi hospitality courses.')}
                  </p>

                  {statusFilter === 'trash' ? (
                    <Button variant="outline" onClick={() => setStatusFilter('all')} className="border-ds-border text-xs h-9 gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {t('allModules', 'Back to Catalog')}
                    </Button>
                  ) : hasActiveFilters ? (
                    <Button variant="outline" onClick={handleClearFilters} className="border-ds-border text-xs h-9 gap-1.5">
                      <FilterX className="h-3.5 w-3.5" />
                      {t('clearFilters', 'Clear Filters')}
                    </Button>
                  ) : (
                    <div className="w-full max-w-xl mx-auto space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">
                        {t('popularAiStarters', 'Start from a suggested course:')}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {hospitalityAiStarters.map((starter) => {
                          const StarterIcon = starter.icon
                          return (
                            <button
                              key={starter.title}
                              type="button"
                              onClick={() => setShowSmartAIModal(true)}
                              className="flex items-center gap-2.5 p-3 rounded-[6px] border border-ds-border bg-ds-surface hover:border-ds-border-strong hover:bg-ds-surface-subtle text-start transition-all group"
                            >
                              <div className="h-7 w-7 rounded-[4px] bg-ds-surface-subtle border border-ds-border text-ds-accent flex items-center justify-center shrink-0 group-hover:bg-ds-accent group-hover:text-ds-ink-contrast transition-colors">
                                <StarterIcon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-semibold text-ds-ink group-hover:text-ds-accent transition-colors line-clamp-1">
                                {starter.title}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : layoutMode === 'grid' ? (
                /* GRID VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {paginatedModules.map((module) => {
                    const isSelected = selectedModuleIds.has(module.id)
                    const isAssigned = assignedModuleIds.has(module.id)
                    const isMaster = Boolean(module.is_master_template || module.master_source_id)
                    const deployment = deploymentsByTargetId.get(module.id)
                    const hasUpdate = Boolean(
                      deployment?.has_update_available ||
                      (deployment && deployment.current_master_version > deployment.deployed_version)
                    )
                    return (
                      <Card
                        key={module.id}
                        className={cn(
                          "group relative rounded-[8px] border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-none",
                          isSelected && "ring-1 ring-ds-accent border-ds-accent bg-ds-accent-soft/10"
                        )}
                      >
                        {/* Status bar header accent */}
                        <div
                          className={cn(
                            "h-1 w-full",
                            module.status === 'published'
                              ? 'bg-ds-success'
                              : module.status === 'archived'
                              ? 'bg-ds-danger'
                              : module.status === 'pending_review'
                              ? 'bg-ds-warning'
                              : 'bg-ds-border'
                          )}
                        />

                        {/* Top action row: Checkbox, Category Theme & Badges */}
                        <div className="p-4 pb-0 flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(module.id)}
                              aria-label={`Select ${module.title}`}
                              className="data-[state=checked]:bg-ds-ink shrink-0"
                            />
                            <TrainingCategoryBadge category={module.category} size="sm" />
                            {isMaster && (
                              <Badge className="border-ds-border bg-ds-surface-subtle text-ds-ink text-[11px] px-2 py-0.5 font-semibold whitespace-nowrap shrink-0 flex items-center gap-1">
                                <Crown className="h-2.5 w-2.5 text-ds-accent shrink-0" />
                                <span>Platform Master</span>
                              </Badge>
                            )}
                            {hasUpdate && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSyncModalState({ open: true, module })
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ds-warning text-ds-ink-contrast text-[11px] font-bold shadow-2xs transition-transform hover:scale-105 animate-pulse cursor-pointer"
                                title="Click to view upstream master changes and synchronize"
                              >
                                <span>🔔</span>
                                <span>Update Available</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Inline status switcher or trash badge */}
                            {statusFilter === 'trash' ? (
                              <span className="text-[11px] font-bold rounded-sm px-2 py-0.5 inline-flex items-center gap-1 bg-ds-danger/10 text-ds-danger border border-ds-danger/30">
                                <span>{t('trash.filter_label', 'Trash')}</span>
                              </span>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "text-[11px] font-bold rounded-sm px-2 py-0.5 inline-flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-80 border",
                                      module.status === 'published'
                                        ? 'bg-ds-success-soft text-ds-success border-ds-success/30'
                                        : module.status === 'archived'
                                        ? 'bg-ds-danger-soft text-ds-danger border-ds-danger/30'
                                        : module.status === 'pending_review'
                                        ? 'bg-ds-warning-soft text-ds-warning border-ds-warning/30'
                                        : 'bg-ds-surface-subtle text-ds-muted border-ds-border'
                                    )}
                                  >
                                    <span>{t(module.status || 'draft')}</span>
                                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  <DropdownMenuLabel>{t('filterByStatus', 'Set Status')}</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'published' })}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-ds-success me-2" />
                                    {t('published', 'Published')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'draft' })}>
                                    <Clock className="h-3.5 w-3.5 text-ds-muted me-2" />
                                    {t('draft', 'Draft')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'archived' })}>
                                    <Archive className="h-3.5 w-3.5 text-ds-danger me-2" />
                                    {t('archived', 'Archived')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {isAssigned && (
                              <Badge variant="outline" className="text-[11px] font-medium bg-ds-surface-subtle text-ds-muted border-ds-border px-1.5 py-0.5">
                                {t('assigned')}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Card Body with quick preview trigger */}
                        <CardHeader className="p-4 pt-3 pb-2 flex-1">
                          <CardTitle
                            onClick={() => handleOpenPreview(module.id)}
                            className="text-base font-semibold text-ds-ink line-clamp-1 group-hover:text-ds-accent cursor-pointer transition-colors"
                            title={module.title}
                          >
                            {module.title || t('untitledModule', 'Untitled Module')}
                          </CardTitle>
                          <p className={cn("text-xs text-ds-muted line-clamp-2 mt-1 min-h-[32px]", "text-start")}>
                            {module.description || t('noDescription', 'No description provided')}
                          </p>
                        </CardHeader>

                        {/* Card Footer: Metadata & Quick Actions */}
                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="flex items-center justify-between text-xs text-ds-muted pt-2 border-t border-ds-border">
                            <div className="flex items-center gap-1" title={t('estimatedDuration')}>
                              <Clock className="h-3.5 w-3.5 text-ds-muted" />
                              <span>{module.estimated_duration_minutes ? `${module.estimated_duration_minutes} ${t('min')}` : `0 ${t('min')}`}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenPreview(module.id)}
                              className="text-[11px] font-medium text-ds-muted hover:text-ds-ink flex items-center gap-1 transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{t('quickPreview', 'Preview')}</span>
                            </button>
                          </div>

                          <ModuleQuickActions
                            module={module}
                            onEdit={() => handleEdit(module)}
                            onView={() => handleView(module)}
                            onAssign={() => handleAssign(module.id)}
                            onClone={() => handleClone(module)}
                            onDelete={() => handleDelete(module)}
                            onSyncWithMaster={isMaster ? () => setSyncModalState({ open: true, module }) : undefined}
                            isMaster={isMaster}
                            hasUpdate={hasUpdate}
                            onSubmitForReview={module.status === 'draft' ? () => handleSubmitForReview(module) : undefined}
                            onApprove={module.status === 'pending_review' && canReviewModules ? () => handleApprove(module) : undefined}
                            onReject={module.status === 'pending_review' && canReviewModules ? () => handleRequestReject(module) : undefined}
                            isTrash={statusFilter === 'trash'}
                            onRestore={() => restoreModuleMutation.mutate(module.id)}
                            onPurge={() => handlePurge(module)}
                          />
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                /* COMPACT TABLE VIEW */
                <div className="rounded-[8px] border border-ds-border bg-ds-surface shadow-none overflow-hidden">
                  <Table>
                    <TableHeader className="bg-ds-surface-subtle">
                      <TableRow className="border-b border-ds-border text-xs text-ds-muted">
                        <TableHead className="w-10 px-3">
                          <Checkbox
                            checked={isAllOnPageSelected ? true : isSomeOnPageSelected ? 'indeterminate' : false}
                            onCheckedChange={handleSelectAllOnPage}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead
                          onClick={() => handleSortColumn('title')}
                          className="min-w-[240px] cursor-pointer hover:text-ds-ink transition-colors select-none text-ds-muted"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{t('title', 'Module')}</span>
                            {sortBy === 'title_asc' ? <ArrowUp className="h-3 w-3 text-ds-accent" /> : sortBy === 'title_desc' ? <ArrowDown className="h-3 w-3 text-ds-accent" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </div>
                        </TableHead>
                        <TableHead className="hidden md:table-cell min-w-[130px] whitespace-nowrap text-ds-muted">{t('category', 'Category')}</TableHead>
                        <TableHead className="min-w-[110px] whitespace-nowrap text-ds-muted">{t('filterByStatus', 'Status')}</TableHead>
                        <TableHead className="hidden sm:table-cell min-w-[100px] whitespace-nowrap text-ds-muted">{t('assignedFilter', 'Assigned')}</TableHead>
                        <TableHead
                          onClick={() => handleSortColumn('duration')}
                          className="hidden lg:table-cell min-w-[110px] whitespace-nowrap cursor-pointer hover:text-ds-ink transition-colors select-none text-ds-muted"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{t('duration', 'Duration')}</span>
                            {sortBy === 'duration_asc' ? <ArrowUp className="h-3 w-3 text-ds-accent" /> : sortBy === 'duration_desc' ? <ArrowDown className="h-3 w-3 text-ds-accent" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </div>
                        </TableHead>
                        <TableHead
                          onClick={() => handleSortColumn('updated')}
                          className="hidden xl:table-cell min-w-[120px] whitespace-nowrap cursor-pointer hover:text-ds-ink transition-colors select-none text-ds-muted"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{t('updated', 'Modified')}</span>
                            {sortBy === 'updated_at_desc' ? <ArrowDown className="h-3 w-3 text-ds-accent" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </div>
                        </TableHead>
                        <TableHead className="text-end px-4 min-w-[150px] whitespace-nowrap text-ds-muted">{t('action', 'Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedModules.map((module) => {
                        const isSelected = selectedModuleIds.has(module.id)
                        const isAssigned = assignedModuleIds.has(module.id)
                        const isMaster = Boolean(module.is_master_template || module.master_source_id)
                        const deployment = deploymentsByTargetId.get(module.id)
                        const hasUpdate = Boolean(
                          deployment?.has_update_available ||
                          (deployment && deployment.current_master_version > deployment.deployed_version)
                        )
                        return (
                          <TableRow
                            key={module.id}
                            className={cn(
                              "border-b border-ds-border/60 hover:bg-ds-surface-subtle/80 transition-colors group text-ds-ink",
                              isSelected && "bg-ds-accent-soft/20"
                            )}
                          >
                            <TableCell className="px-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelect(module.id)}
                                aria-label={`Select ${module.title}`}
                              />
                            </TableCell>

                            <TableCell className="py-3 min-w-[280px]">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    onClick={() => handleOpenPreview(module.id)}
                                    className="font-semibold text-sm text-ds-ink group-hover:text-ds-accent cursor-pointer transition-colors line-clamp-1"
                                  >
                                    {module.title || t('untitledModule', 'Untitled Module')}
                                  </span>
                                  {isMaster && (
                                    <Badge className="border-ds-border bg-ds-surface-subtle text-ds-ink text-[11px] px-2 py-0.5 font-semibold whitespace-nowrap shrink-0 flex items-center gap-0.5">
                                      <Crown className="h-2.5 w-2.5 text-ds-accent shrink-0" />
                                      <span>Platform Master</span>
                                    </Badge>
                                  )}
                                  {hasUpdate && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSyncModalState({ open: true, module })
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-ds-warning text-ds-ink-contrast text-[11px] font-bold shadow-2xs animate-pulse cursor-pointer"
                                      title="Click to view upstream master changes and synchronize"
                                    >
                                      <span>🔔</span>
                                      <span>Update Available</span>
                                    </button>
                                  )}
                                </div>
                                {module.description && (
                                  <span className="text-xs text-ds-muted line-clamp-1 mt-0.5">
                                    {module.description}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="hidden md:table-cell">
                              <TrainingCategoryBadge category={module.category} size="sm" />
                            </TableCell>

                            <TableCell>
                              {statusFilter === 'trash' ? (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap inline-flex items-center gap-1 bg-ds-danger/10 text-ds-danger border border-ds-danger/30">
                                  <span>{t('trash.filter_label', 'Trash')}</span>
                                </span>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className={cn(
                                        "text-[11px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap inline-flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-80 border",
                                        module.status === 'published'
                                          ? 'bg-ds-success-soft text-ds-success border-ds-success/30'
                                          : module.status === 'archived'
                                          ? 'bg-ds-danger-soft text-ds-danger border-ds-danger/30'
                                          : module.status === 'pending_review'
                                          ? 'bg-ds-warning-soft text-ds-warning border-ds-warning/30'
                                          : 'bg-ds-surface-subtle text-ds-muted border-ds-border'
                                      )}
                                    >
                                      <span>{t(module.status || 'draft')}</span>
                                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="text-xs">
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'published' })}>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-ds-success me-2" />
                                      {t('published', 'Published')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'draft' })}>
                                      <Clock className="h-3.5 w-3.5 text-ds-muted me-2" />
                                      {t('draft', 'Draft')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: module.id, status: 'archived' })}>
                                      <Archive className="h-3.5 w-3.5 text-ds-danger me-2" />
                                      {t('archived', 'Archived')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>

                            <TableCell className="hidden sm:table-cell">
                              {isAssigned ? (
                                <Badge variant="outline" className="text-[11px] font-medium bg-ds-surface-subtle text-ds-muted border-ds-border">
                                  <Check className="h-3 w-3 me-1" />
                                  {t('assigned')}
                                </Badge>
                              ) : (
                                <span className="text-xs text-ds-muted">{t('unassigned', 'No')}</span>
                              )}
                            </TableCell>

                            <TableCell className="hidden lg:table-cell text-xs text-ds-muted">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-ds-muted" />
                                <span>{module.estimated_duration_minutes ? `${module.estimated_duration_minutes} ${t('min')}` : `0 ${t('min')}`}</span>
                              </div>
                            </TableCell>

                            <TableCell className="hidden xl:table-cell text-xs text-ds-muted">
                              {module.updated_at ? new Date(module.updated_at).toLocaleDateString() : module.created_at ? new Date(module.created_at).toLocaleDateString() : '—'}
                            </TableCell>

                            <TableCell className="text-end px-4">
                              <div className={cn("inline-flex items-center gap-1.5")}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenPreview(module.id)}
                                  className="h-8 px-2 text-ds-muted hover:text-ds-ink"
                                  title={t('quickPreview', 'Preview')}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {statusFilter !== 'trash' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(module)}
                                    className="h-8 px-2 text-ds-muted hover:text-ds-ink font-medium"
                                    title={t('common:action.edit')}
                                  >
                                    <Wand2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <div className={cn(statusFilter === 'trash' ? "w-[150px]" : "w-[80px]")}>
                                  <ModuleQuickActions
                                    module={module}
                                    onEdit={() => handleEdit(module)}
                                    onView={() => handleView(module)}
                                    onAssign={() => handleAssign(module.id)}
                                    onClone={() => handleClone(module)}
                                    onDelete={() => handleDelete(module)}
                                    onSyncWithMaster={isMaster ? () => setSyncModalState({ open: true, module }) : undefined}
                                    isMaster={isMaster}
                                    hasUpdate={hasUpdate}
                                    onSubmitForReview={module.status === 'draft' ? () => handleSubmitForReview(module) : undefined}
                                    onApprove={module.status === 'pending_review' && canReviewModules ? () => handleApprove(module) : undefined}
                                    onReject={module.status === 'pending_review' && canReviewModules ? () => handleRequestReject(module) : undefined}
                                    isTrash={statusFilter === 'trash'}
                                    onRestore={() => restoreModuleMutation.mutate(module.id)}
                                    onPurge={() => handlePurge(module)}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-ds-muted">
                    {t('page')} <span className="font-semibold text-ds-ink">{safeCurrentPage}</span> {t('of')} <span className="font-semibold text-ds-ink">{totalPages}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="h-8 px-2.5 text-xs gap-1 border-ds-border text-ds-ink hover:bg-ds-surface-subtle"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>{t('previous', 'Previous')}</span>
                    </Button>

                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1]
                          const showEllipsis = prev && p - prev > 1
                          return (
                            <div key={p} className="flex items-center gap-1">
                              {showEllipsis && <span className="px-1 text-ds-muted text-xs">...</span>}
                              <Button
                                variant={p === safeCurrentPage ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentPage(p)}
                                className={cn(
                                  "h-8 w-8 p-0 text-xs font-semibold rounded",
                                  p === safeCurrentPage ? "bg-ds-ink text-ds-on-ink shadow-2xs" : "text-ds-muted hover:text-ds-ink hover:bg-ds-surface-subtle"
                                )}
                              >
                                {p}
                              </Button>
                            </div>
                          )
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="h-8 px-2.5 text-xs gap-1 border-ds-border text-ds-ink hover:bg-ds-surface-subtle"
                    >
                      <span>{t('next', 'Next')}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>


        <TabsContent value="builder" className="space-y-6">
          {!canManageModules ? (
            renderAccessNotice(t('goToAssignments'), () => setViewMode('assignments'))
          ) : moduleId ? (
            <TrainingBuilder />
          ) : (
            <div className="rounded-[8px] border border-dashed border-ds-border bg-ds-surface p-12 text-center shadow-2xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ds-accent-soft text-ds-accent mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-ds-ink mb-1.5">{t('builderReady')}</h3>
              <p className="text-sm text-ds-muted mb-6 max-w-md mx-auto">{t('builderReadyDesc')}</p>
              <div className="flex w-full flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={() => setViewMode('list')} className="w-full sm:w-auto border-ds-border text-ds-ink hover:bg-ds-surface-subtle">
                  <BookOpen className="h-4 w-4 me-2 text-ds-muted" />
                  {t('library')}
                </Button>
                <Button onClick={handleCreateWithAI} className="w-full sm:w-auto bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 font-semibold shadow-2xs">
                  <Sparkles className="h-4 w-4 me-2 text-ds-accent" />
                  {t('createWithAI', 'Create with AI')}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          {!canAssignTraining ? (
            renderAccessNotice(t('goToLibrary'), () => setViewMode('list'))
          ) : (
            <TrainingAssignmentsPanel
              embedded
              initialTab="assignments"
              defaultModuleId={assignModuleId}
              autoOpen={shouldOpenAssign}
              hideHeaderActions
            />
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {!canAssignTraining && !canManageModules ? (
            renderAccessNotice(t('goToLibrary'), () => setViewMode('list'))
          ) : (
            <TrainingTrackCommandCenter
              canManageModules={canManageModules}
              onNavigateToBuilder={(id) => setViewMode('builder', { moduleId: id })}
            />
          )}
        </TabsContent>
      </Tabs>

      <ModuleTemplateSelector
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onTemplateSelected={(template) => {
          navigate(`/studio/courses/new?template=${template.id}`)
          setShowTemplateDialog(false)
        }}
      />

      <SmartAICourseCreatorModal
        open={showSmartAIModal}
        onOpenChange={setShowSmartAIModal}
        onCourseCreated={(newModuleId) => {
          navigate(`/studio/courses/${newModuleId}?view=builder`)
          setShowSmartAIModal(false)
        }}
      />

      <DeleteConfirmation
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title={t('deleteModule')}
        description={t('deleteModuleDesc')}
        itemName={moduleToDelete?.title}
      />

      <DeleteConfirmation
        open={purgeConfirmOpen}
        onOpenChange={setPurgeConfirmOpen}
        onConfirm={confirmPurge}
        title={t('trash.purge_dialog_title', 'Permanently Purge Course?')}
        description={t('trash.purge_dialog_desc', 'This will permanently remove the course and its draft lessons. This action CANNOT be undone and will only succeed if no learners have recorded completions or certificates.')}
        itemName={moduleToPurge?.title}
      />

      <Dialog open={!!moduleToReject} onOpenChange={(open) => !open && setModuleToReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('review.rejectDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('review.rejectDialogDesc', { title: moduleToReject?.title })}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('review.rejectReasonPlaceholder')}
            rows={4}
            className={'text-start'}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleToReject(null)}>
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectModuleMutation.isPending}
            >
              {rejectModuleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('review.rejectDialogConfirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignTrainingWizardModal
        open={assignWizardOpen}
        onOpenChange={setAssignWizardOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['learning-assignments'] })}
      />

      <ModuleQuickPreviewSheet
        moduleId={previewModuleId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onEdit={(id) => setViewMode('builder', { moduleId: id })}
        onView={(id) => navigate(`/learn/player/${id}`)}
        onAssign={(id) => handleAssign(id)}
      />

      {/* Upstream Master Version Sync Modal */}
      <MasterVersionSyncModal
        open={syncModalState.open}
        onOpenChange={(open) => setSyncModalState((prev) => ({ ...prev, open }))}
        targetContentId={syncModalState.module?.id || ''}
        targetTitle={syncModalState.module?.title || ''}
        contentType="course"
        onSyncComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['training-modules'] })
          refetchMasterDeployments()
        }}
      />
    </div>
  )
}

