-- Any authenticated user could read every tenant's notification batches; the
-- tenant-scoped notification_batches_people_admin_read policy covers the admin page.
DROP POLICY IF EXISTS "Authenticated can view all batches" ON public.notification_batches;

DROP FUNCTION IF EXISTS public._legacy_platform_fallback(uuid);

-- Split ALL policies into per-command policies so they stop overlapping the SELECT policy.
DROP POLICY IF EXISTS brands_tenant_isolation_admin ON public.brands;
DROP POLICY IF EXISTS brands_tenant_isolation_select ON public.brands;

CREATE POLICY brands_select ON public.brands
  FOR SELECT TO public
  USING (
    is_platform_super_admin()
    OR is_tenant_admin(organization_id)
    OR ((organization_id IN (SELECT unnest(current_user_organization_ids()))) AND org_is_operational(organization_id))
    OR has_active_platform_session(organization_id)
  );

CREATE POLICY brands_admin_insert ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_super_admin() OR is_tenant_admin(organization_id));

CREATE POLICY brands_admin_update ON public.brands
  FOR UPDATE TO authenticated
  USING (is_platform_super_admin() OR is_tenant_admin(organization_id))
  WITH CHECK (is_platform_super_admin() OR is_tenant_admin(organization_id));

CREATE POLICY brands_admin_delete ON public.brands
  FOR DELETE TO authenticated
  USING (is_platform_super_admin() OR is_tenant_admin(organization_id));

DROP POLICY IF EXISTS role_capabilities_write ON public.role_capabilities;

CREATE POLICY role_capabilities_insert ON public.role_capabilities
  FOR INSERT TO authenticated
  WITH CHECK (platform_operator_has_role('system_owner'::text));

CREATE POLICY role_capabilities_update ON public.role_capabilities
  FOR UPDATE TO authenticated
  USING (platform_operator_has_role('system_owner'::text))
  WITH CHECK (platform_operator_has_role('system_owner'::text));

CREATE POLICY role_capabilities_delete ON public.role_capabilities
  FOR DELETE TO authenticated
  USING (platform_operator_has_role('system_owner'::text));
