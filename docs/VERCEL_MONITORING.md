# Vercel Monitoring Setup Guide

## Overview

Altus Connect has comprehensive monitoring setup with multiple layers of observability:

1. **Sentry** - Error tracking, session replay, performance monitoring
2. **Vercel Analytics** - Page views, visitor tracking, custom events
3. **Vercel Speed Insights** - Core Web Vitals, performance metrics
4. **Custom Monitoring** - Enhanced performance tracking and user analytics

## Current Setup

### Sentry Configuration
- **Error Tracking**: Full error reporting with stack traces
- **Session Replay**: Sampled session recording for debugging
- **Performance Monitoring**: Transaction tracking for API calls and page loads
- **Environment**: Production with 10% sampling, Development with 100% sampling

### Vercel Analytics
- **Page Views**: Automatic page view tracking
- **Custom Events**: User interaction tracking
- **Conditional Loading**: Only enabled on production domains
- **Supported Domains**:
  - `*.vercel.app`
  - `altus-advisory.com`, `www.altus-advisory.com`
  - `connect.altusadvisory.com`
  - `phg-connect.com`, `www.phg-connect.com`
  - `altus-connect.com`, `www.altus-connect.com`

### Vercel Speed Insights
- **Core Web Vitals**: LCP, FID, CLS monitoring
- **Real User Monitoring**: Actual user performance data
- **Performance Scores**: Route-level performance insights

## Enhanced Monitoring Features

### Custom Analytics Events

We've added custom event tracking for key user interactions:

```typescript
import { trackEvent, AnalyticsEvents } from '@/lib/vercelMonitoring'

// Track course completion
trackEvent(AnalyticsEvents.COURSE_COMPLETED, {
  course_id: 'course-123',
  user_id: 'user-456',
  duration_seconds: 1800,
})

// Track document acknowledgment
trackEvent(AnalyticsEvents.DOCUMENT_ACKNOWLEDGED, {
  document_id: 'doc-789',
  user_id: 'user-456',
})
```

### Performance Monitoring Hooks

Monitor component render performance and async operations:

```typescript
import { useRenderPerformance, useAsyncPerformance } from '@/hooks/usePerformanceMonitor'

// Track component renders
function MyComponent() {
  useRenderPerformance('MyComponent')
  // ...
}

// Track async operations
const { execute, isLoading, duration } = useAsyncPerformance(
  'load_user_data',
  async () => await fetchUserData()
)
```

### Web Vitals Tracking

Automatic tracking of Core Web Vitals with enhanced context:

```typescript
import { useWebVitals } from '@/hooks/usePerformanceMonitor'

function App() {
  useWebVitals() // Automatically tracks LCP, FID, CLS
  // ...
}
```

## Monitoring Dashboard Access

### Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select `altus` project
3. Navigate to:
   - **Analytics** tab for visitor data and custom events
   - **Speed Insights** tab for Web Vitals
   - **Logs** tab for runtime logs and errors

### Sentry Dashboard
1. Go to your Sentry project dashboard
2. Monitor:
   - **Errors**: Real-time error reporting
   - **Performance**: Transaction tracking
   - **Replays**: Session recordings for debugging

## Vercel MCP Tools Integration

With the Vercel MCP server now configured, you can monitor deployments directly from development:

```typescript
// Get runtime logs for debugging
mcp_call_tool('vercel', 'get_runtime_logs', {
  projectId: 'prj_ulhX3mVSm4Y4QPlYANSncSHFo7jd',
  teamId: 'team_L6M2SSTP3OcjS3ToYujgNXOe',
  environment: 'production',
  level: ['error'],
  since: '1h'
})

// Get runtime errors for troubleshooting
mcp_call_tool('vercel', 'get_runtime_errors', {
  projectId: 'prj_ulhX3mVSm4Y4QPlYANSncSHFo7jd',
  teamId: 'team_L6M2SSTP3OcjS3ToYujgNXOe',
  since: '24h'
})
```

## Performance Optimization Commands

### Check Deployment Logs
```bash
# View recent error logs
vercel logs --environment production --level error --since 1h

# Stream live logs
vercel logs --follow

# Filter by status code
vercel logs --status-code 500 --since 1h
```

### Monitor Build Performance
```bash
# Inspect deployment details
vercel inspect <deployment-url>

# View build logs
vercel inspect <deployment-url> --logs
```

### Rollback if Needed
```bash
# Rollback to previous deployment
vercel rollback <deployment-id>

# List recent deployments
vercel list
```

## Monitoring Best Practices

### 1. Set Up Alerts
- Configure Sentry alerts for critical errors
- Set up Vercel project notifications for deployment failures
- Monitor error rates and performance degradation

### 2. Regular Review
- Weekly review of error trends in Sentry
- Monthly analysis of Web Vitals in Speed Insights
- Quarterly review of custom event patterns

### 3. Performance Budgets
- Monitor LCP (target: < 2.5s)
- Track FID (target: < 100ms)
- Watch CLS (target: < 0.1)

### 4. Error Response
- Critical errors: Immediate response within 1 hour
- High priority: Response within 4 hours
- Medium priority: Response within 24 hours

## Environment Variables for Monitoring

Ensure these environment variables are configured in Vercel:

```bash
# Sentry Configuration
VITE_SENTRY_DSN=your-sentry-dsn
VITE_SENTRY_ENV=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.02
VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0
VITE_SENTRY_SEND_DEFAULT_PII=false

# Release Tracking
VITE_RELEASE=auto-detected-from-git
VITE_VERCEL_GIT_COMMIT_SHA=auto-detected-by-vercel
```

## Troubleshooting

### Analytics Not Showing
1. Check if domain is in the `shouldEnableVercelInsights()` function
2. Verify deployment is to production environment
3. Check browser console for analytics errors

### Performance Issues
1. Check Speed Insights for slow routes
2. Review runtime logs for errors
3. Use Sentry session replays to identify user issues

### Deployment Failures
1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Review dependency changes

## Next Steps

1. **Enable Vercel Analytics** - See `docs/ENABLE_VERCEL_MONITORING.md` for manual setup
2. **Set up log drains** for centralized logging (optional)
3. **Configure deployment protection** for production
4. **Set up monitoring alerts** for critical metrics
5. **Review performance baseline** and set improvement targets

### ⚠️ Important Note
The Vercel MCP server currently doesn't support project configuration (enabling Web Analytics/Speed Insights). You'll need to enable these features manually via:
- **Vercel Dashboard** (recommended) - See setup guide
- **Vercel REST API** - Using your API token
- **Vercel CLI** - Install locally and use provided scripts

Once enabled, your React components will automatically start sending data.

## Support Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)
- [Sentry Documentation](https://docs.sentry.io/)
- [Vercel Monitoring Best Practices](https://vercel.com/docs/observability)