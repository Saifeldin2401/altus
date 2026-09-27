-- Migration: 20260927090300_tighten_storage_write_policies.sql
-- Tighten storage write/delete policies for content-media, training-content, and reports-exports.
-- 1. Limit org folder write/delete in content-media to content editors (is_tenant_content_editor).
-- 2. Drop the shared 'training/' clause from training-content, and restrict org folder write/delete to content editors.
-- 3. Restrict reports-exports uploads to the uploader's own user folder or authorized org folder.

-- 1. content-media
DROP POLICY IF EXISTS content_media_insert ON storage.objects;
CREATE POLICY content_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'content-media'
    AND (
      is_platform_operator()
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS content_media_update ON storage.objects;
CREATE POLICY content_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'content-media'
    AND (
      is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS content_media_delete ON storage.objects;
CREATE POLICY content_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'content-media'
    AND (
      is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- 2. training-content
DROP POLICY IF EXISTS training_content_insert ON storage.objects;
CREATE POLICY training_content_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'training-content'
    AND (
      is_platform_operator()
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS training_content_update ON storage.objects;
CREATE POLICY training_content_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'training-content'
    AND (
      is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS training_content_delete ON storage.objects;
CREATE POLICY training_content_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'training-content'
    AND (
      is_platform_operator()
      OR owner = (SELECT auth.uid())
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- 3. reports-exports
DROP POLICY IF EXISTS reports_exports_insert ON storage.objects;
CREATE POLICY reports_exports_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports-exports'
    AND (
      is_platform_operator()
      OR ((storage.foldername(name))[1] = (SELECT auth.uid())::text)
      OR (
        ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$')
        AND (((storage.foldername(name))[1])::uuid = ANY (current_user_organization_ids()))
        AND (
          is_tenant_admin(((storage.foldername(name))[1])::uuid)
          OR is_tenant_content_editor(((storage.foldername(name))[1])::uuid)
        )
      )
    )
  );
