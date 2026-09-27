// Canonical host: www.phg-connect.com -> phg-connect.com (loaded before the app;
// kept out of index.html so the CSP needs no 'unsafe-inline' for scripts).
(() => {
  if (window.location.hostname !== 'www.phg-connect.com') return

  const hostRedirectKey = '__altus_www_host_redirect_attempted__'
  try {
    if (sessionStorage.getItem(hostRedirectKey) === '1') return
    sessionStorage.setItem(hostRedirectKey, '1')
  } catch {
    // Continue even if sessionStorage is unavailable.
  }

  const target = new URL(window.location.href)
  target.hostname = 'phg-connect.com'
  window.location.replace(target.toString())
})()
