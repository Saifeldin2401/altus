-- Launch readiness medium-priority fixes:
-- 1. Drop redundant / duplicate indexes
-- 2. Drop empty legacy buckets (payslips, resumes, referral-cvs)
-- 3. Create colleague_profiles_v view for safe directory access without exposing sensitive PII

-- 1. Duplicate & redundant indexes
DROP INDEX IF EXISTS public.idx_org_membership_unique;
DROP INDEX IF EXISTS public.idx_training_block_progress_block_id;
DROP INDEX IF EXISTS public.idx_mfa_secrets_user_id;
DROP INDEX IF EXISTS public.idx_push_subscriptions_user_id;
DROP INDEX IF EXISTS public.idx_notification_preferences_user_id;
DROP INDEX IF EXISTS public.idx_user_settings_user_id;
DROP INDEX IF EXISTS public.idx_subscriptions_organization_id;
DROP INDEX IF EXISTS public.idx_documents_document_number;
DROP INDEX IF EXISTS public.idx_learning_quizzes_training;

-- 2. Remove empty legacy buckets
DO $$
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.buckets WHERE id IN ('payslips', 'resumes', 'referral-cvs');
END $$;

-- 3. Colleague directory view (omits personal phone, DoB, National ID, Iqama, salary grade, emergency contacts)
CREATE OR REPLACE VIEW public.colleague_profiles_v
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.organization_id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.job_title,
  p.phone_extension,
  p.bio,
  p.is_active,
  p.reporting_to
FROM public.profiles p;

COMMENT ON VIEW public.colleague_profiles_v IS 'Sanitized directory view of colleague profiles omitting personal PII (DoB, personal phone, emergency contacts, national ID/Iqama, salary).';

REVOKE ALL ON TABLE public.colleague_profiles_v FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.colleague_profiles_v TO authenticated, service_role;
