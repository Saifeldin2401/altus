-- Migration: 20260927090400_enforce_server_only_training_completion.sql
-- Enforce server-only completion of training records:
-- 1. Tighten enforce_training_progress_integrity trigger to reject direct writes to status='completed',
--    progress_percentage >= 100, completed_at, passed, score_percentage, or quiz_score.
-- 2. Extend complete_training_module to persist any session completed_block_ids to lesson_progress.
-- 3. Add reset_training_progress RPC for authorized managers and learners to reset cycles.

-- 1. Integrity trigger
CREATE OR REPLACE FUNCTION public.enforce_training_progress_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trusted writes originate only from server RPCs (complete_training_module, submit_quiz_attempt, _reset_training_cycle, reset_training_progress)
  IF current_setting('app.trusted_progress_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed'
       OR NEW.completed_at IS NOT NULL
       OR NEW.passed IS NOT NULL
       OR NEW.score_percentage IS NOT NULL
       OR NEW.quiz_score IS NOT NULL
       OR COALESCE(NEW.progress_percentage, 0) >= 100
    THEN
      RAISE EXCEPTION 'Direct insertion of completed training records is not permitted. Complete the module through complete_training_module() RPC instead.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Reject untrusted attempts to mark completed or advance progress to 100%
    IF (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
       OR (NEW.completed_at IS DISTINCT FROM OLD.completed_at AND NEW.completed_at IS NOT NULL)
       OR (NEW.passed IS DISTINCT FROM OLD.passed AND NEW.passed IS NOT NULL)
       OR (NEW.score_percentage IS DISTINCT FROM OLD.score_percentage AND NEW.score_percentage IS NOT NULL)
       OR (NEW.quiz_score IS DISTINCT FROM OLD.quiz_score AND NEW.quiz_score IS NOT NULL)
       OR (COALESCE(NEW.progress_percentage, 0) >= 100 AND COALESCE(OLD.progress_percentage, 0) < 100)
    THEN
      RAISE EXCEPTION 'Direct modification of training completion fields is not permitted. Complete the module through complete_training_module() RPC instead.'
        USING ERRCODE = '42501';
    END IF;

    -- Reject untrusted attempts to demote or tamper with completed state
    IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Cannot demote completed training records directly.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'Cannot modify completion date of training records directly.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.passed IS NOT NULL AND NEW.passed IS DISTINCT FROM OLD.passed THEN
      RAISE EXCEPTION 'Cannot modify pass status of training records directly.'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.score_percentage IS NOT NULL AND NEW.score_percentage IS DISTINCT FROM OLD.score_percentage THEN
      RAISE EXCEPTION 'Cannot modify score of training records directly.'
        USING ERRCODE = '42501';
    END IF;

    -- Protect cycle tracking from direct write
    NEW.cycle_started_at := OLD.cycle_started_at;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS trg_enforce_training_progress_integrity ON public.training_progress;
CREATE TRIGGER trg_enforce_training_progress_integrity
  BEFORE INSERT OR UPDATE ON public.training_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_training_progress_integrity();

-- 2. Extend complete_training_module
CREATE OR REPLACE FUNCTION public.complete_training_module(
  p_module_id uuid,
  p_assignment_id uuid DEFAULT NULL::uuid,
  p_completed_block_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_last_block_id uuid DEFAULT NULL::uuid,
  p_last_block_index integer DEFAULT 0,
  p_time_spent_seconds integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_module public.courses%ROWTYPE;
  v_block record;
  v_quiz_id uuid;
  v_quiz_title text;
  v_require_pass boolean;
  v_require_approval boolean;
  v_session record;
  v_quiz_progress public.training_progress%ROWTYPE;
  v_assignment_sub record;
  v_found boolean;
  v_block_score numeric;
  v_score_sum numeric := 0;
  v_score_n integer := 0;
  v_gate_sum numeric := 0;
  v_gate_n integer := 0;
  v_final_score numeric;
  v_gate_score numeric;
  v_passing_score numeric;
  v_existing public.training_progress%ROWTYPE;
  v_cycle_start timestamptz;
  v_metadata jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_module FROM public.courses WHERE id = p_module_id AND is_deleted = false;
  IF NOT FOUND OR NOT (public.org_visible(v_module.organization_id) OR public.is_platform_super_admin()) THEN
    RAISE EXCEPTION 'Training module not found';
  END IF;

  SELECT * INTO v_existing FROM public.training_progress
   WHERE user_id = v_user_id AND training_id = p_module_id;
  v_cycle_start := COALESCE(v_existing.cycle_started_at, '-infinity'::timestamptz);

  -- Backfill session completed block IDs to lesson_progress if supplied
  IF p_completed_block_ids IS NOT NULL AND array_length(p_completed_block_ids, 1) > 0 THEN
    INSERT INTO public.lesson_progress (
      user_id, training_module_id, block_id, completed_at, last_viewed_at
    )
    SELECT v_user_id, p_module_id, b_id, now(), now()
      FROM unnest(p_completed_block_ids) AS b_id
    ON CONFLICT (user_id, block_id) DO UPDATE SET
      completed_at = COALESCE(public.lesson_progress.completed_at, EXCLUDED.completed_at),
      last_viewed_at = EXCLUDED.last_viewed_at;
  END IF;

  FOR v_block IN
    SELECT id, type, title, content_data, is_mandatory
      FROM public.training_content_blocks_v
     WHERE training_module_id = p_module_id AND is_deleted = false
  LOOP
    v_block_score := NULL;

    -- 1. Quiz blocks
    IF v_block.type = 'quiz' THEN
      v_quiz_id := public._safe_uuid(v_block.content_data ->> 'quiz_id');
      IF v_quiz_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT title INTO v_quiz_title FROM public.quizzes WHERE id = v_quiz_id;
      v_quiz_title := COALESCE(v_block.content_data ->> 'title', v_block.title, v_quiz_title, 'Knowledge Check');

      v_require_pass := COALESCE(v_block.content_data ->> 'completion_requirement', '') <> 'submitted'
        AND COALESCE((v_block.content_data ->> 'require_passing')::boolean, true);

      SELECT * INTO v_session
        FROM public.unified_quiz_sessions
       WHERE user_id = v_user_id
         AND quiz_type = 'learning_quiz'
         AND quiz_entity_id = v_quiz_id
         AND completed_at IS NOT NULL
         AND archived_at IS NULL
       ORDER BY passed DESC NULLS LAST, score_percentage DESC NULLS LAST, completed_at DESC
       LIMIT 1;
      v_found := FOUND;

      IF v_found THEN
        v_block_score := v_session.score_percentage;
        IF v_require_pass AND v_session.passed IS NOT TRUE AND v_block.is_mandatory IS NOT FALSE THEN
          RAISE EXCEPTION 'Quiz "%" has not been passed yet', v_quiz_title;
        END IF;
      ELSE
        SELECT * INTO v_quiz_progress
          FROM public.training_progress
         WHERE user_id = v_user_id
           AND training_id = v_quiz_id
           AND lp_content_type = 'quiz'
           AND status = 'completed'
           AND completed_at >= v_cycle_start;
        IF FOUND THEN
          v_found := true;
          v_block_score := v_quiz_progress.score_percentage;
          IF v_require_pass AND v_quiz_progress.passed IS NOT TRUE AND v_block.is_mandatory IS NOT FALSE THEN
            RAISE EXCEPTION 'Quiz "%" has not been passed yet', v_quiz_title;
          END IF;
        END IF;
      END IF;

      IF NOT v_found AND v_block.is_mandatory IS NOT FALSE THEN
        RAISE EXCEPTION 'Quiz "%" has not been submitted yet', v_quiz_title;
      END IF;

      IF v_block_score IS NOT NULL THEN
        v_score_sum := v_score_sum + v_block_score;
        v_score_n := v_score_n + 1;
        IF v_block.is_mandatory IS NOT FALSE AND v_require_pass THEN
          v_gate_sum := v_gate_sum + v_block_score;
          v_gate_n := v_gate_n + 1;
        END IF;
      END IF;

    -- 2. Assignment / practical blocks
    ELSIF v_block.type = 'assignment' OR v_block.type = 'practical'
          OR COALESCE((v_block.content_data ->> 'is_assignment')::boolean, false)
          OR COALESCE((v_block.content_data ->> 'requires_submission')::boolean, false) THEN

      v_require_approval := COALESCE((v_block.content_data ->> 'requires_instructor_approval')::boolean, true);

      SELECT * INTO v_assignment_sub
        FROM public.training_assignment_submissions
       WHERE user_id = v_user_id
         AND training_module_id = p_module_id
         AND block_id = v_block.id::text
         AND is_deleted = false
         AND created_at >= v_cycle_start
       ORDER BY attempt_number DESC, created_at DESC
       LIMIT 1;
      v_found := FOUND;

      IF v_block.is_mandatory IS NOT FALSE THEN
        IF NOT v_found OR v_assignment_sub.status = 'draft' THEN
          RAISE EXCEPTION 'Assignment "%" has not been submitted yet', COALESCE(v_block.title, 'Assignment');
        END IF;

        IF v_require_approval THEN
          IF v_assignment_sub.status IN ('submitted', 'under_review') THEN
            RAISE EXCEPTION 'Assignment "%" is awaiting instructor review', COALESCE(v_block.title, 'Assignment');
          ELSIF v_assignment_sub.status IN ('revision_required', 'rejected') THEN
            RAISE EXCEPTION 'Assignment "%" requires revisions before module completion', COALESCE(v_block.title, 'Assignment');
          ELSIF v_assignment_sub.status <> 'approved' THEN
            RAISE EXCEPTION 'Assignment "%" has not been approved yet', COALESCE(v_block.title, 'Assignment');
          END IF;
        END IF;
      END IF;

      IF v_found AND v_assignment_sub.score IS NOT NULL THEN
        v_score_sum := v_score_sum + v_assignment_sub.score;
        v_score_n := v_score_n + 1;
      END IF;

    -- 3. Standard content blocks
    ELSIF v_block.is_mandatory IS NOT FALSE THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.lesson_progress tbp
         WHERE tbp.user_id = v_user_id
           AND tbp.block_id = v_block.id
           AND tbp.completed_at IS NOT NULL
           AND tbp.completed_at >= v_cycle_start
      ) THEN
        RAISE EXCEPTION 'Required content "%" has not been completed yet', COALESCE(v_block.content_data ->> 'title', v_block.title, 'required content');
      END IF;
    END IF;
  END LOOP;

  v_final_score := CASE WHEN v_score_n > 0 THEN round(v_score_sum / v_score_n) ELSE NULL END;
  v_gate_score := CASE WHEN v_gate_n > 0 THEN round(v_gate_sum / v_gate_n) ELSE NULL END;
  v_passing_score := COALESCE(v_module.passing_score_percentage, 80);

  IF v_gate_score IS NOT NULL AND v_gate_score < v_passing_score THEN
    RAISE EXCEPTION 'Module passing score not met (% of % required) - retake the quizzes to improve your score',
      v_gate_score || '%', v_passing_score || '%';
  END IF;

  v_metadata := COALESCE(v_existing.metadata, '{}'::jsonb) || jsonb_build_object(
    'completed_blocks', to_jsonb(COALESCE(p_completed_block_ids, ARRAY[]::uuid[])),
    'active_block_id', p_last_block_id
  );

  PERFORM set_config('app.trusted_progress_write', 'on', true);

  INSERT INTO public.training_progress (
    user_id, training_id, lp_content_type, assignment_id, status,
    progress_percentage, score_percentage, quiz_score, passed, completed_at,
    last_accessed_at, last_activity_at, last_block_id, last_block_index,
    time_spent_seconds, metadata, updated_at
  ) VALUES (
    v_user_id, p_module_id, 'module', p_assignment_id, 'completed',
    100, v_final_score, round(v_final_score)::integer, true, now(),
    now(), now(), p_last_block_id, p_last_block_index,
    p_time_spent_seconds, v_metadata, now()
  )
  ON CONFLICT (user_id, training_id) DO UPDATE SET
    lp_content_type = 'module',
    assignment_id = COALESCE(public.training_progress.assignment_id, EXCLUDED.assignment_id),
    status = 'completed',
    progress_percentage = 100,
    score_percentage = COALESCE(EXCLUDED.score_percentage, public.training_progress.score_percentage),
    quiz_score = COALESCE(EXCLUDED.quiz_score, public.training_progress.quiz_score),
    passed = true,
    completed_at = COALESCE(public.training_progress.completed_at, EXCLUDED.completed_at),
    last_accessed_at = EXCLUDED.last_accessed_at,
    last_activity_at = EXCLUDED.last_activity_at,
    last_block_id = EXCLUDED.last_block_id,
    last_block_index = EXCLUDED.last_block_index,
    time_spent_seconds = GREATEST(COALESCE(public.training_progress.time_spent_seconds, 0), COALESCE(EXCLUDED.time_spent_seconds, 0)),
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_existing;

  PERFORM set_config('app.trusted_progress_write', 'off', true);

  RETURN jsonb_build_object(
    'training_progress_id', v_existing.id,
    'score_percentage', v_existing.score_percentage,
    'passed', v_existing.passed,
    'status', v_existing.status,
    'completed_at', v_existing.completed_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_training_module(uuid, uuid, uuid[], uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_training_module(uuid, uuid, uuid[], uuid, integer, integer) TO authenticated, service_role;

-- 3. Reset progress RPC
CREATE OR REPLACE FUNCTION public.reset_training_progress(
  p_training_module_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_module public.courses%ROWTYPE;
  v_tp public.training_progress%ROWTYPE;
  v_block_ids uuid[];
  v_quiz_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_module FROM public.courses WHERE id = p_training_module_id AND is_deleted = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training module not found';
  END IF;

  -- Caller must be self OR platform super admin OR tenant editor/manager
  IF NOT (
    v_caller = p_user_id
    OR public.is_platform_super_admin()
    OR (
      public.org_visible(v_module.organization_id)
      AND (
        public.is_tenant_content_editor(v_module.organization_id)
        OR public.can_manage_learning_assignment(v_module.organization_id)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to reset progress for this training';
  END IF;

  SELECT * INTO v_tp FROM public.training_progress
   WHERE user_id = p_user_id AND training_id = p_training_module_id
   FOR UPDATE;

  SELECT array_agg(b.id),
         array_agg(public._safe_uuid(b.content_data ->> 'quiz_id')) FILTER (WHERE b.type = 'quiz')
    INTO v_block_ids, v_quiz_ids
    FROM public.training_content_blocks_v b
   WHERE b.training_module_id = p_training_module_id;

  DELETE FROM public.lesson_progress
   WHERE user_id = p_user_id
     AND (training_module_id = p_training_module_id OR block_id = ANY (COALESCE(v_block_ids, '{}')));

  UPDATE public.unified_quiz_sessions
     SET archived_at = now()
   WHERE user_id = p_user_id
     AND quiz_entity_id = ANY (COALESCE(v_quiz_ids, '{}'))
     AND archived_at IS NULL;

  PERFORM set_config('app.trusted_progress_write', 'on', true);

  IF v_tp.id IS NOT NULL THEN
    UPDATE public.training_progress
       SET status = 'not_started',
           progress_percentage = 0,
           score_percentage = NULL,
           quiz_score = NULL,
           passed = NULL,
           completed_at = NULL,
           last_block_id = NULL,
           last_block_index = NULL,
           cycle_started_at = now(),
           metadata = '{}'::jsonb,
           updated_at = now()
     WHERE id = v_tp.id;
  END IF;

  UPDATE public.training_progress
     SET status = 'not_started',
         progress_percentage = 0,
         score_percentage = NULL,
         quiz_score = NULL,
         passed = NULL,
         completed_at = NULL,
         cycle_started_at = now(),
         metadata = '{}'::jsonb,
         updated_at = now()
   WHERE user_id = p_user_id
     AND lp_content_type = 'quiz'
     AND training_id = ANY (COALESCE(v_quiz_ids, '{}'));

  PERFORM set_config('app.trusted_progress_write', 'off', true);

  RETURN jsonb_build_object('success', true, 'training_id', p_training_module_id, 'user_id', p_user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_training_progress(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_training_progress(uuid, uuid) TO authenticated, service_role;
