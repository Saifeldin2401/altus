-- Migration: Fix certificate issuance trigger and guarantee tenant integrity & idempotency

CREATE OR REPLACE FUNCTION public.issue_training_certificate_from_training_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_module_title text;
    v_certificate_enabled boolean := false;
    v_passing_score integer := 80;
    v_validity_days integer;
    v_department_id uuid;
    v_organization_id uuid;
    v_recipient_name text;
    v_recipient_email text;
BEGIN
    IF COALESCE(NEW.is_deleted, false)
       OR NEW.status <> 'completed'
       OR NEW.completed_at IS NULL
       OR NEW.passed IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- Retrieve module metadata and organization_id
    SELECT title, certificate_enabled, COALESCE(passing_score_percentage, 80),
           validity_period_days, department_id, organization_id
      INTO v_module_title, v_certificate_enabled, v_passing_score,
           v_validity_days, v_department_id, v_organization_id
      FROM public.courses
     WHERE id = NEW.training_id;

    IF NOT COALESCE(v_certificate_enabled, false) THEN
        RETURN NEW;
    END IF;

    -- Resolve effective organization_id
    v_organization_id := COALESCE(NEW.organization_id, v_organization_id);
    IF v_organization_id IS NULL THEN
        SELECT organization_id INTO v_organization_id
          FROM public.organization_memberships
         WHERE user_id = NEW.user_id AND is_active = true
         LIMIT 1;
    END IF;

    IF v_organization_id IS NULL THEN
        -- Cannot issue certificate without tenant context
        RETURN NEW;
    END IF;

    -- Check idempotency: avoid duplicate active certificates for this user and module
    IF EXISTS (
        SELECT 1
          FROM public.certificates c
         WHERE c.user_id = NEW.user_id
           AND c.training_module_id = NEW.training_id
           AND c.certificate_type = 'training'
           AND c.status = 'active'
    ) THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.certificates c
         WHERE c.training_progress_id = NEW.id
           AND c.certificate_type = 'training'
           AND c.status = 'active'
    ) THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(full_name, email, 'Training Participant'), email
      INTO v_recipient_name, v_recipient_email
      FROM public.profiles
     WHERE id = NEW.user_id;

    BEGIN
        INSERT INTO public.certificates (
            organization_id,
            user_id, recipient_name, recipient_email, certificate_type,
            certificate_number, verification_code, training_module_id,
            training_progress_id, title, description, completion_date,
            expiry_date, department_id,
            score, passing_score, status, metadata
        ) VALUES (
            v_organization_id,
            NEW.user_id,
            COALESCE(v_recipient_name, 'Training Participant'),
            v_recipient_email,
            'training',
            public.generate_certificate_number(),
            public.generate_verification_code(),
            NEW.training_id,
            NEW.id,
            v_module_title,
            'Congratulations! You''ve earned a certificate for completing ' || v_module_title || '.',
            NEW.completed_at,
            CASE WHEN v_validity_days > 0 THEN NEW.completed_at + make_interval(days => v_validity_days) END,
            v_department_id,
            round(COALESCE(NEW.score_percentage, NEW.quiz_score))::integer,
            v_passing_score,
            'active',
            jsonb_build_object(
                'issued_by', 'training_progress_completion_trigger',
                'source', 'server_side_module_completion',
                'cycle_started_at', NEW.cycle_started_at
            )
        );
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    RETURN NEW;
END;
$function$;

-- Create unique partial index to enforce exactly one active training certificate per user per course
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_unique_active_user_module
ON public.certificates (user_id, training_module_id)
WHERE certificate_type = 'training' AND status = 'active' AND training_module_id IS NOT NULL;
