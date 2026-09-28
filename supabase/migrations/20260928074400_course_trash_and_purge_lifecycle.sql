-- Migration: 20260928074400_course_trash_and_purge_lifecycle.sql
-- Description: Adds deleted_at to courses and introduces safe, audited purge_course RPC.

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.purge_course(p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_course record;
  v_is_authorized boolean := false;
  v_cert_count integer := 0;
  v_progress_count integer := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found.' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_platform_operator(v_caller_id) THEN
    v_is_authorized := true;
  ELSIF v_course.organization_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE organization_id = v_course.organization_id
        AND user_id = v_caller_id
        AND is_active = true
        AND role IN ('organization_owner', 'organization_admin', 'brand_admin', 'training_manager')
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access Denied: You do not have permission to permanently purge courses in this organization.'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Check for issued certificates
  SELECT count(*) INTO v_cert_count
  FROM public.certificates
  WHERE training_module_id = p_course_id;

  IF v_cert_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot permanently delete this course: %s certificates have been issued. The course must remain archived for compliance.', v_cert_count),
      'has_certificates', true,
      'cert_count', v_cert_count
    );
  END IF;

  -- 2. Check for learner progress
  SELECT count(*) INTO v_progress_count
  FROM public.training_progress
  WHERE course_id = p_course_id
    AND (status IN ('completed', 'passed', 'failed') OR progress_percentage > 0);

  IF v_progress_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot permanently delete this course: %s learners have recorded training progress. The course must remain archived for audit records.', v_progress_count),
      'has_progress', true,
      'progress_count', v_progress_count
    );
  END IF;

  -- 3. Clean up unstarted progress stubs
  DELETE FROM public.training_progress WHERE course_id = p_course_id;

  -- 4. Delete course (foreign keys cascade lessons, visual assets, course versions)
  DELETE FROM public.courses WHERE id = p_course_id;

  -- 5. Audit log event
  INSERT INTO public.system_events (
    event_type,
    actor_id,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    'course_permanently_purged',
    v_caller_id,
    'courses',
    p_course_id,
    jsonb_build_object(
      'course_title', v_course.title,
      'organization_id', v_course.organization_id,
      'purged_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'course_id', p_course_id,
    'message', 'Course and draft assets permanently purged.'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.purge_course(uuid) TO authenticated;
