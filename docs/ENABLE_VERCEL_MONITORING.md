# Enable Vercel Monitoring - Manual Setup Guide

Since the Vercel CLI is not installed and the current Vercel MCP server doesn't support project configuration, you'll need to enable monitoring features manually through the Vercel Dashboard.

## Project Details
- **Project Name**: altus
- **Project ID**: prj_ulhX3mVSm4Y4QPlYANSncSHFo7jd
- **Team**: saif's projects (team_L6M2SSTP3OcjS3ToYujgNXOe)

## Method 1: Vercel Dashboard (Recommended & Required)

**Note**: Vercel CLI requires interactive mode for enabling monitoring features due to potential charges. The Dashboard method is required for both Web Analytics and Speed Insights.

### Enable Web Analytics
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `altus` project
3. Navigate to the **Analytics** tab
4. Click **"Enable Web Analytics"** button
5. Follow the setup wizard

### Enable Speed Insights
1. In the same `altus` project
2. Navigate to the **Speed Insights** tab
3. Click **"Enable Speed Insights"** button
4. Follow the setup wizard (note: this may incur charges on higher tiers)

## Method 2: Vercel REST API

If you have a Vercel API token, you can enable monitoring via API:

### Get Your Vercel Token
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create a new token with appropriate permissions
3. Save the token securely

### Enable via cURL
```bash
# Enable Web Analytics
curl --request PATCH \
  --url https://api.vercel.com/v9/projects/prj_ulhX3mVSm4Y4QPlYANSncSHFo7jd?teamId=team_L6M2SSTP3OcjS3ToYujgNXOe \
  --header "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "analytics": {
      "webVitals": {
        "enabled": true
      }
    }
  }'

# Enable Speed Insights
curl --request PATCH \
  --url https://api.vercel.com/v9/projects/prj_ulhX3mVSm4Y4QPlYANSncSHFo7jd?teamId=team_L6M2SSTP3OcjS3ToYujgNXOe \
  --header "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "speedInsights": {
      "enabled": true
    }
  }'
```

## Method 3: Vercel CLI (Limited Use)

### Install Vercel CLI
```bash
# Using npm
npm i -g vercel

# Or using the official installer (recommended for Windows)
# Download from https://vercel.com/cli
```

### Authenticate with Vercel
```bash
# Login to Vercel (requires browser authentication)
vercel login
```

**Important**: The `vercel login` command will:
1. Display a URL and device code
2. Open your browser to the authentication page
3. Ask you to log in and authorize the CLI
4. Store your credentials locally

### CLI Limitations
**Note**: Vercel CLI commands for enabling monitoring require interactive mode and cannot be automated:
- `vercel project web-analytics` - Must be run interactively
- `vercel project speed-insights` - Must be run interactively (due to potential charges)

### What CLI Can Do
The Vercel CLI is still useful for:
- Deploying projects
- Managing environment variables
- Viewing logs and deployment status
- Managing team access
- Other project management tasks

### Run the Setup Script (For Other Tasks)
```bash
# PowerShell
powershell -ExecutionPolicy Bypass -File scripts/enable-vercel-monitoring.ps1

# Or Bash
bash scripts/enable-vercel-monitoring.sh
```

The script will check authentication and provide guidance, but cannot enable monitoring features due to Vercel's interactive requirement.

## Verification

After enabling monitoring, verify it's working:

### 1. Check Dashboard
- Visit the **Analytics** tab - you should see visitor data after deployment
- Visit the **Speed Insights** tab - you should see Web Vitals data after deployment

### 2. Check Browser Console
After deploying to production:
```javascript
// Should show Vercel Analytics is loaded
console.log(window.va) // Should be defined

// Should show Speed Insights is collecting data
// Check Network tab for requests to vitals.vercel-analytics.com
```

### 3. Check React Components
Your `src/App.tsx` already has the conditional loading:
```typescript
const shouldEnableVercelInsights = () => {
  if (!import.meta.env.PROD) return false
  const host = window.location.hostname
  return (
    host.endsWith('vercel.app') ||
    host === 'altus-connect.com' ||
    host === 'www.altus-connect.com' ||
    // ... other domains
  )
}
```

## Custom Monitoring Features

Even without Vercel Analytics enabled, your custom monitoring features will work:

### Custom Events
```typescript
import { trackEvent, AnalyticsEvents } from '@/lib/vercelMonitoring'

trackEvent(AnalyticsEvents.COURSE_COMPLETED, {
  course_id: 'course-123',
  duration_seconds: 1800,
})
```

### Performance Hooks
```typescript
import { useRenderPerformance, useWebVitals } from '@/hooks/usePerformanceMonitor'

function MyComponent() {
  useRenderPerformance('MyComponent')
  useWebVitals()
  // ...
}
```

## Alternative: Standalone Analytics

If Vercel Analytics cannot be enabled, consider:

### 1. Continue with Sentry
Your Sentry setup is comprehensive and provides:
- Error tracking
- Performance monitoring
- Session replay
- Custom events

### 2. Add Google Analytics
```typescript
// Add to your existing setup
import ReactGA from 'react-ga4'

if (import.meta.env.PROD) {
  ReactGA.initialize('YOUR_GA4_ID')
}
```

### 3. Use Custom Analytics Endpoint
Set up your own analytics endpoint and modify `src/lib/vercelMonitoring.ts` to send data there instead.

## Current Status

### ✅ Already Configured
- Sentry error tracking and performance monitoring
- Vercel Analytics and Speed Insights packages installed
- Custom monitoring library and hooks created
- Conditional loading logic in App.tsx

### ⏳ Requires Manual Enablement
- Vercel Web Analytics (via Dashboard or API)
- Vercel Speed Insights (via Dashboard or API)

### 🚀 Ready to Use
- Custom event tracking
- Performance monitoring hooks
- Web Vitals tracking
- User engagement tracking

## Next Steps

1. **Enable via Dashboard** (easiest method)
2. **Deploy changes** to production
3. **Verify monitoring** is collecting data
4. **Review documentation** in `docs/VERCEL_MONITORING.md`

## Support

If you encounter issues:
- Check Vercel Dashboard for error messages
- Verify environment variables are set correctly
- Ensure deployment is to production environment
- Check browser console for JavaScript errors