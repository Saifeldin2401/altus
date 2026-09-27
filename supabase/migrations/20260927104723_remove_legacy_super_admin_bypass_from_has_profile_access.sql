CREATE OR REPLACE FUNCTION public.has_profile_access(_admin_id uuid, _target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    _admin_id = _target_user_id
    OR public.is_platform_operator(_admin_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships ma
      JOIN public.organization_memberships mt ON mt.organization_id = ma.organization_id
      WHERE ma.user_id = _admin_id AND mt.user_id = _target_user_id
        AND ma.is_active = true AND mt.is_active = true
        AND ma.role IN ('organization_owner','organization_admin')
    );
$function$;
