-- Colleague PII lockdown.
--
-- profiles RLS lets any member read every row of anyone they share an active
-- organization with, and RLS cannot hide columns. So a colleague could read
-- national ID, iqama number, salary grade, date of birth, blood group and
-- emergency contacts straight from the API (colleague_profiles_v hid them in
-- the directory, but the base table still served them).
--
-- Fix: column-level privileges. The sensitive columns are no longer
-- selectable by API roles; get_profiles_private() returns them only to the
-- person themselves, an owner/admin of a shared organization
-- (has_profile_access - the same rule that gates editing a profile), or a
-- platform super admin. UPDATE privileges are unchanged (profiles_update RLS).

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, email, full_name, avatar_url, hire_date, is_active, created_at, updated_at,
  job_title, reporting_to, is_deleted, is_temp_password, password_initialized,
  password_last_changed_at, staff_id, suspended_until, account_status, suspended_at,
  suspended_by, last_login_at, force_password_reset, employment_type, bio,
  phone_extension, failed_login_attempts, locked_until, mfa_required, language,
  organization_id, show_on_leaderboard, learner_welcome_seen_at
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profiles_private(p_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  phone text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  nationality text,
  blood_group text,
  iqama_number text,
  iqama_expiry date,
  national_id text,
  salary_grade text,
  contract_end_date date,
  suspend_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.phone, p.date_of_birth, p.emergency_contact_name, p.emergency_contact_phone,
         p.nationality, p.blood_group, p.iqama_number, p.iqama_expiry, p.national_id,
         p.salary_grade, p.contract_end_date, p.suspend_reason
    FROM public.profiles p
   WHERE p.id = ANY (p_user_ids)
     AND auth.uid() IS NOT NULL
     AND (public.has_profile_access(auth.uid(), p.id) OR public.is_platform_super_admin());
$$;

REVOKE ALL ON FUNCTION public.get_profiles_private(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_private(uuid[]) TO authenticated, service_role;

-- secure_search_users runs as the caller and returned every matching
-- colleague's personal phone. With the column locked it would also fail, so
-- it now returns NULL for phone (signature unchanged for existing callers;
-- phone_extension remains available via profiles/colleague_profiles_v).
CREATE OR REPLACE FUNCTION public.secure_search_users(p_search_query text, p_department_id uuid DEFAULT NULL::uuid, p_role text DEFAULT NULL::text, p_is_active boolean DEFAULT true, p_limit integer DEFAULT 50, p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, email text, full_name text, phone text, job_title text, staff_id text, avatar_url text, is_active boolean, hire_date date, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_platform BOOLEAN;
    v_user_org_ids UUID[];
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    v_is_platform := public.is_platform_super_admin();
    v_user_org_ids := public.current_user_organization_ids();

    RETURN QUERY
    SELECT DISTINCT
        p.id, p.email, p.full_name, NULL::text AS phone, p.job_title, p.staff_id, p.avatar_url,
        p.is_active, p.hire_date, p.created_at
    FROM public.profiles p
    JOIN public.organization_memberships om ON om.user_id = p.id AND om.is_active = true
    WHERE
        (p_search_query IS NULL OR p_search_query = '' OR
            (p.full_name ILIKE '%' || p_search_query || '%' OR
             p.email ILIKE '%' || p_search_query || '%' OR
             p.job_title ILIKE '%' || p_search_query || '%' OR
             p.staff_id ILIKE '%' || p_search_query || '%'))
        AND (p_is_active IS NULL OR p.is_active = p_is_active)
        AND (p_department_id IS NULL OR om.department_id = p_department_id)
        AND (
            p_role IS NULL
            OR p_role = 'all'
            OR om.role::text = p_role
            OR (p_role = 'administrator' AND om.role::text IN ('organization_owner', 'organization_admin', 'brand_admin'))
            OR (p_role = 'author' AND om.role::text IN ('author', 'instructor', 'department_manager'))
            OR (p_role = 'learner' AND om.role::text = 'learner')
            OR (p_role = 'manager' AND om.role::text IN ('training_manager', 'knowledge_manager', 'department_manager'))
        )
        AND (
            (p_organization_id IS NOT NULL AND om.organization_id = p_organization_id AND (
                v_is_platform OR p_organization_id = ANY(v_user_org_ids)
            ))
            OR (p_organization_id IS NULL AND (
                v_is_platform
                OR p.id = v_user_id
                OR (
                    om.organization_id = ANY(v_user_org_ids)
                    AND public.org_is_operational(om.organization_id)
                )
            ))
        )
    ORDER BY p.full_name ASC NULLS LAST
    LIMIT LEAST(p_limit, 200);
END;
$function$;
