import { beforeEach, describe, expect, it, vi } from 'vitest'

const orCalls: string[] = []

const tableData: Record<string, unknown[]> = {
  user_roles: [{ role: 'administrator' }, { role: 'learner' }],
  organization_memberships: [{ department_id: 'dept-1', role: 'organization_admin' }],
}

function chain(table: string) {
  const result = { data: tableData[table] ?? [], error: null }
  const builder: Record<string, unknown> = {}
  const self = () => builder
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'is', 'neq', 'gte', 'lte']) {
    builder[method] = vi.fn(self)
  }
  builder.or = vi.fn((filter: string) => {
    if (table === 'assignments') orCalls.push(filter)
    return builder
  })
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  builder.single = vi.fn(async () => ({ data: null, error: null }))
  builder.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}))

import { learningService } from './learningService'

describe('getMyAssignments role matching', () => {
  beforeEach(() => {
    orCalls.length = 0
  })

  it('matches role assignments on the membership role and the legacy app role', async () => {
    await learningService.getMyAssignments().catch(() => undefined)

    const filter = orCalls.join(',')
    // The assign wizard and the server resolve role assignments by membership role.
    expect(filter).toContain('and(target_type.eq.role,target_id.eq.organization_admin,')
    // Assignments created before that still use the app_role projection.
    expect(filter).toContain('and(target_type.eq.role,target_id.eq.administrator,')
    expect(filter).toContain('and(target_type.eq.department,target_id.eq.dept-1,')
    // Each role appears once even when both sources carry it.
    expect(filter.match(/target_id\.eq\.learner,/g)?.length ?? 0).toBeLessThanOrEqual(1)
  })
})
