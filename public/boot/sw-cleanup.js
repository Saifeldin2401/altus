// One-time cleanup of service workers and caches left by older builds.
// The app's own /sw.js (push notifications) is kept: unregistering it would
// destroy every push subscription, and it prunes stale caches itself when it
// activates. Mirrors clearLegacyServiceWorkers in src/lib/runtimeRecovery.ts.
(() => {
  const cleanupKey = '__altus_index_cleanup_done__'
  const appServiceWorkerPath = '/sw.js'
  const legacyCachePrefixes = ['prime-hotels-', 'phg-intranet-', 'altus-hotels-', 'altus-intranet-', 'workbox-']

  const isLegacyRegistration = (registration) => {
    const worker = registration.active || registration.waiting || registration.installing
    if (!worker) return true
    try {
      return new URL(worker.scriptURL).pathname !== appServiceWorkerPath
    } catch {
      return true
    }
  }

  window.addEventListener('load', () => {
    window.setTimeout(async () => {
      try {
        if (sessionStorage.getItem(cleanupKey) === '1') return
        sessionStorage.setItem(cleanupKey, '1')
      } catch {
        // Continue even if sessionStorage is unavailable.
      }

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.allSettled(registrations.filter(isLegacyRegistration).map((registration) => registration.unregister()))
        }

        if ('caches' in window) {
          const cacheKeys = await caches.keys()
          const staleCacheKeys = cacheKeys.filter((key) => legacyCachePrefixes.some((prefix) => key.startsWith(prefix)))
          await Promise.allSettled(staleCacheKeys.map((key) => caches.delete(key)))
        }
      } catch {
        // Passive cleanup only. Ignore failures.
      }
    }, 0)
  }, { once: true })
})()
