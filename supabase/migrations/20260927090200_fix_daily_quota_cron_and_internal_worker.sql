-- Split evaluate_organization_quotas into an internal worker the scheduler can call
-- without requiring signed-in admin credentials, plus the admin-facing function
-- that verifies tenant admin or platform operator permissions before calling it.

CREATE OR REPLACE FUNCTION public._evaluate_organization_quotas_internal(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_billing_period text := to_char(now(), 'YYYY-MM');
  v_plan_max_users integer;
  v_plan_max_storage_gb numeric;
  v_org record;
  v_learners_used integer := 0;
  v_learners_max integer := 0;
  v_learners_pct numeric := 0;
  v_storage_used_bytes bigint := 0;
  v_storage_max_gb numeric := 0;
  v_storage_max_bytes bigint := 0;
  v_storage_pct numeric := 0;
  v_ai_credits_used integer := 0;
  v_ai_credits_max integer := 0;
  v_ai_credits_pct numeric := 0;
  v_warnings_triggered jsonb := '[]'::jsonb;
  v_quota_type text;
  v_pct numeric;
  v_threshold integer;
  v_thresholds integer[] := ARRAY[80, 90, 100];
  v_admin_recipients uuid[];
  v_admin_id uuid;
  v_notif_title text;
  v_notif_msg text;
BEGIN
  SELECT o.id, o.name, o.max_learners, o.max_storage_gb, o.max_ai_credits_monthly, o.ai_credits_used_this_month
  INTO v_org
  FROM public.organizations o
  WHERE o.id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization % not found', p_org_id USING ERRCODE = 'P0002';
  END IF;

  SELECT sp.max_users, sp.max_storage_gb
  INTO v_plan_max_users, v_plan_max_storage_gb
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = p_org_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT count(*)::integer INTO v_learners_used
  FROM public.organization_memberships
  WHERE organization_id = p_org_id AND is_active = true;

  v_learners_max := COALESCE(v_org.max_learners, v_plan_max_users, 50);
  IF v_learners_max > 0 THEN
    v_learners_pct := ROUND((v_learners_used::numeric / v_learners_max::numeric) * 100, 1);
  END IF;

  SELECT COALESCE(sum(file_size), 0)::bigint INTO v_storage_used_bytes
  FROM public.documents
  WHERE organization_id = p_org_id AND NOT COALESCE(is_deleted, false);

  v_storage_max_gb := COALESCE(v_org.max_storage_gb, v_plan_max_storage_gb, 5);
  v_storage_max_bytes := (v_storage_max_gb * 1024 * 1024 * 1024)::bigint;
  IF v_storage_max_bytes > 0 THEN
    v_storage_pct := ROUND((v_storage_used_bytes::numeric / v_storage_max_bytes::numeric) * 100, 1);
  END IF;

  v_ai_credits_used := COALESCE(v_org.ai_credits_used_this_month, 0);
  v_ai_credits_max := COALESCE(v_org.max_ai_credits_monthly, 100);
  IF v_ai_credits_max > 0 THEN
    v_ai_credits_pct := ROUND((v_ai_credits_used::numeric / v_ai_credits_max::numeric) * 100, 1);
  END IF;

  FOREACH v_quota_type IN ARRAY ARRAY['learners', 'storage', 'ai_credits'] LOOP
    v_pct := CASE v_quota_type
      WHEN 'learners' THEN v_learners_pct
      WHEN 'storage' THEN v_storage_pct
      WHEN 'ai_credits' THEN v_ai_credits_pct
      ELSE 0
    END;

    IF v_pct >= 80 THEN
      FOREACH v_threshold IN ARRAY v_thresholds LOOP
        IF v_pct >= v_threshold THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.quota_warning_events
            WHERE organization_id = p_org_id
              AND quota_type = v_quota_type
              AND threshold_percentage = v_threshold
              AND billing_period = v_billing_period
          ) THEN
            INSERT INTO public.quota_warning_events (
              organization_id, quota_type, threshold_percentage,
              current_usage_percentage, billing_period
            ) VALUES (
              p_org_id, v_quota_type, v_threshold, v_pct, v_billing_period
            );

            SELECT array_agg(user_id) INTO v_admin_recipients
            FROM public.organization_memberships
            WHERE organization_id = p_org_id
              AND is_active = true
              AND role IN ('organization_owner', 'organization_admin');

            v_notif_title := 'Quota Warning: ' || v_quota_type || ' at ' || v_threshold || '%';
            v_notif_msg := 'Your organization has reached ' || v_pct || '% of allocated ' || v_quota_type || ' capacity. Upgrade plan to prevent service disruption.';

            IF v_admin_recipients IS NOT NULL AND array_length(v_admin_recipients, 1) > 0 THEN
              FOREACH v_admin_id IN ARRAY v_admin_recipients LOOP
                INSERT INTO public.notifications (
                  user_id, type, title, message, link, is_read, metadata, created_at, updated_at
                ) VALUES (
                  v_admin_id,
                  'quota_warning',
                  v_notif_title,
                  v_notif_msg,
                  '/admin/settings?tab=subscription',
                  false,
                  jsonb_build_object(
                    'organization_id', p_org_id,
                    'quota_type', v_quota_type,
                    'threshold_pct', v_threshold,
                    'current_pct', v_pct,
                    'billing_period', v_billing_period
                  ),
                  now(),
                  now()
                );
              END LOOP;
            END IF;

            v_warnings_triggered := v_warnings_triggered || jsonb_build_object(
              'quota_type', v_quota_type,
              'threshold_pct', v_threshold,
              'current_pct', v_pct,
              'recipients_count', COALESCE(array_length(v_admin_recipients, 1), 0)
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'billing_period', v_billing_period,
    'utilization', jsonb_build_object(
      'hotels', jsonb_build_object('used', 0, 'max', 0, 'pct', 0),
      'learners', jsonb_build_object('used', v_learners_used, 'max', v_learners_max, 'pct', v_learners_pct),
      'storage', jsonb_build_object('used', v_storage_used_bytes, 'max', v_storage_max_bytes, 'pct', v_storage_pct, 'used_gb', ROUND((v_storage_used_bytes::numeric / (1024*1024*1024)::numeric), 2), 'max_gb', v_storage_max_gb),
      'ai_credits', jsonb_build_object('used', v_ai_credits_used, 'max', v_ai_credits_max, 'pct', v_ai_credits_pct)
    ),
    'warnings_triggered', v_warnings_triggered
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._evaluate_organization_quotas_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evaluate_organization_quotas_internal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.evaluate_organization_quotas(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_platform_operator() OR public.is_tenant_admin(p_org_id)) THEN
    RAISE EXCEPTION 'Access Denied: Tenant admin privileges required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public._evaluate_organization_quotas_internal(p_org_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.evaluate_organization_quotas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_organization_quotas(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evaluate-org-quotas-daily') THEN
    PERFORM cron.unschedule('evaluate-org-quotas-daily');
  END IF;
  PERFORM cron.schedule(
    'evaluate-org-quotas-daily',
    '0 7 * * *',
    'SELECT public._evaluate_organization_quotas_internal(id) FROM public.organizations WHERE is_deleted = false AND lifecycle_status NOT IN (''archived'',''suspended'');'
  );
END;
$$;
