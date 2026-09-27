-- Migration: 20260927090700_tenant_scoped_search_and_arabic_fts.sql
-- 1. Updates update_document_search_vector to index Arabic fields (title_ar, description_ar, content_ar)
-- 2. Updates search_knowledge_articles to accept p_organization_id and support Arabic + English search
-- 3. Updates secure_search_documents to accept p_organization_id and enforce strict tenant isolation
-- 4. Updates secure_search_users to accept p_organization_id and support modern platform roles

-- 1. Arabic & English bilingual search vector trigger function
CREATE OR REPLACE FUNCTION public.update_document_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_tag_names TEXT;
    v_folder_name TEXT;
BEGIN
    SELECT string_agg(dt.name, ' ')
    INTO v_tag_names
    FROM public.document_tag_assignments dta
    JOIN public.document_tags dt ON dta.tag_id = dt.id
    WHERE dta.document_id = NEW.id;

    SELECT name
    INTO v_folder_name
    FROM public.document_folders
    WHERE id = NEW.folder_id;

    -- Combine English stemming and Simple/Arabic tokenization for bilingual search coverage
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.title_ar, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(v_tag_names, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(v_folder_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description_ar, '')), 'C') ||
        setweight(to_tsvector('english', left(COALESCE(NEW.content, ''), 200000)), 'D') ||
        setweight(to_tsvector('simple', left(COALESCE(NEW.content_ar, ''), 200000)), 'D') ||
        setweight(to_tsvector('english', COALESCE(NEW.document_number, '')), 'D');

    RETURN NEW;
END;
$$;

-- 2. Knowledge Articles Search with active tenant scoping & bilingual FTS
CREATE OR REPLACE FUNCTION public.search_knowledge_articles(
    p_query text DEFAULT NULL::text,
    p_content_type text DEFAULT NULL::text,
    p_status text DEFAULT 'PUBLISHED'::text,
    p_department_id uuid DEFAULT NULL::uuid,
    p_requires_acknowledgment boolean DEFAULT NULL::boolean,
    p_limit integer DEFAULT 20,
    p_offset integer DEFAULT 0,
    p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, rank real, total_count bigint)
LANGUAGE sql
STABLE SECURITY INVOKER
AS $$
    SELECT
        d.id,
        CASE
            WHEN p_query IS NOT NULL AND btrim(p_query) <> '' THEN
                GREATEST(
                    ts_rank_cd(d.search_vector, websearch_to_tsquery('english', p_query), 32),
                    ts_rank_cd(d.search_vector, websearch_to_tsquery('simple', p_query), 32),
                    CASE WHEN d.title ILIKE '%' || p_query || '%' OR d.title_ar ILIKE '%' || p_query || '%' THEN 0.5 ELSE 0.0 END
                )
            ELSE 0.0
        END::real AS rank,
        count(*) OVER() AS total_count
    FROM public.documents d
    WHERE d.is_deleted = false
        AND d.is_archived = false
        AND (
            -- Strict tenant isolation when p_organization_id is supplied
            (p_organization_id IS NOT NULL AND (
                (d.organization_id = p_organization_id AND public.org_visible(p_organization_id))
                OR (COALESCE(d.is_master_template, false) = true AND (public.is_platform_super_admin() OR public.org_visible(p_organization_id)))
            ))
            -- Fallback when p_organization_id is omitted (backward compatibility)
            OR (p_organization_id IS NULL AND (
                public.is_platform_super_admin()
                OR COALESCE(d.is_master_template, false) = true
                OR public.org_visible(d.organization_id)
            ))
        )
        AND (p_status IS NULL OR d.status::text = p_status)
        AND d.knowledge_base_status = 'indexed'
        AND d.is_active_kb_version = true
        AND (
            p_query IS NULL
            OR btrim(p_query) = ''
            OR d.search_vector @@ websearch_to_tsquery('english', p_query)
            OR d.search_vector @@ websearch_to_tsquery('simple', p_query)
            OR d.title ILIKE '%' || p_query || '%'
            OR d.title_ar ILIKE '%' || p_query || '%'
            OR d.description ILIKE '%' || p_query || '%'
            OR d.description_ar ILIKE '%' || p_query || '%'
        )
        AND (p_content_type IS NULL OR lower(d.content_type) = lower(p_content_type))
        AND (p_department_id IS NULL OR d.department_id = p_department_id)
        AND (p_requires_acknowledgment IS NULL OR d.requires_acknowledgment = p_requires_acknowledgment)
    ORDER BY rank DESC, d.updated_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;

-- 3. Secure Search Documents with active tenant scoping
CREATE OR REPLACE FUNCTION public.secure_search_documents(
    p_search_query text,
    p_folder_id uuid DEFAULT NULL::uuid,
    p_status text DEFAULT NULL::text,
    p_visibility text DEFAULT NULL::text,
    p_department_id uuid DEFAULT NULL::uuid,
    p_file_type text[] DEFAULT NULL::text[],
    p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_confidentiality_level text DEFAULT NULL::text,
    p_include_deleted boolean DEFAULT false,
    p_include_archived boolean DEFAULT false,
    p_sort_by text DEFAULT 'created_at'::text,
    p_sort_order text DEFAULT 'desc'::text,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0,
    p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
    id uuid,
    title text,
    description text,
    content text,
    file_url text,
    status text,
    visibility text,
    department_id uuid,
    folder_id uuid,
    file_type text,
    file_size bigint,
    file_extension text,
    confidentiality_level text,
    is_deleted boolean,
    is_archived boolean,
    created_by uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    expires_at timestamp with time zone,
    view_count integer,
    download_count integer,
    content_type text,
    author jsonb
)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_sort_column TEXT;
BEGIN
    v_sort_column := CASE WHEN p_sort_by IN ('created_at','updated_at','title','file_size','view_count') THEN p_sort_by ELSE 'created_at' END;
    v_is_admin := public.is_platform_super_admin();

    RETURN QUERY
    SELECT d.id, d.title, d.description, d.content, d.file_url, d.status::TEXT, d.visibility::TEXT,
           d.department_id, d.folder_id, d.file_type, d.file_size, d.file_extension,
           d.confidentiality_level::TEXT, d.is_deleted, d.is_archived, d.created_by, d.created_at,
           d.updated_at, d.expires_at, d.view_count, d.download_count, d.content_type,
           jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) AS author
    FROM public.documents d
    LEFT JOIN public.profiles p ON d.created_by = p.id
    WHERE
        (p_search_query IS NULL OR p_search_query = '' OR
            (d.title ILIKE '%'||p_search_query||'%' 
             OR d.title_ar ILIKE '%'||p_search_query||'%'
             OR d.description ILIKE '%'||p_search_query||'%' 
             OR d.description_ar ILIKE '%'||p_search_query||'%'
             OR d.content ILIKE '%'||p_search_query||'%'))
        AND (p_folder_id IS NULL OR d.folder_id = p_folder_id)
        AND (p_status IS NULL OR d.status::TEXT = p_status)
        AND (p_visibility IS NULL OR d.visibility::TEXT = p_visibility)
        AND (p_department_id IS NULL OR d.department_id = p_department_id)
        AND (p_file_type IS NULL OR p_file_type = '{}' OR d.file_type = ANY(p_file_type))
        AND (p_date_from IS NULL OR d.created_at >= p_date_from)
        AND (p_date_to IS NULL OR d.created_at <= p_date_to)
        AND (p_confidentiality_level IS NULL OR d.confidentiality_level::TEXT = p_confidentiality_level)
        AND (p_include_deleted = TRUE OR d.is_deleted = FALSE)
        AND (p_include_archived = TRUE OR d.is_archived = FALSE)
        -- Multi-tenant isolation boundary
        AND (
            (p_organization_id IS NOT NULL AND (
                (d.organization_id = p_organization_id AND (v_is_admin OR public.org_visible(p_organization_id)))
                OR (COALESCE(d.is_master_template, false) = true AND (v_is_admin OR public.org_visible(p_organization_id)))
            ))
            OR (p_organization_id IS NULL AND (
                v_is_admin OR COALESCE(d.is_master_template, false) OR public.org_visible(d.organization_id)
            ))
        )
        AND (
            v_is_admin
            OR d.created_by = v_user_id
            OR d.owner_id = v_user_id
            OR (d.status = 'PUBLISHED' AND (
                    d.visibility = 'all_properties'
                    OR (d.visibility = 'department' AND EXISTS (
                        SELECT 1 FROM public.organization_memberships om
                        WHERE om.user_id = v_user_id AND om.is_active = true AND om.department_id = d.department_id
                    ))
                    OR (d.visibility = 'specific_departments' AND EXISTS (
                        SELECT 1 FROM public.organization_memberships om
                        JOIN public.document_department_access dda ON dda.department_id = om.department_id
                        WHERE om.user_id = v_user_id AND om.is_active = true AND dda.document_id = d.id
                    ))
                    OR (d.visibility = 'role' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_user_id AND ur.role::TEXT = d.role::TEXT))
               ))
        )
    ORDER BY
        CASE v_sort_column WHEN 'title' THEN d.title ELSE NULL END ASC NULLS LAST,
        CASE v_sort_column WHEN 'created_at' THEN d.created_at::TEXT WHEN 'updated_at' THEN d.updated_at::TEXT ELSE NULL END::TIMESTAMPTZ DESC NULLS LAST
    LIMIT LEAST(p_limit, 500) OFFSET GREATEST(p_offset, 0);
END;
$$;

-- 4. Secure Search Users with active tenant scoping
CREATE OR REPLACE FUNCTION public.secure_search_users(
    p_search_query text,
    p_department_id uuid DEFAULT NULL::uuid,
    p_role text DEFAULT NULL::text,
    p_is_active boolean DEFAULT true,
    p_limit integer DEFAULT 50,
    p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
    id uuid,
    email text,
    full_name text,
    phone text,
    job_title text,
    staff_id text,
    avatar_url text,
    is_active boolean,
    hire_date date,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_platform BOOLEAN;
    v_user_org_ids UUID[];
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    v_is_platform := public.is_platform_super_admin();
    v_user_org_ids := public.current_user_organization_ids();

    RETURN QUERY
    SELECT DISTINCT
        p.id, p.email, p.full_name, p.phone, p.job_title, p.staff_id, p.avatar_url,
        p.is_active, p.hire_date, p.created_at
    FROM public.profiles p
    JOIN public.organization_memberships om ON om.user_id = p.id AND om.is_active = true
    WHERE
        (p_search_query IS NULL OR p_search_query = '' OR
            (p.full_name ILIKE '%' || p_search_query || '%' OR
             p.email ILIKE '%' || p_search_query || '%' OR
             p.job_title ILIKE '%' || p_search_query || '%' OR
             p.staff_id ILIKE '%' || p_search_query || '%'))
        AND (p_is_active IS NULL OR p.is_active = p_is_active)
        AND (p_department_id IS NULL OR om.department_id = p_department_id)
        -- Support modern platform roles and legacy roles
        AND (
            p_role IS NULL 
            OR p_role = 'all'
            OR om.role::text = p_role
            OR (p_role = 'administrator' AND om.role::text IN ('organization_owner', 'organization_admin', 'brand_admin'))
            OR (p_role = 'author' AND om.role::text IN ('author', 'instructor', 'department_manager'))
            OR (p_role = 'learner' AND om.role::text = 'learner')
            OR (p_role = 'manager' AND om.role::text IN ('training_manager', 'knowledge_manager', 'department_manager'))
        )
        -- Multi-tenant isolation boundary
        AND (
            (p_organization_id IS NOT NULL AND om.organization_id = p_organization_id AND (
                v_is_platform OR p_organization_id = ANY(v_user_org_ids)
            ))
            OR (p_organization_id IS NULL AND (
                v_is_platform
                OR p.id = v_user_id
                OR (
                    om.organization_id = ANY(v_user_org_ids)
                    AND public.org_is_operational(om.organization_id)
                )
            ))
        )
    ORDER BY p.full_name ASC NULLS LAST
    LIMIT LEAST(p_limit, 200);
END;
$$;

-- Revoke anon execute on recreated search functions
REVOKE EXECUTE ON FUNCTION public.search_knowledge_articles(text, text, text, uuid, boolean, integer, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.secure_search_documents(text, uuid, text, text, uuid, text[], timestamptz, timestamptz, text, boolean, boolean, text, text, integer, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.secure_search_users(text, uuid, text, boolean, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_knowledge_articles(text, text, text, uuid, boolean, integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_search_documents(text, uuid, text, text, uuid, text[], timestamptz, timestamptz, text, boolean, boolean, text, text, integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_search_users(text, uuid, text, boolean, integer, uuid) TO authenticated, service_role;
