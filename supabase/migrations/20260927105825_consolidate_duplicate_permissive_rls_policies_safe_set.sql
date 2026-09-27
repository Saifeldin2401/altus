-- document_acknowledgments (SELECT, SELECT) — same role, no ALL-policy involved
DROP POLICY IF EXISTS document_acknowledgments_people_admin_read ON public.document_acknowledgments;
DROP POLICY IF EXISTS document_acknowledgments_select_own ON public.document_acknowledgments;
CREATE POLICY document_acknowledgments_select ON public.document_acknowledgments
  FOR SELECT TO authenticated
  USING (
    ((organization_id = ANY (current_user_organization_ids())) AND is_tenant_people_admin(organization_id))
    OR (user_id = (SELECT auth.uid()))
  );

-- document_comments (UPDATE, UPDATE)
DROP POLICY IF EXISTS document_comments_resolve ON public.document_comments;
DROP POLICY IF EXISTS document_comments_update_own ON public.document_comments;
CREATE POLICY document_comments_update ON public.document_comments
  FOR UPDATE TO authenticated
  USING (
    (org_visible(organization_id) AND (is_tenant_content_editor(organization_id) OR (EXISTS (
      SELECT 1 FROM documents d
      WHERE (d.id = document_comments.document_id)
        AND ((d.created_by = (SELECT auth.uid())) OR (d.owner_id = (SELECT auth.uid())))
    ))))
    OR (user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    (org_visible(organization_id) AND (is_tenant_content_editor(organization_id) OR (EXISTS (
      SELECT 1 FROM documents d
      WHERE (d.id = document_comments.document_id)
        AND ((d.created_by = (SELECT auth.uid())) OR (d.owner_id = (SELECT auth.uid())))
    ))))
    OR (user_id = (SELECT auth.uid()))
  );

-- learning_assignment_exemptions (SELECT, SELECT)
DROP POLICY IF EXISTS learning_assignment_exemptions_people_admin_read ON public.learning_assignment_exemptions;
DROP POLICY IF EXISTS learning_assignment_exemptions_select_policy ON public.learning_assignment_exemptions;
CREATE POLICY learning_assignment_exemptions_select ON public.learning_assignment_exemptions
  FOR SELECT TO authenticated
  USING (
    ((organization_id = ANY (current_user_organization_ids())) AND is_tenant_people_admin(organization_id))
    OR ((user_id = (SELECT auth.uid())) OR can_manage_learning_assignment(organization_id))
  );

-- learning_assignment_user_overrides (SELECT, SELECT)
DROP POLICY IF EXISTS learning_assignment_user_overrides_people_admin_read ON public.learning_assignment_user_overrides;
DROP POLICY IF EXISTS learning_assignment_user_overrides_select_policy ON public.learning_assignment_user_overrides;
CREATE POLICY learning_assignment_user_overrides_select ON public.learning_assignment_user_overrides
  FOR SELECT TO authenticated
  USING (
    ((organization_id = ANY (current_user_organization_ids())) AND is_tenant_people_admin(organization_id))
    OR ((user_id = (SELECT auth.uid())) OR can_manage_learning_assignment(organization_id))
  );

-- notification_delivery_events (SELECT, SELECT)
DROP POLICY IF EXISTS nde_tenant_admin_read ON public.notification_delivery_events;
DROP POLICY IF EXISTS users_view_own_notification_delivery_events ON public.notification_delivery_events;
CREATE POLICY notification_delivery_events_select ON public.notification_delivery_events
  FOR SELECT TO authenticated
  USING (
    (((organization_id IS NOT NULL) AND org_visible(organization_id) AND is_tenant_admin(organization_id)) OR is_platform_super_admin())
    OR (user_id = (SELECT auth.uid()))
  );

-- notification_queue (SELECT, SELECT) — role sets differ (public vs authenticated); keep broadest (public) to preserve original scope
DROP POLICY IF EXISTS "Users can view own queue items" ON public.notification_queue;
DROP POLICY IF EXISTS nq_tenant_admin_read ON public.notification_queue;
CREATE POLICY notification_queue_select ON public.notification_queue
  FOR SELECT TO public
  USING (
    ((SELECT auth.uid()) = user_id)
    OR (((organization_id IS NOT NULL) AND org_visible(organization_id) AND is_tenant_admin(organization_id)) OR is_platform_super_admin())
  );

-- user_sessions (INSERT, INSERT) — role sets differ; union to preserve original scope
DROP POLICY IF EXISTS user_sessions_insert ON public.user_sessions;
DROP POLICY IF EXISTS user_sessions_manage_tenant_insert ON public.user_sessions;
CREATE POLICY user_sessions_insert ON public.user_sessions
  FOR INSERT TO authenticated, service_role
  WITH CHECK (
    ((user_id = (SELECT auth.uid())) OR ((SELECT auth.role()) = 'service_role'::text))
    OR ((org_visible(organization_id) AND is_tenant_people_admin(organization_id)) OR is_platform_super_admin())
  );
