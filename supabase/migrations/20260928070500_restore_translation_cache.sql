-- Create translation cache table to optimize AI costs and performance
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text_hash TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  model_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate entries for same text + target language
  CONSTRAINT uq_translation_cache_hash_target UNIQUE(source_text_hash, target_lang)
);

-- Index for fast lookup by hash and language
CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup ON public.translation_cache(source_text_hash, target_lang);

-- Add comment
COMMENT ON TABLE public.translation_cache IS 'Stores AI-generated translations to prevent redundant API calls';

-- Enable RLS
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read cache
DROP POLICY IF EXISTS "Anyone authenticated can view translations" ON public.translation_cache;
CREATE POLICY "Anyone authenticated can view translations" ON public.translation_cache
  FOR SELECT TO authenticated USING (true);

-- Authenticated users and service role can insert into cache
DROP POLICY IF EXISTS "Authorized users can insert translations" ON public.translation_cache;
CREATE POLICY "Authorized users can insert translations" ON public.translation_cache
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authorized users can update translations" ON public.translation_cache;
CREATE POLICY "Authorized users can update translations" ON public.translation_cache
  FOR UPDATE TO authenticated USING (true);

-- Function to prune old cache entries (older than 90 days)
CREATE OR REPLACE FUNCTION public.prune_translation_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.translation_cache WHERE created_at < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
