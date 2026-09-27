import { useTenant } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import type { DocumentTag } from './types'

export function useDocumentTags() {
  const { currentOrganization } = useTenant()
  const orgId = currentOrganization?.id

  return useQuery({
    queryKey: ['document-tags', orgId],
    queryFn: async () => {
      let query = supabase
        .from('document_tags')
        .select(`
          *,
          usage_count:document_tag_assignments(count)
        `)
        .order('name', { ascending: true })

      if (orgId) {
        query = query.eq('organization_id', orgId)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(tag => ({
        ...tag,
        description: null,
        usage_count: tag.usage_count?.[0]?.count || 0
      })) as DocumentTag[]
    },
  })
}
