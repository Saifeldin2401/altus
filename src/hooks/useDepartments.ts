import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import type { Json } from '@/types/database.generated';

interface Department {
  id: string;
  name: string;
  name_ar?: string;
  manager_id?: string;
}

/**
 * Departments of the current organization. Departments are organization-wide;
 * row-level security decides who may read and change them - the role check
 * here only hides actions a user could not complete.
 */
export function useDepartments() {
  const queryClient = useQueryClient();
  const { user, primaryRole } = useAuth();
  const { currentOrganization, isPlatformAdmin } = useTenant();

  const canManage = ['administrator', 'super_admin', 'corporate_admin', 'training_manager', 'regional_admin', 'regional_hr', 'property_manager', 'property_hr'].includes(primaryRole || '');

  const { data: departments = [], isLoading, error } = useQuery({
    queryKey: ['departments', currentOrganization?.id || (isPlatformAdmin ? 'platform' : 'none')],
    queryFn: async () => {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (currentOrganization?.id) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!currentOrganization?.id && isPlatformAdmin) {
        const seen = new Set<string>();
        const unique: Department[] = [];
        for (const dept of (data as Department[]) || []) {
          const key = dept.name.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(dept);
          }
        }
        return unique;
      }

      return (data || []) as Department[];
    },
    enabled: !!currentOrganization?.id || isPlatformAdmin,
  });

  const audit = (entityId: string, metadata: Json) => {
    if (!user || !currentOrganization?.id) return;
    supabase.from('system_events').insert({
      event_type: 'audit',
      actor_id: user.id,
      entity_type: 'department',
      entity_id: entityId,
      organization_id: currentOrganization.id,
      metadata,
    }).then(({ error: auditError }) => {
      if (auditError) console.error('Failed to write audit log:', auditError);
    });
  };

  const createDepartment = useMutation({
    mutationFn: async (dept: Omit<Department, 'id'>) => {
      if (!user) throw new Error('Unauthenticated');
      if (!canManage) throw new Error('Unauthorized');
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('departments')
        .insert({ ...dept, organization_id: currentOrganization.id })
        .select()
        .single();
      if (error) throw error;
      audit(data.id, { action: 'create', details: { name: dept.name } });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const updateDepartment = useMutation({
    mutationFn: async (dept: Partial<Department> & { id: string }) => {
      if (!user) throw new Error('Unauthenticated');
      if (!canManage) throw new Error('Unauthorized');
      const { error } = await supabase
        .from('departments')
        .update({ name: dept.name, manager_id: dept.manager_id })
        .eq('id', dept.id);
      if (error) throw error;
      audit(dept.id, { action: 'update', details: { name: dept.name ?? null, manager_id: dept.manager_id ?? null } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Unauthenticated');
      if (!canManage) throw new Error('Unauthorized');
      // Soft-delete by deactivating the department
      const { error } = await supabase.from('departments').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      audit(id, { action: 'delete', details: { deactivated: true } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  return {
    departments,
    isLoading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
