-- Functions recreated in the hotel-removal / directory migrations picked up
-- Supabase's default EXECUTE grant for anon. None is meant for signed-out use.
-- (Applied live 2026-09-27.)
REVOKE EXECUTE ON FUNCTION public.can_manage_learning_assignment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_expiring_certificates(integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_platform_user_directory(text, uuid, text, integer, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_risk_queue(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_skills_matrix(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_training_analytics_summary(timestamptz, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_training_completion_trend(integer, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_training_module_performance(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_learning_assignment(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expiring_certificates(integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_user_directory(text, uuid, text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_risk_queue(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_skills_matrix(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_training_analytics_summary(timestamptz, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_training_completion_trend(integer, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_training_module_performance(uuid, integer) TO authenticated, service_role;
