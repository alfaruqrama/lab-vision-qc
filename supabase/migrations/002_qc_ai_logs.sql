-- AI extraction logs for monitoring and rate limiting
-- Migration: 002_qc_ai_logs.sql
-- Purpose: Track AI QC extraction requests, enforce rate limiting (20 scans/user/day)

-- Create qc_ai_logs table
CREATE TABLE qc_ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_timestamp timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  error_message text,
  tokens_used integer,
  response_time_ms integer,
  extracted_data jsonb,
  image_size_kb integer,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Indexes for performance
CREATE INDEX idx_qc_ai_logs_user_id ON qc_ai_logs(user_id);
CREATE INDEX idx_qc_ai_logs_timestamp ON qc_ai_logs(request_timestamp DESC);
-- Note: Cannot create index on DATE(request_timestamp) directly (not immutable)
-- Query will use idx_qc_ai_logs_user_id + filter on timestamp range instead

-- RLS policies (consistent with existing tables - DISABLED for local dev)
ALTER TABLE qc_ai_logs DISABLE ROW LEVEL SECURITY;

-- Note: For production, enable RLS and add policies:
-- ALTER TABLE qc_ai_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own AI logs" ON qc_ai_logs FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Admin can read all AI logs" ON qc_ai_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to check daily rate limit
CREATE OR REPLACE FUNCTION check_ai_rate_limit(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM qc_ai_logs
  WHERE user_id = p_user_id
    AND DATE(request_timestamp) = CURRENT_DATE;
  
  RETURN v_count < p_limit;
END;
$$;

-- Function to get remaining scans for today
CREATE OR REPLACE FUNCTION get_remaining_ai_scans(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used integer;
BEGIN
  SELECT COUNT(*)
  INTO v_used
  FROM qc_ai_logs
  WHERE user_id = p_user_id
    AND DATE(request_timestamp) = CURRENT_DATE;
  
  RETURN GREATEST(0, p_limit - v_used);
END;
$$;

-- Comments for documentation
COMMENT ON TABLE qc_ai_logs IS 'Logs for AI QC extraction requests - tracks usage, errors, and enforces rate limiting (20 scans/user/day)';
COMMENT ON COLUMN qc_ai_logs.user_id IS 'User who made the AI extraction request';
COMMENT ON COLUMN qc_ai_logs.request_timestamp IS 'When the request was made';
COMMENT ON COLUMN qc_ai_logs.success IS 'Whether the extraction was successful';
COMMENT ON COLUMN qc_ai_logs.error_message IS 'Error message if extraction failed';
COMMENT ON COLUMN qc_ai_logs.tokens_used IS 'Number of Gemini API tokens consumed';
COMMENT ON COLUMN qc_ai_logs.response_time_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN qc_ai_logs.extracted_data IS 'Extracted QC data (JSON)';
COMMENT ON COLUMN qc_ai_logs.image_size_kb IS 'Size of uploaded image in KB';
COMMENT ON FUNCTION check_ai_rate_limit IS 'Returns true if user has not exceeded daily AI scan limit';
COMMENT ON FUNCTION get_remaining_ai_scans IS 'Returns number of remaining AI scans for user today';
