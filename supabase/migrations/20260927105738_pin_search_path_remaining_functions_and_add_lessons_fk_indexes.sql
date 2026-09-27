ALTER FUNCTION public.update_document_search_vector() SET search_path TO 'public';
ALTER FUNCTION public._legacy_platform_fallback(uuid) SET search_path TO 'public';
ALTER FUNCTION public.search_knowledge_articles(text, text, text, uuid, boolean, integer, integer, uuid) SET search_path TO 'public';
ALTER FUNCTION public.secure_search_documents(text, uuid, text, text, uuid, text[], timestamp with time zone, timestamp with time zone, text, boolean, boolean, text, text, integer, integer, uuid) SET search_path TO 'public';
ALTER FUNCTION public.secure_search_users(text, uuid, text, boolean, integer, uuid) SET search_path TO 'public';

CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON public.lessons (created_by);
CREATE INDEX IF NOT EXISTS idx_lessons_source_document_id ON public.lessons (source_document_id);
