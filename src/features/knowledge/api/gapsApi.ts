import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export interface ContentGap {
  term: string
  searches: number
  distinct_users: number
  last_searched_at: string
}

/**
 * What members searched for (or asked) and found nothing - the knowledge
 * team's to-write list. The RPC is scoped to organizations the caller manages
 * (learning_manager_org_ids), so it returns nothing to everyone else.
 */
export function useContentGaps(enabled: boolean, days = 30, limit = 6) {
  return useQuery({
    queryKey: ['knowledge-content-gaps', days, limit],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_knowledge_analytics_zero_result_searches', { p_days: days, p_limit: limit })
      if (error) throw error
      return (data ?? []) as ContentGap[]
    },
  })
}
