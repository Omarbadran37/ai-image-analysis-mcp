# Supabase Deployment Guide

## 🚀 Deploying AI Image Analysis MCP to Supabase

This guide walks you through deploying the AI Image Analysis MCP as a Supabase Edge Function for serverless operation.

## 📋 Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Supabase account and project
- Google AI API key (Gemini)

## 🛠️ Setup Steps

### 1. Initialize Supabase Project

```bash
# If you don't have a Supabase project yet
supabase login
supabase projects create ai-image-analysis

# Link to existing project
supabase link --project-ref YOUR_PROJECT_REF
```

### 2. Setup Database Schema

```bash
# Reset database with our schema
supabase db reset

# Or apply migrations manually
supabase db push
```

### 3. Deploy Edge Function

```bash
# Deploy the edge function
supabase functions deploy ai-image-analysis-mcp

# Set environment variables
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Configure Storage

```bash
# Create storage buckets (if not created via seed.sql)
supabase storage create ai-images
supabase storage create ai-processed --public
```

## 🔧 Configuration

### Environment Variables

Set these in your Supabase project dashboard under Settings > Edge Functions:

```
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Security Settings

Update the `SECURITY_CONFIG` in `supabase/functions/ai-image-analysis-mcp/index.ts`:

```typescript
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_ORIGINS: [
    'https://your-production-app.com',
    'http://localhost:3000' // Remove in production
  ],
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 30,
  ENABLE_AUTH_VALIDATION: true // Set to false for public access
}
```

## 📡 API Usage

### Function URL

Your deployed function will be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-image-analysis-mcp
```

### Example API Calls

#### Analyze Image
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-image-analysis-mcp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-session-id: $(uuidgen)" \
  -d '{
    "tool": "analyze_image",
    "parameters": {
      "image_path": "/path/to/image.jpg",
      "analysis_type": "lifestyle"
    }
  }'
```

#### Upload to Supabase Storage
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-image-analysis-mcp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-session-id: $(uuidgen)" \
  -d '{
    "tool": "upload_to_supabase",
    "parameters": {
      "image_data": "base64_encoded_image_data",
      "bucket": "ai-processed",
      "path": "uploads/image.jpg",
      "supabase_url": "https://your-project.supabase.co",
      "supabase_key": "your_service_role_key",
      "metadata": {
        "analysis_version": "2.0",
        "processed_at": "2024-01-01T00:00:00Z"
      }
    }
  }'
```

#### Get Security Status
```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-image-analysis-mcp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-session-id: $(uuidgen)" \
  -d '{
    "tool": "get_security_status",
    "parameters": {}
  }'
```

## 🔒 Security Features

### Authentication
- Optional JWT validation via Supabase Auth
- IP-based rate limiting
- Session tracking and risk scoring

### Request Validation
- Tool allowlist enforcement
- Prompt injection detection
- Parameter sanitization
- File path validation

### Audit Logging
- All requests logged to `mcp_audit_log` table
- Security events tracked in `security_events` table
- Risk scoring and threat detection

## 📊 Monitoring

### Database Tables

Monitor your deployment through these tables:

- `mcp_audit_log`: All API calls and their results
- `security_events`: Security incidents and threats
- `orbit_users`: User management and limits

### Useful Queries

```sql
-- Recent API activity
SELECT tool_name, success, COUNT(*) as calls, AVG(execution_time_ms) as avg_time
FROM mcp_audit_log 
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY tool_name, success;

-- Security incidents
SELECT event_type, severity, COUNT(*) as incidents
FROM security_events 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type, severity;

-- Top users by API usage
SELECT u.email, COUNT(m.id) as api_calls
FROM ai_users u
JOIN mcp_audit_log m ON u.id = m.user_id
WHERE m.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.email
ORDER BY api_calls DESC;
```

## 🚨 Troubleshooting

### Common Issues

1. **Function deployment fails**
   ```bash
   # Check function logs
   supabase functions logs ai-image-analysis-mcp
   ```

2. **GEMINI_API_KEY not found**
   ```bash
   # Verify secrets are set
   supabase secrets list
   ```

3. **Database connection issues**
   ```bash
   # Check database status
   supabase status
   ```

4. **Storage upload fails**
   - Verify storage policies are correctly configured
   - Check file size limits (default 50MB)
   - Ensure MIME types are allowed

### Debug Mode

Enable debug logging by setting `DEBUG=true` in your environment variables.

## 🔧 Development

### Local Development

```bash
# Start Supabase locally
supabase start

# Serve edge function locally
supabase functions serve ai-image-analysis-mcp --env-file .env
```

### Testing

```bash
# Run function tests
supabase test db
```

## 📈 Performance

### Optimization Tips

1. **Cold Start Reduction**: Keep functions warm with regular health checks
2. **Rate Limiting**: Adjust limits based on your usage patterns
3. **Caching**: Implement Redis for rate limit storage in high-traffic scenarios
4. **Database**: Add indexes for frequently queried columns

### Scaling

The Edge Function automatically scales with Supabase's infrastructure. Monitor usage through:
- Supabase Dashboard metrics
- Database query performance
- Function execution logs

## 🔄 Updates

### Deploying Updates

```bash
# Deploy updated function
supabase functions deploy ai-image-analysis-mcp

# Apply database migrations
supabase db push
```

### Rolling Back

```bash
# View deployment history
supabase functions list

# Rollback if needed (contact Supabase support for rollback procedures)
```

---

**Ready to deploy!** Your AI Image Analysis MCP will be available as a scalable, secure Edge Function on Supabase's global infrastructure.