-- Create bulk_finder_jobs table to store background job information
CREATE TABLE IF NOT EXISTS public.bulk_finder_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'paused')),
  total_requests INTEGER NOT NULL,
  processed_requests INTEGER DEFAULT 0,
  successful_finds INTEGER DEFAULT 0,
  failed_finds INTEGER DEFAULT 0,
  requests_data JSONB NOT NULL, -- Store the request list and results
  current_index INTEGER DEFAULT 0, -- Track which request we're currently processing
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS bulk_finder_jobs_user_id_idx ON bulk_finder_jobs(user_id);
CREATE INDEX IF NOT EXISTS bulk_finder_jobs_status_idx ON bulk_finder_jobs(status);
CREATE INDEX IF NOT EXISTS bulk_finder_jobs_created_at_idx ON bulk_finder_jobs(created_at);

-- Enable RLS
ALTER TABLE public.bulk_finder_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own jobs" ON public.bulk_finder_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.bulk_finder_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.bulk_finder_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs" ON public.bulk_finder_jobs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER handle_bulk_finder_jobs_updated_at
  BEFORE UPDATE ON public.bulk_finder_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.bulk_finder_jobs TO anon, authenticated;