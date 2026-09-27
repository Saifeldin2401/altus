-- The remove_hotels migration recreated these views without security_invoker,
-- so they ran with the owner's rights and bypassed RLS: anon could read every
-- tenant's articles and SOPs through the API. Restore invoker semantics and
-- drop anon access. (Applied live 2026-09-27.)
ALTER VIEW public.activity_log_v SET (security_invoker = true);
ALTER VIEW public.documents_article_v SET (security_invoker = true);
ALTER VIEW public.documents_sop_v SET (security_invoker = true);
ALTER VIEW public.sop_documents_v SET (security_invoker = true);
REVOKE ALL ON public.activity_log_v, public.documents_article_v, public.documents_sop_v, public.sop_documents_v FROM anon;
