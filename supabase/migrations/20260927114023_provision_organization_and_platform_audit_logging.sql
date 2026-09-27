-- Organizations had no INSERT policy, so creating an org from the app failed for
-- everyone. Provisioning now runs server-side, in one transaction, gated on the
-- platform tenant.manage capability.
CREATE OR REPLACE FUNCTION public.provision_organization(
  p_name text,
  p_slug text,
  p_name_ar text DEFAULT NULL,
  p_industry text DEFAULT 'hospitality',
  p_lifecycle_status text DEFAULT 'active',
  p_trial_ends_at timestamptz DEFAULT NULL,
  p_max_learners integer DEFAULT 100,
  p_max_storage_gb integer DEFAULT 50,
  p_max_ai_credits_monthly integer DEFAULT 1000,
  p_billing_email text DEFAULT NULL,
  p_brand_colors jsonb DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_initial_brand_name text DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations;
  v_status public.tenant_lifecycle_status;
BEGIN
  IF NOT (public.is_platform_operator() AND public.platform_operator_can('tenant.manage')) THEN
    RAISE EXCEPTION 'Not authorized to create organizations' USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_name), '') = '' OR coalesce(btrim(p_slug), '') = '' THEN
    RAISE EXCEPTION 'Organization name and slug are required' USING ERRCODE = '22023';
  END IF;

  v_status := coalesce(nullif(btrim(p_lifecycle_status), ''), 'active')::public.tenant_lifecycle_status;

  IF p_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subscription_plans WHERE id = p_plan_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Unknown or inactive subscription plan' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.organizations (
    name, name_ar, slug, industry, is_active, is_deleted, lifecycle_status, trial_ends_at,
    max_learners, max_storage_gb, max_ai_credits_monthly, billing_email, brand_colors
  ) VALUES (
    btrim(p_name),
    nullif(btrim(p_name_ar), ''),
    lower(btrim(p_slug)),
    coalesce(nullif(btrim(p_industry), ''), 'hospitality'),
    v_status <> 'suspended',
    false,
    v_status,
    p_trial_ends_at,
    coalesce(p_max_learners, 100),
    coalesce(p_max_storage_gb, 50),
    coalesce(p_max_ai_credits_monthly, 1000),
    nullif(btrim(p_billing_email), ''),
    coalesce(p_brand_colors, '{"primary":"#0f172a","secondary":"#2563eb","accent":"#d97706"}'::jsonb)
  )
  RETURNING * INTO v_org;

  IF p_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
    VALUES (v_org.id, p_plan_id, CASE WHEN v_status = 'trial' THEN 'trialing' ELSE 'active' END,
            now(), now() + interval '1 year');
  END IF;

  IF coalesce(btrim(p_initial_brand_name), '') <> '' THEN
    INSERT INTO public.brands (organization_id, name, is_active, is_deleted)
    VALUES (v_org.id, btrim(p_initial_brand_name), true, false);
  END IF;

  INSERT INTO public.departments (organization_id, name, name_ar)
  VALUES
    (v_org.id, 'Executive Office',          'المكتب التنفيذي'),
    (v_org.id, 'Front Office & Reception',  'المكاتب الأمامية والاستقبال'),
    (v_org.id, 'Reservations & Revenue',    'الحجوزات وإدارة الإيرادات'),
    (v_org.id, 'Housekeeping & Laundry',    'التدبير المنزلي والمغسلة'),
    (v_org.id, 'Food & Beverage',           'الأغذية والمشروبات'),
    (v_org.id, 'Kitchen & Culinary',        'المطبخ والطهي'),
    (v_org.id, 'Engineering & Maintenance', 'الهندسة والصيانة'),
    (v_org.id, 'Security & Safety',         'الأمن والسلامة'),
    (v_org.id, 'Sales & Marketing',         'المبيعات والتسويق'),
    (v_org.id, 'Finance & Accounting',      'المالية والمحاسبة'),
    (v_org.id, 'Human Resources',           'الموارد البشرية'),
    (v_org.id, 'IT & Technology',           'تقنية المعلومات');

  INSERT INTO public.categories (organization_id, name)
  VALUES (v_org.id, 'Uncategorized');

  INSERT INTO public.certificate_templates (organization_id, name, description, is_default, is_active)
  VALUES (v_org.id, 'Default', 'Default certificate template', true, true);

  INSERT INTO public.platform_audit_logs (actor_id, target_organization_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), v_org.id, 'create_organization', 'organization', v_org.id::text,
          jsonb_build_object('name', v_org.name, 'slug', v_org.slug, 'plan_id', p_plan_id,
                             'lifecycle_status', v_status, 'max_learners', v_org.max_learners));

  RETURN v_org;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.provision_organization(text, text, text, text, text, timestamptz, integer, integer, integer, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text, text, text, text, timestamptz, integer, integer, integer, text, jsonb, uuid, text) TO authenticated;

-- platform_audit_logs only allows SELECT under RLS, so the client-side logger was
-- silently rejected. Actor always comes from auth.uid(), never from the caller.
CREATE OR REPLACE FUNCTION public.log_platform_action(
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_target_org_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'Not authorized to write platform audit logs' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_audit_logs (actor_id, target_organization_id, session_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), p_target_org_id, p_session_id, left(p_action, 200), left(p_resource_type, 200),
          p_resource_id, coalesce(p_metadata, '{}'::jsonb));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_platform_action(text, text, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_platform_action(text, text, text, uuid, uuid, jsonb) TO authenticated;

-- Rebrand leftovers. Existing certificate numbers (PHC-...) are left as issued.
UPDATE public.wizard_definitions
SET description = 'Welcome to Altus Connect. Getting started with your personal workspace, courses, and requests.',
    updated_at = now()
WHERE id = 'learner';

CREATE OR REPLACE FUNCTION public.generate_certificate_number()
 RETURNS character varying
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  prefix VARCHAR(4);
  year_code VARCHAR(2);
  seq_num INTEGER;
  cert_number VARCHAR(20);
BEGIN
  prefix := 'ALT-';
  year_code := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(certificate_number FROM 8 FOR 6) AS INTEGER)), 0) + 1
  INTO seq_num
  FROM certificates
  WHERE certificate_number LIKE prefix || year_code || '-%';

  cert_number := prefix || year_code || '-' || LPAD(seq_num::TEXT, 6, '0');
  RETURN cert_number;
END;
$function$;
