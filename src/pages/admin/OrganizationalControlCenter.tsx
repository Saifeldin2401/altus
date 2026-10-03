import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    Briefcase,
    Building2,
    Crown,
    GitBranch,
    List,
    Network,
    RefreshCw,
    Search,
    Shield,
    Users,
    type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OrgByDepartment } from '@/components/admin/OrgByDepartment'
import { OrgChartStats, OrgChartTree } from '@/components/admin/OrgChartTree'
import { ReportingLineEditor } from '@/components/admin/ReportingLineEditor'
import { OrgStructureTree } from '@/components/org/OrgStructureTree'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTenant } from '@/contexts/TenantContext'
import { buildOrgTree, useOrgHierarchy, type OrgTreeNode } from '@/hooks/useOrganization'
import { supabase } from '@/lib/supabase'
import { cn, escapeSearchQuery } from '@/lib/utils'
import { EmptyState, SectionHeader, Skeleton, WorkspaceHeader, headerActionClass } from '@/ui'

import { BrandsManagement } from './components/BrandsManagement'
import { DepartmentsManagement } from './components/DepartmentsManagement'
import { MembershipsManagement } from './components/MembershipsManagement'
import { RolesManagement } from './components/RolesManagement'

/** The parts of the structure, in the order an admin sets them up. */
const TABS = ['structure', 'departments', 'brands', 'memberships', 'orgchart', 'roles'] as const
type StructureTab = (typeof TABS)[number]

/** How reporting lines are shown: grouped by department, as a tree, or as a list. */
const VIEWS = ['department', 'hierarchy', 'list'] as const
type ReportingView = (typeof VIEWS)[number]

const tabTriggerClass =
    'min-h-[44px] gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-ds-muted shadow-none hover:text-ds-ink data-[state=active]:border-ds-brass data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ds-ink data-[state=active]:shadow-none'

export default function OrganizationalControlCenter() {
    const { t } = useTranslation(['admin', 'common', 'nav'])
    const navigate = useNavigate()
    const { currentOrganization, refreshTenantData } = useTenant()
    // ?tab= (and ?view= for reporting lines) make each part of the structure
    // linkable: Organization overview links straight to departments or people.
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedTab = searchParams.get('tab')

    // Older links pointed at tabs that now live on their own page.
    useEffect(() => {
        if (requestedTab === 'profile') navigate('/admin/settings#settings-profile', { replace: true })
        else if (requestedTab === 'history') navigate('/admin/audit', { replace: true })
        else if (requestedTab === 'assignments') {
            const next = new URLSearchParams(searchParams)
            next.set('tab', 'orgchart')
            next.set('view', 'list')
            setSearchParams(next, { replace: true })
        }
    }, [requestedTab, navigate, searchParams, setSearchParams])

    const activeTab: StructureTab = TABS.includes(requestedTab as StructureTab) ? (requestedTab as StructureTab) : 'structure'
    const requestedView = searchParams.get('view')
    const viewMode: ReportingView = VIEWS.includes(requestedView as ReportingView) ? (requestedView as ReportingView) : 'department'

    const setParam = (key: 'tab' | 'view', value: string) => {
        const next = new URLSearchParams(searchParams)
        next.set(key, value)
        if (key === 'tab') next.delete('view')
        setSearchParams(next, { replace: true })
    }

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedEmployee, setSelectedEmployee] = useState<OrgTreeNode | null>(null)
    const [isEditorOpen, setIsEditorOpen] = useState(false)

    const { data: hierarchyData, isLoading: isLoadingHierarchy, refetch: refetchHierarchy } = useOrgHierarchy()
    const treeNodes = hierarchyData ? buildOrgTree(hierarchyData) : []
    const filteredNodes = searchTerm ? filterTreeNodes(treeNodes, searchTerm) : treeNodes

    const handleEditNode = (node: OrgTreeNode) => {
        setSelectedEmployee(node)
        setIsEditorOpen(true)
    }

    const handleGlobalRefresh = async () => {
        await Promise.all([refetchHierarchy(), refreshTenantData()])
    }

    const tabs: { id: StructureTab; icon: LucideIcon; label: string }[] = [
        { id: 'structure', icon: Network, label: t('admin:structure.tab_structure', 'Overview') },
        { id: 'departments', icon: Briefcase, label: t('admin:structure.tab_departments', 'Departments') },
        { id: 'brands', icon: Crown, label: t('admin:structure.tab_brands', 'Brands') },
        { id: 'memberships', icon: Users, label: t('admin:structure.tab_people', 'People & placement') },
        { id: 'orgchart', icon: GitBranch, label: t('admin:structure.tab_reporting', 'Reporting lines') },
        { id: 'roles', icon: Shield, label: t('admin:structure.tab_roles', 'Roles') },
    ]

    const views: { id: ReportingView; icon: LucideIcon; label: string }[] = [
        { id: 'department', icon: Building2, label: t('admin:organization.by_department', 'By department') },
        { id: 'hierarchy', icon: GitBranch, label: t('admin:organization.by_hierarchy', 'By manager') },
        { id: 'list', icon: List, label: t('admin:organization.as_list', 'List') },
    ]

    return (
        <div className="space-y-6">
            <WorkspaceHeader
                eyebrow={t('admin:structure.eyebrow', 'Organization')}
                title={t('admin:structure.title_org', 'Structure')}
                context={currentOrganization?.name ?? null}
                actions={
                    <button type="button" onClick={handleGlobalRefresh} className={headerActionClass.secondary}>
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />{t('common:refresh', 'Refresh')}
                    </button>
                }
            />

            <Tabs value={activeTab} onValueChange={(tab) => setParam('tab', tab)}>
                <TabsList className="flex h-auto min-h-0 w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-none border-0 border-b border-ds-border bg-transparent p-0">
                    {tabs.map(({ id, icon: Icon, label }) => (
                        <TabsTrigger key={id} value={id} className={tabTriggerClass}>
                            <Icon aria-hidden="true" className="h-4 w-4" />
                            <span>{label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="structure" className="mt-6">
                    <OrgStructureTree orgId={currentOrganization?.id || ''} />
                </TabsContent>

                <TabsContent value="departments" className="mt-6">
                    <DepartmentsManagement />
                </TabsContent>

                <TabsContent value="brands" className="mt-6">
                    <BrandsManagement />
                </TabsContent>

                <TabsContent value="memberships" className="mt-6">
                    <MembershipsManagement />
                </TabsContent>

                <TabsContent value="orgchart" className="mt-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div role="radiogroup" aria-label={t('admin:organization.view_mode_label', 'Show reporting lines')} className="inline-flex w-fit rounded-[6px] border border-ds-border bg-ds-surface-subtle p-1">
                            {views.map(({ id, icon: Icon, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="radio"
                                    aria-checked={viewMode === id}
                                    onClick={() => setParam('view', id)}
                                    className={cn(
                                        'inline-flex min-h-[36px] items-center gap-1.5 rounded-[4px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent',
                                        viewMode === id
                                            ? 'bg-ds-surface font-semibold text-ds-ink shadow-[0_0_0_1px_rgb(var(--ds-border))]'
                                            : 'text-ds-muted hover:text-ds-ink'
                                    )}
                                >
                                    <Icon aria-hidden="true" className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
                            <Input
                                type="search"
                                aria-label={t('admin:organization.search_employees', 'Search people')}
                                placeholder={t('admin:organization.search_employees', 'Search people')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ps-9"
                            />
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <ReportingLinesTable searchTerm={searchTerm} onEditEmployee={handleEditNode} />
                    ) : viewMode === 'department' ? (
                        <OrgByDepartment
                            searchTerm={searchTerm}
                            onEmployeeClick={(emp) => {
                                setSelectedEmployee({
                                    id: emp.id,
                                    full_name: emp.full_name,
                                    job_title: emp.job_title,
                                    email: emp.email,
                                    reporting_to: emp.reporting_to,
                                    manager_name: null,
                                    depth: 0,
                                    path: [],
                                    path_names: [],
                                    children: []
                                })
                            }}
                        />
                    ) : isLoadingHierarchy ? (
                        <div className="space-y-3" aria-busy="true">
                            <Skeleton variant="card" className="h-24" />
                            <Skeleton variant="card" className="h-64" />
                        </div>
                    ) : filteredNodes.length === 0 ? (
                        <EmptyState
                            icon={<Users className="h-6 w-6" />}
                            title={t('admin:organization.no_employees', 'No people found')}
                            description={searchTerm
                                ? t('admin:organization.adjust_filters', 'Try a different name or clear the search.')
                                : t('admin:organization.no_reporting_lines', 'Nobody has a manager set yet. Use the List view to set reporting lines.')}
                        />
                    ) : (
                        <>
                            <OrgChartStats nodes={filteredNodes} />
                            <section aria-labelledby="org-hierarchy-title" className="rounded-[8px] border border-ds-border bg-ds-surface p-4 sm:p-5">
                                <SectionHeader
                                    headingId="org-hierarchy-title"
                                    title={t('admin:organization.hierarchy', 'Who reports to whom')}
                                    subtitle={t('admin:organization.hierarchy_desc', 'Select a person to see details, or use their menu to change who they report to.')}
                                    className="mb-3 border-b border-ds-border pb-3"
                                />
                                <OrgChartTree
                                    nodes={filteredNodes}
                                    onNodeClick={setSelectedEmployee}
                                    onEditNode={handleEditNode}
                                    selectedNodeId={selectedEmployee?.id}
                                />
                            </section>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="roles" className="mt-6">
                    <RolesManagement />
                </TabsContent>
            </Tabs>

            <ReportingLineEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                employee={selectedEmployee}
            />
        </div>
    )
}

// Helper function to filter tree nodes
function filterTreeNodes(nodes: OrgTreeNode[], term: string): OrgTreeNode[] {
    const lowerTerm = term.toLowerCase()

    return nodes.reduce<OrgTreeNode[]>((acc, node) => {
        const matches =
            node.full_name?.toLowerCase().includes(lowerTerm) ||
            node.job_title?.toLowerCase().includes(lowerTerm) ||
            node.email?.toLowerCase().includes(lowerTerm)

        const filteredChildren = filterTreeNodes(node.children, term)

        if (matches || filteredChildren.length > 0) {
            acc.push({
                ...node,
                children: filteredChildren
            })
        }

        return acc
    }, [])
}

/** Reporting lines as a list: each person's department, role and manager. */
function ReportingLinesTable({
    searchTerm,
    onEditEmployee
}: {
    searchTerm: string
    onEditEmployee: (node: OrgTreeNode) => void
}) {
    const { t } = useTranslation(['admin', 'common', 'nav'])
    const { currentOrganization } = useTenant()

    const { data: employees, isLoading } = useQuery({
        queryKey: ['org-assignments-data', currentOrganization?.id, searchTerm],
        queryFn: async () => {
            if (!currentOrganization?.id) return []

            // Query profiles in active organization memberships
            const memberQuery = supabase
                .from('organization_memberships')
                .select(`
                    id,
                    user_id,
                    role,
                    department_id,
                    department:departments(name),
                    profile:profiles(id, full_name, email, job_title, staff_id, reporting_to, is_active)
                `)
                .eq('organization_id', currentOrganization.id)
                .eq('is_active', true)

            const { data: memberRows, error: memberErr } = await memberQuery.limit(150)

            if (memberErr || !memberRows) {
                console.warn('Membership query error, trying direct profiles:', memberErr)
                // Fallback to active profiles
                let query = supabase
                    .from('profiles')
                    .select('id, full_name, email, job_title, staff_id, reporting_to, is_active')
                    .eq('is_active', true)
                    .order('full_name')

                if (searchTerm) {
                    const escaped = escapeSearchQuery(searchTerm)
                    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%,job_title.ilike.%${escaped}%`)
                }
                const { data: directProfiles } = await query.limit(50)
                return (directProfiles || []).map(p => ({
                    id: p.id,
                    full_name: p.full_name,
                    email: p.email,
                    job_title: p.job_title,
                    staff_id: p.staff_id,
                    reporting_to: p.reporting_to,
                    dept_name: '—',
                    role: 'learner',
                    manager: null
                }))
            }

            // Extract profiles and search filter
            let items = memberRows.map(m => {
                const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
                const d = Array.isArray(m.department) ? m.department[0] : m.department
                return {
                    id: p?.id || m.user_id,
                    full_name: p?.full_name || 'Staff Member',
                    email: p?.email || '',
                    job_title: p?.job_title || '—',
                    staff_id: p?.staff_id || '—',
                    reporting_to: p?.reporting_to || null,
                    dept_name: d?.name || '—',
                    role: m.role || 'learner',
                    manager: null as { full_name?: string; staff_id?: string } | null
                }
            })

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase()
                items = items.filter(i => 
                    i.full_name.toLowerCase().includes(term) ||
                    i.email.toLowerCase().includes(term) ||
                    i.job_title.toLowerCase().includes(term)
                )
            }

            // Fetch manager names in bulk
            const managerIds = items.map(i => i.reporting_to).filter(Boolean) as string[]
            if (managerIds.length > 0) {
                const { data: managers } = await supabase
                    .from('profiles')
                    .select('id, full_name, staff_id')
                    .in('id', managerIds)

                if (managers) {
                    items.forEach(i => {
                        const mgr = managers.find(m => m.id === i.reporting_to)
                        if (mgr) i.manager = mgr
                    })
                }
            }

            return items
        },
        enabled: !!currentOrganization?.id
    })

    if (isLoading) {
        return (
            <div className="space-y-2" aria-busy="true">
                <Skeleton variant="card" className="h-12" />
                <Skeleton variant="card" className="h-64" />
            </div>
        )
    }

    if (!employees || employees.length === 0) {
        return (
            <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={t('admin:organization.no_employees', 'No people found')}
                description={t('admin:organization.adjust_filters', 'Try a different name or clear the search.')}
            />
        )
    }

    return (
        <div className="overflow-x-auto rounded-[8px] border border-ds-border bg-ds-surface">
            <Table>
                <TableHeader className="bg-ds-surface-subtle">
                    <TableRow className="border-ds-border hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-ds-muted">{t('admin:organization.employee', 'Person')}</TableHead>
                        <TableHead className="text-xs font-semibold text-ds-muted">{t('admin:organization.reports_to', 'Reports to')}</TableHead>
                        <TableHead className="text-xs font-semibold text-ds-muted">{t('admin:organization.department', 'Department')}</TableHead>
                        <TableHead className="text-xs font-semibold text-ds-muted">{t('admin:organization.role', 'Role')}</TableHead>
                        <TableHead><span className="sr-only">{t('admin:actions', 'Actions')}</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.map((emp) => (
                        <TableRow key={emp.id} className="border-ds-border hover:bg-ds-surface-subtle/60">
                            <TableCell>
                                <span className="block text-sm font-semibold text-ds-ink">{emp.full_name}</span>
                                <span className="block text-xs text-ds-muted">
                                    {[emp.job_title !== '—' ? emp.job_title : null, emp.staff_id !== '—' ? emp.staff_id : null].filter(Boolean).join(' · ') || '—'}
                                </span>
                            </TableCell>
                            <TableCell>
                                {emp.manager?.full_name ? (
                                    <span className="text-sm text-ds-ink">{emp.manager.full_name}</span>
                                ) : (
                                    <span className="text-sm text-ds-warning">{t('admin:organization.manager_not_set', 'Not set')}</span>
                                )}
                            </TableCell>
                            <TableCell className="text-sm text-ds-ink-secondary">{emp.dept_name}</TableCell>
                            <TableCell className="text-sm text-ds-ink-secondary">
                                {t(`nav:shell.roles.${emp.role}`, emp.role.replace(/_/g, ' '))}
                            </TableCell>
                            <TableCell className="text-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    aria-label={t('admin:organization.change_manager_for', 'Change manager for {{name}}', { name: emp.full_name })}
                                    onClick={() => onEditEmployee({
                                        id: emp.id,
                                        full_name: emp.full_name,
                                        job_title: emp.job_title,
                                        email: emp.email,
                                        reporting_to: emp.reporting_to,
                                        manager_name: emp.manager?.full_name,
                                        depth: 0,
                                        path: [],
                                        path_names: [],
                                        children: []
                                    })}
                                >
                                    {t('admin:organization.change_manager', 'Change manager')}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
