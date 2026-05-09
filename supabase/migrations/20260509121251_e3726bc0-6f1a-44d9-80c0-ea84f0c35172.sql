DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;
CREATE POLICY "Public can view settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Também libera leitura pública dos links de afiliados ativos (caso a página /affiliate seja pública)
DROP POLICY IF EXISTS "Authenticated users can view active affiliates" ON public.affiliate_links;
CREATE POLICY "Public can view active affiliates"
ON public.affiliate_links
FOR SELECT
TO anon, authenticated
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));