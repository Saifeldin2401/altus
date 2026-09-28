import { hasAuthRecoveryParams, normalizePathname } from './runtimeRecovery'
import { safeLocalStorage } from './storage'

const AUTH_FLOW_STATE_KEY = '__altus_auth_flow_state__'
const AUTH_FLOW_TTL_MS = 15 * 60 * 1000

// ── Cross-tab recovery flow signal ──────────────────────────────────────────
// Written to localStorage (not sessionStorage) so every tab can see it.
// Prevents the "unregistered user → signOut()" guard in PublicOnlyRoute,
// ProtectedRoute, and RootIndex from killing a recovery session that was
// initiated in a different tab.
const RECOVERY_FLOW_ACTIVE_KEY = '__altus_recovery_flow_active__'
const RECOVERY_FLOW_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Mark that a password-recovery (or invite) flow is active.
 * Called from onAuthStateChange when the event is PASSWORD_RECOVERY.
 */
export function setRecoveryFlowActive(): void {
  try {
    safeLocalStorage.setItem(RECOVERY_FLOW_ACTIVE_KEY, String(Date.now()))
  } catch {
    // Storage unavailable — best-effort
  }
}

/**
 * Clear the cross-tab recovery flow flag.
 * Called when the flow completes (password updated) or is abandoned.
 */
export function clearRecoveryFlowActive(): void {
  try {
    safeLocalStorage.removeItem(RECOVERY_FLOW_ACTIVE_KEY)
  } catch {
    // Storage unavailable
  }
}

/**
 * Check whether a recovery flow is currently active in any tab.
 * Returns true if the flag was set within the last 15 minutes.
 */
export function isRecoveryFlowActive(): boolean {
  try {
    const raw = safeLocalStorage.getItem(RECOVERY_FLOW_ACTIVE_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (Number.isNaN(ts)) {
      safeLocalStorage.removeItem(RECOVERY_FLOW_ACTIVE_KEY)
      return false
    }
    if (Date.now() - ts > RECOVERY_FLOW_TTL_MS) {
      safeLocalStorage.removeItem(RECOVERY_FLOW_ACTIVE_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

const AUTH_FLOW_PATHS = {
  'reset-password': '/reset-password',
  'complete-invite': '/complete-invite',
} as const

type AuthFlowName = keyof typeof AUTH_FLOW_PATHS

interface StoredAuthFlowState {
  flow: AuthFlowName
  path: string
  updatedAt: number
}

function getDefaultFlowPath(flow: AuthFlowName) {
  return AUTH_FLOW_PATHS[flow]
}

function sanitizeFlowPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://phg-connect.com'
    const parsed = candidate.startsWith('/')
      ? new URL(candidate, base)
      : new URL(candidate)

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function readStoredAuthFlowState(): StoredAuthFlowState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(AUTH_FLOW_STATE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredAuthFlowState>
    const flow = parsed.flow
    const path = sanitizeFlowPath(parsed.path)
    const updatedAt = Number(parsed.updatedAt ?? 0)

    if (!flow || !(flow in AUTH_FLOW_PATHS) || !path || !updatedAt) {
      window.sessionStorage.removeItem(AUTH_FLOW_STATE_KEY)
      return null
    }

    if (Date.now() - updatedAt > AUTH_FLOW_TTL_MS) {
      window.sessionStorage.removeItem(AUTH_FLOW_STATE_KEY)
      return null
    }

    return {
      flow,
      path,
      updatedAt,
    }
  } catch {
    return null
  }
}

export function setAuthFlowState(flow: AuthFlowName, path?: string, location?: { pathname: string; search: string; hash: string }) {
  if (typeof window === 'undefined') return

  const loc = location ?? window.location
  const fallbackPath = `${loc.pathname}${loc.search}${loc.hash}` || getDefaultFlowPath(flow)
  const sanitizedPath = sanitizeFlowPath(path) ?? fallbackPath

  try {
    window.sessionStorage.setItem(
      AUTH_FLOW_STATE_KEY,
      JSON.stringify({
        flow,
        path: sanitizedPath,
        updatedAt: Date.now(),
      } satisfies StoredAuthFlowState)
    )
  } catch {
    // Ignore storage errors in recovery mode.
  }
}

export function clearAuthFlowState(flow?: AuthFlowName) {
  if (typeof window === 'undefined') return

  try {
    const current = readStoredAuthFlowState()
    if (!current) return
    if (flow && current.flow !== flow) return
    window.sessionStorage.removeItem(AUTH_FLOW_STATE_KEY)
  } catch {
    // Ignore storage errors in recovery mode.
  }
}

export function getAuthFlowRedirectPath(): string | null {
  return readStoredAuthFlowState()?.path ?? null
}

export function shouldSuppressAuthenticatedAppState(
  pathname: string,
  search = '',
  hash = '',
  storedPath?: string,
): boolean {
  const currentPath = normalizePathname(pathname)

  // Recovery params (token_hash, recovery/invite type) should only suppress authenticated
  // state when on dedicated recovery routes (/reset-password, /complete-invite).
  // Normal sign-in routes (/login, /) with OAuth callback codes must NOT be suppressed.
  const isDedicatedRecoveryPath =
    currentPath === '/reset-password' || currentPath.startsWith('/reset-password/') ||
    currentPath === '/complete-invite' || currentPath.startsWith('/complete-invite/')

  if (isDedicatedRecoveryPath && hasAuthRecoveryParams(search, hash)) {
    return true
  }

  const activeFlow = readStoredAuthFlowState()
  if (!activeFlow) return false

  // Use stored path if provided (for testing), otherwise use the flow's default path
  const flowPath = storedPath ? normalizePathname(storedPath) : getDefaultFlowPath(activeFlow.flow)
  return currentPath === flowPath || currentPath.startsWith(`${flowPath}/`)
}
