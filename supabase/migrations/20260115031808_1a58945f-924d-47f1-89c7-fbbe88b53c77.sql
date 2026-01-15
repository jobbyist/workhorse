-- Add vehicle-specific columns to the events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS mileage INTEGER,
ADD COLUMN IF NOT EXISTS transmission TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'petrol',
ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'good',
ADD COLUMN IF NOT EXISTS seller_phone TEXT,
ADD COLUMN IF NOT EXISTS seller_email TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS is_scraped BOOLEAN DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_events_year ON public.events(year);
CREATE INDEX IF NOT EXISTS idx_events_mileage ON public.events(mileage);
CREATE INDEX IF NOT EXISTS idx_events_price ON public.events(ticket_price);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);

-- Create table for vehicle inquiries
CREATE TABLE IF NOT EXISTS public.vehicle_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on inquiries
ALTER TABLE public.vehicle_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "Anyone can create inquiries" 
ON public.vehicle_inquiries 
FOR INSERT 
WITH CHECK (true);

-- Vehicle owners can view inquiries for their vehicles
CREATE POLICY "Vehicle owners can view their inquiries" 
ON public.vehicle_inquiries 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = vehicle_inquiries.vehicle_id 
    AND events.created_by = auth.uid()
  )
);

-- Users can view their own inquiries
CREATE POLICY "Users can view their own inquiries" 
ON public.vehicle_inquiries 
FOR SELECT 
USING (auth.uid() = user_id);