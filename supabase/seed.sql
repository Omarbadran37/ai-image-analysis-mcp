-- Supabase seed file for ORBIT Gemini Image Analysis MCP
-- Run with: supabase db reset

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enhanced users table for ORBIT platform
CREATE TABLE IF NOT EXISTS public.orbit_users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  plan_type TEXT CHECK (plan_type IN ('free', 'basic', 'premium', 'enterprise')) DEFAULT 'free',
  monthly_image_limit INTEGER DEFAULT 50,
  images_processed_this_month INTEGER DEFAULT 0,
  
  -- Security tracking
  last_login_at TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMP WITH TIME ZONE,
  
  -- Compliance
  gdpr_consent BOOLEAN DEFAULT FALSE,
  data_retention_days INTEGER DEFAULT 365,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MCP audit log for security and compliance
CREATE TABLE IF NOT EXISTS public.mcp_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES orbit_users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  
  -- Call metadata
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  error_message TEXT,
  
  -- Security context
  ip_address INET,
  user_agent TEXT,
  risk_score INTEGER DEFAULT 0,
  
  -- Compliance
  contains_pii BOOLEAN DEFAULT FALSE,
  data_classification TEXT CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')) DEFAULT 'internal',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events table for threat monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES orbit_users(id),
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'prompt_injection_detected',
    'suspicious_activity',
    'rate_limit_exceeded',
    'unauthorized_access_attempt',
    'high_risk_score_detected',
    'file_validation_failed'
  )),
  
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  
  -- Response
  blocked BOOLEAN DEFAULT FALSE,
  action_taken TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE orbit_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orbit_users
CREATE POLICY "Users can only access their own data" ON orbit_users
  FOR ALL USING (auth.uid() = id);

-- RLS Policies for mcp_audit_log
CREATE POLICY "Users can only view their own audit logs" ON mcp_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all audit logs" ON mcp_audit_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for security_events
CREATE POLICY "Users can view their own security events" ON security_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all security events" ON security_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Storage buckets for image processing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('orbit-images', 'orbit-images', false, 52428800, '{"image/jpeg","image/png","image/webp"}'),
  ('orbit-processed', 'orbit-processed', true, 52428800, '{"image/jpeg","image/png","image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'orbit-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own images" ON storage.objects
  FOR SELECT USING (bucket_id = 'orbit-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public access to processed images" ON storage.objects
  FOR SELECT USING (bucket_id = 'orbit-processed');

-- Indexes for performance
CREATE INDEX idx_mcp_audit_log_user_id ON mcp_audit_log(user_id);
CREATE INDEX idx_mcp_audit_log_created_at ON mcp_audit_log(created_at);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for orbit_users updated_at
CREATE TRIGGER update_orbit_users_updated_at 
  BEFORE UPDATE ON orbit_users 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();

-- Insert sample data for testing (optional)
-- This creates a test user when running locally
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'test@orbit.dev', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO orbit_users (id, email, plan_type, monthly_image_limit)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'test@orbit.dev', 'premium', 500)
ON CONFLICT (id) DO NOTHING;