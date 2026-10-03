-- Migration: 20260928072000_audit_remediation_p0_fixes.sql
-- 1. Document Subsystem RLS Policies

-- document_approvals: INSERT
DROP POLICY IF EXISTS "document_approvals_insert_member" ON public.document_approvals;
CREATE POLICY "document_approvals_insert_member"
ON public.document_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.organization_memberships om ON om.organization_id = d.organization_id
    WHERE d.id = document_approvals.document_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

-- document_approvals: UPDATE
DROP POLICY IF EXISTS "document_approvals_update_reviewer" ON public.document_approvals;
CREATE POLICY "document_approvals_update_reviewer"
ON public.document_approvals
FOR UPDATE
TO authenticated
USING (
  auth.uid() = approver_id
  OR auth.uid() = approved_by
  OR auth.uid() = rejected_by
  OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_approvals.document_id
      AND (
        public.is_tenant_admin(d.organization_id)
        OR public.is_tenant_content_editor(d.organization_id)
      )
  )
)
WITH CHECK (
  auth.uid() = approver_id
  OR auth.uid() = approved_by
  OR auth.uid() = rejected_by
  OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_approvals.document_id
      AND (
        public.is_tenant_admin(d.organization_id)
        OR public.is_tenant_content_editor(d.organization_id)
      )
  )
);

-- document_comments: INSERT
DROP POLICY IF EXISTS "document_comments_insert_member" ON public.document_comments;
CREATE POLICY "document_comments_insert_member"
ON public.document_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.organization_memberships om ON om.organization_id = d.organization_id
    WHERE d.id = document_comments.document_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

-- document_folders: INSERT
DROP POLICY IF EXISTS "document_folders_insert_admin" ON public.document_folders;
CREATE POLICY "document_folders_insert_admin"
ON public.document_folders
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tenant_admin(document_folders.organization_id)
  OR public.is_tenant_content_editor(document_folders.organization_id)
);

-- document_tag_assignments: UPDATE
DROP POLICY IF EXISTS "document_tag_assignments_update_editor" ON public.document_tag_assignments;
CREATE POLICY "document_tag_assignments_update_editor"
ON public.document_tag_assignments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_tag_assignments.document_id
      AND (
        public.is_tenant_content_editor(d.organization_id)
        OR public.is_tenant_admin(d.organization_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_tag_assignments.document_id
      AND (
        public.is_tenant_content_editor(d.organization_id)
        OR public.is_tenant_admin(d.organization_id)
      )
  )
);

-- 2. Notifications RLS: DELETE
DROP POLICY IF EXISTS "notifications_delete_owner" ON public.notifications;
CREATE POLICY "notifications_delete_owner"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. System Events RLS: UPDATE & DELETE
DROP POLICY IF EXISTS "system_events_update_admin" ON public.system_events;
CREATE POLICY "system_events_update_admin"
ON public.system_events
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(system_events.organization_id)
  OR public.is_platform_super_admin()
)
WITH CHECK (
  public.is_tenant_admin(system_events.organization_id)
  OR public.is_platform_super_admin()
);

DROP POLICY IF EXISTS "system_events_delete_admin" ON public.system_events;
CREATE POLICY "system_events_delete_admin"
ON public.system_events
FOR DELETE
TO authenticated
USING (
  public.is_tenant_admin(system_events.organization_id)
  OR public.is_platform_super_admin()
);

-- 4. Concurrency-Safe Certificate Sequence
CREATE SEQUENCE IF NOT EXISTS public.certificate_number_seq START WITH 1000;

DO $$
DECLARE
  v_max_val BIGINT;
BEGIN
  SELECT MAX(CAST(NULLIF(regexp_replace(certificate_number, '^.*-', ''), '') AS BIGINT))
  INTO v_max_val
  FROM public.certificates;

  IF v_max_val IS NOT NULL AND v_max_val >= 1000 THEN
    PERFORM setval('public.certificate_number_seq', v_max_val + 1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS character varying AS $$
DECLARE
    prefix TEXT := 'CERT-';
    year_code TEXT := TO_CHAR(NOW(), 'YYYY');
    seq_val BIGINT;
BEGIN
    seq_val := nextval('public.certificate_number_seq');
    RETURN (prefix || year_code || '-' || LPAD(seq_val::TEXT, 6, '0'))::character varying;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Multi-Tenant Role Verification Definer
CREATE OR REPLACE FUNCTION public.is_hr_or_admin(p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = ANY (
        ARRAY[
          'administrator',
          'training_manager',
          'knowledge_manager',
          'super_admin',
          'corporate_admin',
          'regional_admin',
          'regional_hr',
          'property_hr'
        ]
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = p_user_id
      AND om.is_active = true
      AND om.role::text = ANY (
        ARRAY[
          'organization_admin',
          'organization_owner',
          'brand_admin',
          'hotel_admin',
          'training_manager',
          'knowledge_manager',
          'department_manager'
        ]
      )
  );
$function$;

-- 6. Privacy & PII Protection: Drop profiles from Realtime Publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
    END IF;
END $$;
