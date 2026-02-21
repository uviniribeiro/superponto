
-- Remove the policy that allows employees to insert their own time records
DROP POLICY IF EXISTS "Users can insert own time records" ON public.time_records;

-- Remove the policy that allows employees to create their own adjustment requests
DROP POLICY IF EXISTS "Users can create adjustment requests" ON public.adjustment_requests;
