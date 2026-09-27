// One-time cleanup of service workers and caches left by older builds.
(() => {
  const cleanupKey = '__altus_index_cleanup_done__'

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
          await Promise.allSettled(registrations.map((registration) => registration.unregister()))
        }

        if ('caches' in window) {
          const cacheKeys = await caches.keys()
          const staleCacheKeys = cacheKeys.filter((key) => key.startsWith('altus-') || key.startsWith('prime-hotels-') || key.startsWith('phg-intranet-'))
          await Promise.allSettled(staleCacheKeys.map((key) => caches.delete(key)))
        }
      } catch {
        // Passive cleanup only. Ignore failures.
      }
    }, 0)
  }, { once: true })
})()
