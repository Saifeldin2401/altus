import { useQuery } from '@tanstack/react-query'

import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'

/**
 * How many readable articles of each type the hub can show - the same
 * filters as the hub's own list (published, indexed, current KB version, this
 * organization plus Altus master templates). KnowledgeService.getContentTypeCounts
 * counts drafts and superseded versions too, so it is not used for these tiles.
 */
export async function fetchPublishedTypeCounts(organizationId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('documents')
    .select('content_type')
    .eq('is_deleted', false)
    .eq('status', 'PUBLISHED')
    .eq('knowledge_base_status', 'indexed')
    .eq('is_active_kb_version', true)
    .or(`organization_id.eq.${organizationId},is_master_template.eq.true`)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const type = (row.content_type ?? 'unknown').toLowerCase()
    counts[type] = (counts[type] ?? 0) + 1
  }
  return counts
}

export function usePublishedTypeCounts() {
  const { currentOrganization } = useTenant()
  const orgId = currentOrganization?.id ?? null
  return useQuery({
    queryKey: ['knowledge-type-counts', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchPublishedTypeCounts(orgId as string),
  })
}
