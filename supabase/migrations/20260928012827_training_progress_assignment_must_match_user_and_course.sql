-- Previously this only checked that the assignment existed, so progress could be linked
-- to another person's assignment (or another course's) and tracking reported it under
-- the wrong learner. Now a link must be an assignment that applies to this user and to
-- this course (a quiz row belongs to the course that contains the quiz). Anything else
-- is re-pointed to the user's own active assignment for that course, or cleared.
CREATE OR REPLACE FUNCTION public.tg_training_progress_valid_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course uuid := NEW.training_id;
  v_ok boolean;
BEGIN
  IF NEW.assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lp_content_type = 'quiz' THEN
    v_course := coalesce(
      (SELECT q.training_module_id FROM public.quizzes q WHERE q.id = NEW.training_id),
      (SELECT l.training_module_id FROM public.lessons l
        WHERE l.content_data->>'quiz_id' = NEW.training_id::text AND NOT coalesce(l.is_deleted, false)
        LIMIT 1),
      NEW.training_id);
  END IF;

  SELECT coalesce(a.content_id, a.training_module_id) = v_course
     AND (   (a.target_type = 'user' AND a.target_id = NEW.user_id::text)
          OR NEW.user_id = ANY (coalesce(a.target_user_ids, '{}'::uuid[]))
          OR (a.target_type IS DISTINCT FROM 'user' AND coalesce(cardinality(a.target_user_ids), 0) = 0))
    INTO v_ok
    FROM public.assignments a
   WHERE a.id = NEW.assignment_id;

  IF coalesce(v_ok, false) THEN
    RETURN NEW;
  END IF;

  NEW.assignment_id := (
    SELECT a.id FROM public.assignments a
     WHERE a.is_active AND NOT coalesce(a.is_deleted, false)
       AND coalesce(a.content_id, a.training_module_id) = v_course
       AND (   (a.target_type = 'user' AND a.target_id = NEW.user_id::text)
            OR NEW.user_id = ANY (coalesce(a.target_user_ids, '{}'::uuid[])))
     ORDER BY a.created_at DESC
     LIMIT 1);
  RETURN NEW;
END;
$function$;

-- Re-run the check on rows linked to another person's user-targeted assignment.
UPDATE public.training_progress tp
   SET assignment_id = tp.assignment_id
  FROM public.assignments a
 WHERE a.id = tp.assignment_id
   AND a.target_type = 'user'
   AND a.target_id <> tp.user_id::text;
