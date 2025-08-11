-- Database schema for MCP Server state persistence

-- Table for storing MCP requests and responses
CREATE TABLE IF NOT EXISTS mcp_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_name TEXT NOT NULL,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table for rate limiting (persistent across restarts)
CREATE TABLE IF NOT EXISTS mcp_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_identifier TEXT NOT NULL UNIQUE,
    request_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_request TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for audit logs (persistent security monitoring)
CREATE TABLE IF NOT EXISTS mcp_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_name TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    input_hash TEXT NOT NULL,
    error_message TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing analysis results with metadata
CREATE TABLE IF NOT EXISTS image_analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('lifestyle', 'product')),
    confidence REAL NOT NULL,
    metadata JSONB NOT NULL,
    processing_time_ms INTEGER,
    security_scan JSONB,
    integrity_info JSONB,
    image_checksum TEXT,
    image_size INTEGER,
    mime_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_requests_tool_name ON mcp_requests(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_created_at ON mcp_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_success ON mcp_requests(success);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_user_id ON mcp_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_rate_limits_client ON mcp_rate_limits(client_identifier);
CREATE INDEX IF NOT EXISTS idx_mcp_rate_limits_window ON mcp_rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_tool_name ON mcp_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_created_at ON mcp_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_success ON mcp_audit_log(success);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_user_id ON mcp_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_image_analysis_type ON image_analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_image_analysis_checksum ON image_analysis_results(image_checksum);
CREATE INDEX IF NOT EXISTS idx_image_analysis_created_at ON image_analysis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_analysis_user_id ON image_analysis_results(user_id);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE mcp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_analysis_results ENABLE ROW LEVEL SECURITY;

-- MCP Requests policies
CREATE POLICY "Users can view their own MCP requests" ON mcp_requests
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage all MCP requests" ON mcp_requests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert MCP requests" ON mcp_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Rate Limits policies  
CREATE POLICY "Service role can manage rate limits" ON mcp_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Audit Log policies
CREATE POLICY "Users can view their own audit logs" ON mcp_audit_log
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage all audit logs" ON mcp_audit_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert audit logs" ON mcp_audit_log
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Image Analysis Results policies
CREATE POLICY "Users can view their own analysis results" ON image_analysis_results
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage all analysis results" ON image_analysis_results
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert analysis results" ON image_analysis_results
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Functions for cleanup and maintenance

-- Function to clean old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM mcp_rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get request statistics
CREATE OR REPLACE FUNCTION get_mcp_statistics(time_window INTERVAL DEFAULT '24 hours')
RETURNS TABLE (
    total_requests BIGINT,
    successful_requests BIGINT,
    failed_requests BIGINT,
    success_rate NUMERIC,
    avg_processing_time NUMERIC,
    most_used_tool TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_requests,
        COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_requests,
        COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_requests,
        ROUND(
            (COUNT(*) FILTER (WHERE success = true)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
            2
        ) as success_rate,
        ROUND(AVG(processing_time_ms), 2) as avg_processing_time,
        (
            SELECT tool_name 
            FROM mcp_requests 
            WHERE created_at >= NOW() - time_window
            GROUP BY tool_name 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_used_tool
    FROM mcp_requests 
    WHERE created_at >= NOW() - time_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old rate limits (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits();');