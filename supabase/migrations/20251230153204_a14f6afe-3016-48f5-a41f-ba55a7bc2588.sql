-- Add WhatsApp phone field to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS whatsapp_alert_phone TEXT;

-- Add phone field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;