-- Mandatory retraining after a master-course sync must reset every enrolled
-- learner. The client cannot do it: training_progress completion fields are
-- write-protected (enforce_training_progress_integrity), and RLS hides other
-- learners' rows from platform operators, so the old direct UPDATE reset 0
-- rows while the audit log recorded retraining as triggered.
--
-- This wrapper enumerates enrolled learners server-side and delegates to
-- reset_training_progress(), which keeps its own caller-authority checks
-- (platform super admin, or a content editor of the module's organization).
-- auth.uid() is unchanged inside a SECURITY DEFINER call, so those checks
-- still evaluate against the real caller.

CREATE OR REPLACE FUNCTION public.reset_training_progress_for_module(p_training_module_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT tp.user_id
      FROM public.training_progress tp
     WHERE tp.training_id = p_training_module_id
  LOOP
    PERFORM public.reset_training_progress(p_training_module_id, v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_training_progress_for_module(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_training_progress_for_module(uuid) TO authenticated, service_role;
