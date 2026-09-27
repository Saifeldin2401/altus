/**
 * Performance Monitoring Hooks
 * 
 * Custom hooks for monitoring application performance and user interactions
 */

import { useEffect, useRef, useState } from 'react'
import { trackPerformance, trackEngagement, trackWebVital } from '@/lib/vercelMonitoring'

/**
 * Hook to monitor component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>()
  const [renderCount, setRenderCount] = useState(0)

  useEffect(() => {
    renderStartTime.current = performance.now()
    setRenderCount(prev => prev + 1)

    return () => {
      if (renderStartTime.current) {
        const duration = performance.now() - renderStartTime.current
        if (duration > 100) { // Only track slow renders (>100ms)
          trackPerformance(`render_${componentName}`, duration, {
            render_count: renderCount + 1,
          })
        }
      }
    }
  })

  return { renderCount }
}

/**
 * Hook to monitor async operation performance
 */
export function useAsyncPerformance<T extends (...args: unknown[]) => Promise<unknown>>(
  operationName: string,
  fn: T
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  const execute = async (...args: Parameters<T>) => {
    setIsLoading(true)
    setError(null)
    const startTime = performance.now()

    try {
      const result = await fn(...args)
      const operationDuration = performance.now() - startTime
      setDuration(operationDuration)
      trackPerformance(operationName, operationDuration, { status: 'success' })
      return result
    } catch (err) {
      const operationDuration = performance.now() - startTime
      setDuration(operationDuration)
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      trackPerformance(operationName, operationDuration, {
        status: 'error',
        error: error.message,
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return { execute, isLoading, error, duration }
}

/**
 * Hook to track user interaction timing
 */
export function useInteractionTiming(interactionName: string) {
  const [startTime, setStartTime] = useState<number | null>(null)
  const [interactions, setInteractions] = useState<number>(0)

  const start = () => {
    setStartTime(performance.now())
  }

  const end = (success = true) => {
    if (startTime === null) return

    const duration = performance.now() - startTime
    trackEngagement(interactionName, 'timing', duration)
    trackPerformance(`interaction_${interactionName}`, duration, {
      success,
      interaction_count: interactions + 1,
    })
    setStartTime(null)
    setInteractions(prev => prev + 1)
  }

  return { start, end, isTracking: startTime !== null, interactions }
}

/**
 * Hook to monitor memory usage (when available)
 */
export function useMemoryMonitor(interval = 5000) {
  const [memoryUsage, setMemoryUsage] = useState<{
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null>(null)

  useEffect(() => {
    if (!('memory' in performance)) return

    const updateMemory = () => {
      const memory = (performance as unknown as { memory: PerformanceMemory }).memory
      setMemoryUsage({
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      })
    }

    updateMemory()
    const intervalId = setInterval(updateMemory, interval)

    return () => clearInterval(intervalId)
  }, [interval])

  return memoryUsage
}

/**
 * Hook to track Core Web Vitals
 */
export function useWebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          if (lastEntry) {
            const value = lastEntry.renderTime || lastEntry.loadTime
            const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
            trackWebVital('LCP', value, rating)
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        return () => lcpObserver.disconnect()
      } catch (e) {
        console.warn('Failed to observe LCP:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          const value = entry.processingStart - entry.startTime
          const rating = value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor'
          trackWebVital('FID', value, rating)
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
      return () => fidObserver.disconnect()
    } catch (e) {
      console.warn('Failed to observe FID:', e)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor'
        trackWebVital('CLS', clsValue, rating)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      return () => clsObserver.disconnect()
    } catch (e) {
      console.warn('Failed to observe CLS:', e)
    }
  }, [])
}

/**
 * Hook to track network performance
 */
export function useNetworkPerformance() {
  const [networkInfo, setNetworkInfo] = useState<{
    effectiveType: string
    downlink: number
    rtt: number
    saveData: boolean
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('connection' in navigator)) return

    const connection = (navigator as unknown as { connection: NetworkInformation }).connection

    const updateNetworkInfo = () => {
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      })
    }

    updateNetworkInfo()
    connection.addEventListener('change', updateNetworkInfo)

    return () => connection.removeEventListener('change', updateNetworkInfo)
  }, [])

  return networkInfo
}

/**
 * Hook to track API call performance
 */
export function useApiPerformance() {
  const [apiCalls, setApiCalls] = useState<Array<{
    url: string
    method: string
    duration: number
    status: number
    timestamp: number
  }>>([])

  const trackApiCall = (url: string, method: string, duration: number, status: number) => {
    const call = {
      url,
      method,
      duration,
      status,
      timestamp: Date.now(),
    }

    setApiCalls(prev => [...prev.slice(-9), call]) // Keep last 10 calls

    trackPerformance(`api_${method.toLowerCase()}`, duration, {
      url,
      status,
      status_category: status >= 500 ? 'server_error' : status >= 400 ? 'client_error' : 'success',
    })
  }

  const getAverageDuration = () => {
    if (apiCalls.length === 0) return 0
    const total = apiCalls.reduce((sum, call) => sum + call.duration, 0)
    return total / apiCalls.length
  }

  const getErrorRate = () => {
    if (apiCalls.length === 0) return 0
    const errors = apiCalls.filter(call => call.status >= 400).length
    return (errors / apiCalls.length) * 100
  }

  return { trackApiCall, apiCalls, getAverageDuration, getErrorRate }
}