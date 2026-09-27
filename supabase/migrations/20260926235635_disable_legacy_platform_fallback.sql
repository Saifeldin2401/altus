-- Migration: 20260927090600_disable_legacy_platform_fallback.sql
-- Permanently disables legacy fallback that could escalate tenant administrators to platform operators.
-- Platform operator authority is strictly determined by public.platform_users and public.platform_role_assignments.

-- 1. Ensure platform_config fallback is permanently disabled
UPDATE public.platform_config
SET legacy_role_fallback_enabled = false
WHERE id;

-- 2. Make _legacy_platform_fallback return false unconditionally
CREATE OR REPLACE FUNCTION public._legacy_platform_fallback(_user_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT false;
$$;

-- 3. Redefine is_platform_admin to rely strictly on verified platform_operator roles
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.platform_operator_has_role('platform_admin', _user_id);
$$;

-- 4. Redefine is_platform_super_admin to check verified platform operators only
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_operator(auth.uid());
$$;

-- 5. Redefine is_platform_user to check verified platform operators only
CREATE OR REPLACE FUNCTION public.is_platform_user(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_operator(target_user_id);
$$;

COMMENT ON FUNCTION public._legacy_platform_fallback IS 'Deprecated and hard-disabled: always returns false to prevent privilege escalation.';
COMMENT ON FUNCTION public.is_platform_admin IS 'Checks if user is an active platform operator with platform_admin role. Never trusts legacy user_roles view.';
