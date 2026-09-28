CREATE FUNCTION pg_temp.fix_untitled(p_text text, p_arabic boolean) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(p_text, 'builder\.untitled ([0-9]+) - Quiz',
             CASE WHEN p_arabic THEN 'القسم \1 - اختبار' ELSE 'Section \1 - Quiz' END, 'g'),
           'builder\.untitled ([0-9]+)',
           CASE WHEN p_arabic THEN 'القسم \1' ELSE 'Section \1' END, 'g')
$$;

UPDATE public.lessons l
   SET content = pg_temp.fix_untitled(l.content,
         coalesce((SELECT c.title ~ '[؀-ۿ]' FROM public.courses c WHERE c.id = l.training_module_id), true))
 WHERE l.content LIKE '%builder.untitled%';
