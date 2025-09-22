-- Add filename field to bulk_verification_jobs table
ALTER TABLE public.bulk_verification_jobs 
ADD COLUMN filename TEXT;

-- Add comment to describe the field
COMMENT ON COLUMN public.bulk_verification_jobs.filename IS 'Original CSV filename uploaded by user';