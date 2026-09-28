-- The course builder saved sections with the untranslated key "builder.untitled", so
-- sections and their quizzes were named "builder.untitled N" / "builder.untitled N - Quiz".
-- Replace them with the names the builder now produces, in each course's language.
CREATE FUNCTION pg_temp.fix_untitled(p_text text, p_arabic boolean) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(p_text, 'builder\.untitled ([0-9]+) - Quiz',
             CASE WHEN p_arabic THEN 'القسم \1 - اختبار' ELSE 'Section \1 - Quiz' END, 'g'),
           'builder\.untitled ([0-9]+)',
           CASE WHEN p_arabic THEN 'القسم \1' ELSE 'Section \1' END, 'g')
$$;

CREATE FUNCTION pg_temp.course_is_arabic(p_course_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT title ~ '[؀-ۿ]' FROM public.courses WHERE id = p_course_id), true)
$$;

UPDATE public.lessons l
   SET title = pg_temp.fix_untitled(l.title, pg_temp.course_is_arabic(l.training_module_id)),
       content_data = pg_temp.fix_untitled(l.content_data::text, pg_temp.course_is_arabic(l.training_module_id))::jsonb
 WHERE l.title LIKE '%builder.untitled%' OR l.content_data::text LIKE '%builder.untitled%';

UPDATE public.quizzes q
   SET title = pg_temp.fix_untitled(q.title, pg_temp.course_is_arabic(coalesce(
         q.training_module_id,
         (SELECT l.training_module_id FROM public.lessons l WHERE l.content_data->>'quiz_id' = q.id::text LIMIT 1))))
 WHERE q.title LIKE '%builder.untitled%';

UPDATE public.course_versions v
   SET snapshot = pg_temp.fix_untitled(v.snapshot::text, pg_temp.course_is_arabic(v.training_module_id))::jsonb
 WHERE v.snapshot::text LIKE '%builder.untitled%';

-- Learners' quiz history stores the quiz title in metadata.
SELECT set_config('app.trusted_progress_write', 'on', true);
UPDATE public.training_progress tp
   SET metadata = pg_temp.fix_untitled(tp.metadata::text, pg_temp.course_is_arabic(coalesce(
         (SELECT q.training_module_id FROM public.quizzes q WHERE q.id = tp.training_id),
         tp.training_id)))::jsonb
 WHERE tp.metadata::text LIKE '%builder.untitled%';
SELECT set_config('app.trusted_progress_write', 'off', true);
