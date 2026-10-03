-- Migration: 20261003200000_architecture_review_fixes.sql
-- Fixes from the 2026-10-03 architecture review (findings H2, H3, M6, L1, L4
-- and the approve_pending_user mismatch).
-- Policies are changed in place with ALTER POLICY (each one is created by an
-- earlier migration); nothing is removed and recreated.

-- ---------------------------------------------------------------------------
-- H3. translation_cache crossed tenants.
-- Every signed-in user could read every cached translation and insert or
-- overwrite any row. Only the ai-translation Edge Function uses the table, with
-- the service role, so the policies now apply to that role only (named for it)
-- and API roles lose table access entirely.
-- ---------------------------------------------------------------------------
ALTER POLICY "Anyone authenticated can view translations" ON public.translation_cache TO service_role;
ALTER POLICY "Anyone authenticated can view translations" ON public.translation_cache RENAME TO "translation_cache_service_select";
ALTER POLICY "Authorized users can insert translations" ON public.translation_cache TO service_role;
ALTER POLICY "Authorized users can insert translations" ON public.translation_cache RENAME TO "translation_cache_service_insert";
ALTER POLICY "Authorized users can update translations" ON public.translation_cache TO service_role;
ALTER POLICY "Authorized users can update translations" ON public.translation_cache RENAME TO "translation_cache_service_update";
REVOKE ALL ON public.translation_cache FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- M6. Definer functions that signed-out callers could execute.
-- prune_translation_cache deletes rows and checks no caller; it is maintenance
-- for the service role only. generate_certificate_number burns sequence values;
-- certificates are issued by definer functions, never by anon.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.prune_translation_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_translation_cache() TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_certificate_number() FROM PUBLIC, anon;
-- purge_course checks its caller, but it is destructive and only meant for
-- signed-in authors; the default PUBLIC grant also reached anon.
REVOKE EXECUTE ON FUNCTION public.purge_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_course(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- H2. content-media, media and training-content could be listed by anyone.
-- The buckets stay public on purpose (editor embeds and organization logos are
-- stored as public URLs and must keep working, including on the signed-out
-- certificate page), and public-URL downloads do not consult RLS. These SELECT
-- policies only govern API access: listing, signing and downloading through the
-- client. They now admit signed-in members of the organization that owns the
-- file instead of every role including anon. A reader outside that scope still
-- renders the stored public URL; resolveStorageUrl falls back to it.
-- The CASE guards keep the uuid casts from running on non-uuid folder names.
-- ---------------------------------------------------------------------------
ALTER POLICY "content_media_select" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'content-media'
    AND (
      public.is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR CASE
           WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
             ((storage.foldername(name))[1])::uuid = ANY (public.current_user_organization_ids())
             OR public.users_share_active_org(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
           ELSE false
         END
      OR CASE
           WHEN (storage.foldername(name))[1] = 'courses'
             AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
             EXISTS (
               SELECT 1 FROM public.courses c
               WHERE c.id = ((storage.foldername(name))[2])::uuid
                 AND (c.organization_id IS NULL OR c.organization_id = ANY (public.current_user_organization_ids()))
             )
           ELSE false
         END
    )
  );

ALTER POLICY "training_content_select" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'training-content'
    AND (
      public.is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR CASE
           WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
             ((storage.foldername(name))[1])::uuid = ANY (public.current_user_organization_ids())
             OR public.users_share_active_org(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
           ELSE false
         END
    )
  );

ALTER POLICY "Media bucket select policy" ON storage.objects
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      public.is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR CASE
           WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
             ((storage.foldername(name))[1])::uuid = ANY (public.current_user_organization_ids())
             OR public.users_share_active_org(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
           ELSE false
         END
    )
  );

-- ---------------------------------------------------------------------------
-- approve_pending_user: the frontend rejects with p_rejection_reason, which the
-- old two-argument signature did not accept, so every rejection failed. It also
-- authorized with legacy global roles and updated rows in every organization.
-- Now: the reason is stored, and the caller must administer the organization
-- the request belongs to (or be a platform operator).
-- The three-argument form takes no defaults and the existing two-argument form
-- delegates to it, so every call shape resolves to exactly one function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_pending_user(
  p_user_id uuid,
  p_approve boolean,
  p_rejection_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.pending_user_approvals
   WHERE user_id = p_user_id AND status = 'pending'
   ORDER BY requested_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending approval for this user.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_platform_operator(v_caller)
    OR (v_org IS NOT NULL AND (public.is_tenant_admin(v_org) OR public.is_tenant_people_admin(v_org)))
  ) THEN
    RAISE EXCEPTION 'Not authorized to review user approvals for this organization.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pending_user_approvals
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = v_caller,
         reviewed_at = now(),
         rejection_reason = CASE WHEN p_approve THEN NULL ELSE NULLIF(btrim(p_rejection_reason), '') END
   WHERE user_id = p_user_id
     AND status = 'pending'
     AND organization_id IS NOT DISTINCT FROM v_org;

  IF p_approve THEN
    UPDATE public.profiles SET account_status = 'active', is_active = true WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles SET is_active = false WHERE id = p_user_id;
  END IF;

  RETURN json_build_object('success', true, 'user_id', p_user_id, 'approved', p_approve);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_pending_user(p_user_id uuid, p_approve boolean DEFAULT true)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT public.approve_pending_user(p_user_id, p_approve, NULL::text);
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_pending_user(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_user(uuid, boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_pending_user(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_user(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- L4. Four policies from 20260928042147 called auth.uid() once per row.
-- Same rules, with auth.uid() wrapped so Postgres evaluates it once per query.
-- ---------------------------------------------------------------------------
ALTER POLICY "document_approvals_insert_member" ON public.document_approvals
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.documents d
        JOIN public.organization_memberships om ON om.organization_id = d.organization_id
       WHERE d.id = document_approvals.document_id
         AND om.user_id = (SELECT auth.uid())
         AND om.is_active = true
    )
  );

ALTER POLICY "document_approvals_update_reviewer" ON public.document_approvals
  USING (
    (SELECT auth.uid()) = approver_id
    OR (SELECT auth.uid()) = approved_by
    OR (SELECT auth.uid()) = rejected_by
    OR EXISTS (
      SELECT 1 FROM public.documents d
       WHERE d.id = document_approvals.document_id
         AND (public.is_tenant_admin(d.organization_id) OR public.is_tenant_content_editor(d.organization_id))
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = approver_id
    OR (SELECT auth.uid()) = approved_by
    OR (SELECT auth.uid()) = rejected_by
    OR EXISTS (
      SELECT 1 FROM public.documents d
       WHERE d.id = document_approvals.document_id
         AND (public.is_tenant_admin(d.organization_id) OR public.is_tenant_content_editor(d.organization_id))
    )
  );

ALTER POLICY "notifications_delete_owner" ON public.notifications
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "document_comments_insert_member" ON public.document_comments
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
        FROM public.documents d
        JOIN public.organization_memberships om ON om.organization_id = d.organization_id
       WHERE d.id = document_comments.document_id
         AND om.user_id = (SELECT auth.uid())
         AND om.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- L1. The nightly model verifier runs longer than its 120 s pg_net timeout, so
-- the request was abandoned while cron still reported success. Allow 5 minutes.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'ai-model-verifier-nightly';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      v_job_id,
      command := $cmd$
    SELECT net.http_post(
      url := 'https://dhbfaclkfysqwfppuxxa.supabase.co/functions/v1/ai-model-verifier',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)),
      body := '{"mode":"all","onlyUnverified":true,"source":"cron"}'::jsonb,
      timeout_milliseconds := 300000
    );
    $cmd$
    );
  END IF;
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN
    NULL; -- pg_cron is not installed (local or branch databases)
END;
$$;
