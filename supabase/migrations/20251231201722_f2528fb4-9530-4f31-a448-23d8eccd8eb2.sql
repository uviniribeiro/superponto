-- Add favorites column to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS favorite_routes text[] DEFAULT '{}';

-- Add last_visited_routes for quick access
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS last_visited_routes text[] DEFAULT '{}';