-- Create table for role change history
CREATE TABLE public.role_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changed_by_user_id UUID NOT NULL,
  previous_role app_role NOT NULL,
  new_role app_role NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.role_change_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view role change history
CREATE POLICY "Admins can view role change history"
ON public.role_change_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert role change history
CREATE POLICY "Admins can insert role change history"
ON public.role_change_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_role_change_history_user_id ON public.role_change_history(user_id);
CREATE INDEX idx_role_change_history_changed_at ON public.role_change_history(changed_at DESC);