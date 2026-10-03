import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildCanonicalUrl,
  canonicalizeAppUrl,
  clearLegacyServiceWorkers,
  hasAuthRecoveryParams,
  isAuthSensitivePathname,
  normalizePathname,
  shouldProtectAuthEntry,
} from './runtimeRecovery'

describe('runtimeRecovery', () => {
  it('normalizes trailing slashes for auth-sensitive paths', () => {
    expect(normalizePathname('/reset-password/')).toBe('/reset-password')
    expect(normalizePathname('/')).toBe('/')
    expect(isAuthSensitivePathname('/complete-invite/')).toBe(true)
    expect(isAuthSensitivePathname('/public')).toBe(false)
  })

  it('detects reset and invite tokens in the URL', () => {
    expect(hasAuthRecoveryParams('?token_hash=abc&type=recovery', '')).toBe(true)
    expect(hasAuthRecoveryParams('?code=abc', '')).toBe(true)
    expect(hasAuthRecoveryParams('', '#access_token=a&refresh_token=b')).toBe(true)
    expect(hasAuthRecoveryParams('?page=home', '')).toBe(false)
  })

  it('protects auth-sensitive entries', () => {
    expect(shouldProtectAuthEntry('/reset-password', '?token_hash=abc&type=recovery', '')).toBe(true)
    expect(shouldProtectAuthEntry('/complete-invite', '', '')).toBe(true)
    expect(shouldProtectAuthEntry('/verify', '', '')).toBe(false)
  })

  it('canonicalizes www hosts to the apex domain', () => {
    expect(canonicalizeAppUrl('https://www.phg-connect.com/some/path?x=1')).toBe('https://phg-connect.com')
    expect(canonicalizeAppUrl('https://phg-connect.com')).toBe('https://phg-connect.com')
    expect(canonicalizeAppUrl('http://localhost:5173')).toBe('https://phg-connect.com')
    expect(canonicalizeAppUrl(undefined)).toBe('https://phg-connect.com')
    // www-stripping is host-agnostic, not hardcoded to one brand domain --
    // guards against this exact regression recurring on the next rebrand.
    expect(canonicalizeAppUrl('https://www.example.com/path')).toBe('https://example.com')
  })

  it('builds canonical URLs with the preserved route context', () => {
    expect(buildCanonicalUrl('/reset-password', '?token_hash=abc&type=recovery', '#step=1'))
      .toBe('https://phg-connect.com/reset-password?token_hash=abc&type=recovery#step=1')
  })
})

describe('clearLegacyServiceWorkers', () => {
  const registration = (scriptURL: string | null) => ({
    active: scriptURL ? { scriptURL } : null,
    waiting: null,
    installing: null,
    unregister: vi.fn().mockResolvedValue(true),
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('keeps the app service worker and removes only legacy ones', async () => {
    const app = registration('https://phg-connect.com/sw.js')
    const legacy = registration('https://phg-connect.com/registerSW.js')
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([app, legacy]) },
    })
    const cacheDelete = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['altus-v1', 'workbox-precache-v2', 'altus-intranet-old']),
      delete: cacheDelete,
    })

    await expect(clearLegacyServiceWorkers()).resolves.toBe(true)

    expect(app.unregister).not.toHaveBeenCalled()
    expect(legacy.unregister).toHaveBeenCalledOnce()
    expect(cacheDelete).not.toHaveBeenCalledWith('altus-v1')
    expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v2')
    expect(cacheDelete).toHaveBeenCalledWith('altus-intranet-old')
  })

  it('does nothing when only the app service worker is registered', async () => {
    const app = registration('https://phg-connect.com/sw.js')
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: vi.fn().mockResolvedValue([app]) },
    })

    await expect(clearLegacyServiceWorkers()).resolves.toBe(false)
    expect(app.unregister).not.toHaveBeenCalled()
  })
})
