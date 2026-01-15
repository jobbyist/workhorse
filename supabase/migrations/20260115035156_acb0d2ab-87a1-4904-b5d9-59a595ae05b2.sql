-- Allow created_by to be nullable for scraped listings
ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;

-- Update RLS policy to allow service role to insert scraped listings
DROP POLICY IF EXISTS "Service role can insert scraped events" ON public.events;
CREATE POLICY "Service role can insert scraped events" 
ON public.events 
FOR INSERT 
WITH CHECK (is_scraped = true OR auth.uid() = created_by);