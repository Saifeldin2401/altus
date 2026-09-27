/**
 * Vercel Monitoring Configuration
 * 
 * This module provides enhanced monitoring capabilities for Vercel deployments
 * including custom analytics events, performance tracking, and error reporting.
 */

import { useEffect } from 'react'

/**
 * Custom analytics events for tracking user interactions
 */
export const AnalyticsEvents = {
  // Course interactions
  COURSE_STARTED: 'course_started',
  COURSE_COMPLETED: 'course_completed',
  LESSON_COMPLETED: 'lesson_completed',
  QUIZ_ATTEMPTED: 'quiz_attempted',
  QUIZ_PASSED: 'quiz_passed',
  QUIZ_FAILED: 'quiz_failed',

  // Document interactions
  DOCUMENT_VIEWED: 'document_viewed',
  DOCUMENT_DOWNLOADED: 'document_downloaded',
  DOCUMENT_ACKNOWLEDGED: 'document_acknowledged',

  // User actions
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',

  // System events
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
  OFFLINE_MODE_ENTERED: 'offline_mode_entered',
  OFFLINE_MODE_EXITED: 'offline_mode_exit',
  SERVICE_WORKER_UPDATED: 'service_worker_updated',
} as const

export type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents]

/**
 * Track custom analytics events
 */
export function trackEvent(eventName: AnalyticsEventName, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  try {
    // Use Vercel Analytics if available
    if (window.va) {
      window.va('event', { name: eventName, data: properties })
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', eventName, properties)
    }
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error)
  }
}

/**
 * Hook to track page view with custom properties
 */
export function usePageTracking(pageName: string, properties?: Record<string, unknown>) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if (window.va) {
        window.va('page', { name: pageName, data: properties })
      }
    } catch (error) {
      console.error('[Analytics] Failed to track page:', error)
    }
  }, [pageName, properties])
}

/**
 * Performance monitoring for critical operations
 */
export function trackPerformance(operation: string, duration: number, metadata?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  try {
    if (window.va) {
      window.va('event', {
        name: 'performance_metric',
        data: {
          operation,
          duration_ms: duration,
          ...metadata,
        },
      })
    }

    if (import.meta.env.DEV) {
      console.log('[Performance]', operation, `${duration}ms`, metadata)
    }
  } catch (error) {
    console.error('[Performance] Failed to track:', error)
  }
}

/**
 * Track user engagement metrics
 */
export function trackEngagement(action: string, target: string, value?: number) {
  if (typeof window === 'undefined') return

  try {
    if (window.va) {
      window.va('event', {
        name: 'user_engagement',
        data: {
          action,
          target,
          value,
        },
      })
    }
  } catch (error) {
    console.error('[Engagement] Failed to track:', error)
  }
}

/**
 * Wrap async functions with performance tracking
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now()
    try {
      const result = await fn(...args)
      const duration = performance.now() - startTime
      trackPerformance(operationName, duration, { status: 'success' })
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      trackPerformance(operationName, duration, { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }) as T
}

/**
 * Web Vitals monitoring enhancements
 */
export function trackWebVital(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor') {
  if (typeof window === 'undefined') return

  try {
    if (window.va) {
      window.va('event', {
        name: 'web_vital',
        data: {
          metric: name,
          value,
          rating,
        },
      })
    }
  } catch (error) {
    console.error('[Web Vitals] Failed to track:', error)
  }
}

/**
 * Network status monitoring
 */
export function trackNetworkStatus(online: boolean) {
  if (typeof window === 'undefined') return

  try {
    if (window.va) {
      window.va('event', {
        name: 'network_status_change',
        data: { online },
      })
    }
  } catch (error) {
    console.error('[Network] Failed to track status:', error)
  }
}

/**
 * Custom error tracking with context
 */
export function trackError(error: Error, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  try {
    if (window.va) {
      window.va('event', {
        name: 'custom_error',
        data: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          ...context,
        },
      })
    }
  } catch (e) {
    console.error('[Error Tracking] Failed to track:', e)
  }
}