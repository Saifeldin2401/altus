import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthSession } from '@/contexts/auth/useAuthSession'
import { shouldSuppressAuthenticatedAppState, setAuthFlowState, clearAuthFlowState } from '@/lib/authFlowState'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn(),
      setSession: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

describe('Password Reset & Auth Recovery Session Protection', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  afterEach(() => {
    clearAuthFlowState()
    window.sessionStorage.clear()
    window.localStorage.clear()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('suppresses clearLocalSession signOut when user is on /reset-password', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://phg-connect.com/reset-password'),
    })

    const onCleared = vi.fn()
    const { result } = renderHook(() => useAuthSession())

    await act(async () => {
      await result.current.clearLocalSession('Test clearing session', onCleared)
    })

    // Must NOT call global signOut on recovery routes
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    // Still invokes local onCleared callback to reset local component state if needed
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it('suppresses clearLocalSession signOut when user is on /complete-invite', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://phg-connect.com/complete-invite'),
    })

    const onCleared = vi.fn()
    const { result } = renderHook(() => useAuthSession())

    await act(async () => {
      await result.current.clearLocalSession('Test clearing session', onCleared)
    })

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it('permits clearLocalSession signOut when user is on normal authenticated routes', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('https://phg-connect.com/dashboard'),
    })

    const onCleared = vi.fn()
    const { result } = renderHook(() => useAuthSession())

    await act(async () => {
      await result.current.clearLocalSession('Session expired', onCleared)
    })

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it('correctly suppresses authenticated app state during active reset-password flow', () => {
    const mockLocation = {
      pathname: '/reset-password',
      search: '',
      hash: '',
    }
    setAuthFlowState('reset-password', '/reset-password', mockLocation)

    const shouldSuppress = shouldSuppressAuthenticatedAppState('/reset-password', '', '')
    expect(shouldSuppress).toBe(true)

    const shouldSuppressDashboard = shouldSuppressAuthenticatedAppState('/dashboard', '', '')
    expect(shouldSuppressDashboard).toBe(false)
  })

  it('stores and retrieves last reset email seamlessly in local storage', () => {
    const testEmail = 'staff.member@hotelchain.com'
    window.localStorage.setItem('last_reset_email', testEmail)
    expect(window.localStorage.getItem('last_reset_email')).toBe(testEmail)
  })

  it('correctly handles recovery tokens in hash and query strings', () => {
    const queryUrl = new URL('https://phg-connect.com/reset-password?token=secret123&type=recovery&email=user%40example.com')
    expect(queryUrl.searchParams.get('token')).toBe('secret123')
    expect(queryUrl.searchParams.get('type')).toBe('recovery')
    expect(queryUrl.searchParams.get('email')).toBe('user@example.com')

    const hashUrl = new URL('https://phg-connect.com/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    const hashParams = new URLSearchParams(hashUrl.hash.replace(/^#/, ''))
    expect(hashParams.get('error_code')).toBe('otp_expired')
    expect(decodeURIComponent(hashParams.get('error_description')!.replace(/\+/g, ' '))).toBe('Email link is invalid or has expired')
  })
})
