# AI Image Analysis MCP Hybrid Deployment Guide

## 🎯 Overview

This guide shows you how to deploy the AI Image Analysis MCP as a **hybrid system** that can work both locally and through Supabase Edge Functions, while maintaining the same MCP interface for Claude Desktop.

## 🏗️ Architecture Options

### **Option 1: Local MCP Server**
```
Claude Desktop ↔ stdio ↔ Local Node.js Process ↔ Gemini API
```

### **Option 2: Supabase MCP Server**  
```
Claude Desktop ↔ stdio ↔ Local Proxy ↔ HTTPS ↔ Supabase Edge Function ↔ Gemini API
                                                       ↓
                                              Supabase Database (persistent state)
```

### **Option 3: Hybrid (Both Available)**
```
Claude Desktop can choose between:
├── orbit-gemini-analysis-local     (local processing)
└── orbit-gemini-analysis-supabase  (cloud processing)
```

## 🚀 Deployment Steps

### **Step 1: Deploy to Supabase**

1. **Setup Supabase Project**
```bash
# Login and link to your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply database schema
supabase db reset

# Deploy the MCP Edge Function
supabase functions deploy orbit-mcp-server
```

2. **Configure Supabase Secrets**
```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
supabase secrets set SUPABASE_URL=https://your-project.supabase.co  
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. **Test Edge Function**
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/orbit-mcp-server' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/list"
     }'
```

### **Step 2: Build Local Components**

```bash
# Build all TypeScript components
npm run build

# Verify both local server and proxy are built
ls dist/
# Should show: index.js, mcp-supabase-proxy.js, modules/, utils/
```

### **Step 3: Configure Claude Desktop**

Create or update your Claude Desktop configuration:

```json

    "orbit-gemini-analysis-local": {
      "command": "node",
      "args": ["/path/to/ai-image-analysis-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_gemini_api_key_here"
      },
      "description": "Local ORBIT Gemini Image Analysis MCP Server"
    },
    "orbit-gemini-analysis-supabase": {
      "command": "node", 
      "args": ["/path/to/ai-image-analysis-mcp/dist/mcp-supabase-proxy.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your_anon_key_here",
        "SUPABASE_FUNCTION_NAME": "orbit-mcp-server"
      },
      "description": "Supabase-backed ORBIT Gemini Image Analysis MCP Server"
    }
 
```

### **Step 4: Test Both Deployments**

**Test Local MCP:**
- Claude Desktop will show "orbit-gemini-analysis-local" as available
- Processes images locally on your machine
- Uses local memory for rate limiting and audit logs

**Test Supabase MCP:**
- Claude Desktop will show "orbit-gemini-analysis-supabase" as available  
- Forwards requests to Supabase Edge Functions
- Uses database for persistent state and analytics

## 💡 Usage Patterns

### **When to Use Local MCP**
✅ **Development and debugging**
✅ **Private/sensitive images** 
✅ **Offline processing**
✅ **Fast local testing**

### **When to Use Supabase MCP**
✅ **Production workflows**
✅ **Team collaboration** (shared state)
✅ **Analytics and monitoring**
✅ **Global availability**
✅ **Persistent audit logs**

## 🔄 Switching Between Modes

In Claude Desktop, you can easily switch between local and cloud processing:

```
User: "Use the local server to analyze this image..."
Claude: [Uses orbit-gemini-analysis-local]

User: "Now use the cloud server for the same image..."  
Claude: [Uses orbit-gemini-analysis-supabase]
```

## 📊 Monitoring and Analytics

### **Local MCP Monitoring**
- In-memory audit logs (lost on restart)
- Console logging for debugging
- No persistent analytics

### **Supabase MCP Monitoring**
- Persistent request/response logging in database
- Advanced analytics with SQL queries
- Real-time monitoring via Supabase dashboard

**Example Analytics Queries:**
```sql
-- Get request statistics for last 24 hours
SELECT * FROM get_mcp_statistics('24 hours');

-- View recent failed requests
SELECT tool_name, error_message, created_at 
FROM mcp_requests 
WHERE success = false 
ORDER BY created_at DESC 
LIMIT 10;

-- Analyze image processing patterns
SELECT 
    analysis_type,
    COUNT(*) as total_analyses,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(confidence) as avg_confidence
FROM image_analysis_results 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY analysis_type;
```

## 🔧 Advanced Configuration

### **Environment Variables**

**For Local MCP:**
```bash
export GEMINI_API_KEY="your_gemini_api_key_here"
export NODE_ENV="development"  # Optional
export DEBUG="true"            # Optional
```

**For Supabase MCP Proxy:**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key_here" 
export SUPABASE_FUNCTION_NAME="orbit-mcp-server"  # Optional, defaults to orbit-mcp-server
```

### **Database Configuration**

The Supabase deployment includes:
- **Request logging** with full request/response data
- **Rate limiting** with persistent state across restarts
- **Audit logging** for security monitoring  
- **Analytics tables** for performance insights
- **Row Level Security (RLS)** for multi-user support

### **Fallback Strategy**

You can implement automatic fallback:
1. Try Supabase MCP first (for analytics)
2. Fall back to Local MCP if Supabase is unavailable
3. Claude Desktop will handle this automatically if one server fails

## 🎉 Benefits of Hybrid Approach

✅ **Best of both worlds**: Local speed + Cloud persistence
✅ **Seamless switching**: Same MCP interface for both
✅ **Development flexibility**: Local testing, cloud production
✅ **Data insights**: Analytics from cloud deployment
✅ **Reliability**: Fallback options available
✅ **Team collaboration**: Shared cloud state when needed

## 🚨 Important Notes

1. **API Keys**: Both deployments need access to your Gemini API key
2. **Image Data**: Local processing keeps images on your machine; Supabase can store them in cloud storage
3. **Costs**: Local is free; Supabase charges for Edge Function invocations and storage
4. **Performance**: Local is faster; Supabase adds network latency but provides scaling
5. **Security**: Both maintain the same security features (rate limiting, validation, etc.)

The hybrid approach gives you maximum flexibility while maintaining the clean MCP interface that Claude Desktop expects!