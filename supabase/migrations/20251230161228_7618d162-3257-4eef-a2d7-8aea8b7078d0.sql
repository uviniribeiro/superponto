-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the bucket
CREATE POLICY "Admins can upload employee photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view employee photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'employee-photos');

CREATE POLICY "Admins can update employee photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete employee photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'));

-- Add photo_url column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;