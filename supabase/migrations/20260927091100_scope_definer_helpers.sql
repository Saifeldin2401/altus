-- SECURITY DEFINER review (163 callable functions, 2026-09-27).
-- All pin search_path. The analytics RPCs are scoped by learning_manager_org_ids();
-- the AI config RPCs expose no secrets. Three functions trusted their arguments:
--
-- 1. get_setting(p_org_id, key) returned any organization's settings override to
--    any signed-in member. Tenant overrides now require org_visible(p_org_id);
--    platform-wide defaults stay readable.
-- 2/3. increment_article_view_count / increment_document_download_count let any
--    member bump the counters of any organization's document. They now only
--    count documents the caller can see (own organization or Altus master).

CREATE OR REPLACE FUNCTION public.get_setting(p_org_id uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_val jsonb;
BEGIN
  IF p_org_id IS NOT NULL AND public.org_visible(p_org_id) THEN
    SELECT value INTO v_val FROM public.system_settings WHERE organization_id = p_org_id AND key = p_key;
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;
  SELECT value INTO v_val FROM public.system_settings WHERE organization_id IS NULL AND key = p_key;
  RETURN v_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_article_view_count(doc_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.documents
     SET view_count = COALESCE(view_count, 0) + 1
   WHERE id = doc_id
     AND auth.uid() IS NOT NULL
     AND (is_master_template OR public.org_visible(organization_id));
$$;

CREATE OR REPLACE FUNCTION public.increment_document_download_count(p_document_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.documents
     SET download_count = COALESCE(download_count, 0) + 1,
         last_downloaded_at = now()
   WHERE id = p_document_id
     AND auth.uid() IS NOT NULL
     AND (is_master_template OR public.org_visible(organization_id));
$$;
