import { useQuery } from '@tanstack/react-query'

import { useTenant } from '@/contexts/TenantContext'

import { fetchCatalog, type CatalogCourse } from './catalogApi'

export function useCatalog() {
  const { currentOrganization } = useTenant()
  const orgId = currentOrganization?.id ?? null
  return useQuery({
    queryKey: ['learn-catalog', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchCatalog(orgId as string),
  })
}

/**
 * "Recommended for you": published courses the member has not started, is not
 * already assigned and has not finished. Courses in categories the member is
 * already studying come first, then the newest. Pure selection over the
 * catalog - no invented relevance score.
 */
export function selectRecommended(
  catalog: CatalogCourse[] | undefined,
  touchedCourseIds: Set<string>,
  limit = 3,
): CatalogCourse[] {
  const all = catalog ?? []
  const studiedCategories = new Set(
    all.filter((c) => touchedCourseIds.has(c.id) && c.category).map((c) => c.category as string),
  )
  return all
    .filter((c) => !touchedCourseIds.has(c.id))
    .sort((a, b) => {
      const pa = a.category && studiedCategories.has(a.category) ? 0 : 1
      const pb = b.category && studiedCategories.has(b.category) ? 0 : 1
      return pa - pb || Date.parse(b.created_at) - Date.parse(a.created_at)
    })
    .slice(0, limit)
}
