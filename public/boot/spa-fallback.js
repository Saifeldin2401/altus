// Served by 404.html: sends unknown paths back into the SPA as /?__redirect=...
// (restored by restoreSpaRedirectFromSearch in main.tsx). Kept out of 404.html
// because the CSP does not allow inline scripts.
(() => {
  const path = window.location.pathname + window.location.search + window.location.hash
  window.location.replace('/?__redirect=' + encodeURIComponent(path))
})()
