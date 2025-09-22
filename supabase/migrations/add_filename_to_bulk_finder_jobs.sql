-- Add filename field to bulk_finder_jobs table
ALTER TABLE public.bulk_finder_jobs 
ADD COLUMN filename TEXT;

-- Add comment to describe the field
COMMENT ON COLUMN public.bulk_finder_jobs.filename IS 'Original CSV filename uploaded by user';