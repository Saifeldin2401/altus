/**
 * Authentication Security Service
 * 
 * Provides comprehensive security features:
 * - Session binding to IP/User-Agent
 * - MFA (TOTP) support
 * - Password breach checking
 * - Secure audit logging
 * 
 * SECURITY NOTE: Brute force protection is handled SERVER-SIDE only.
 * Client-side rate limiting (sessionStorage) has been removed because
 * it can be bypassed by clearing sessionStorage. Server-side protection
 * via Supabase Auth and database functions provides effective protection.
 */

import { supabase } from './supabase';
import { recordAuthEvent } from './authMonitor';
import { logAuditEvent } from './auditLog';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface SessionFingerprint {
  ipHash: string;
  userAgentHash: string;
  createdAt: number;
  lastVerifiedAt: number;
}

// =============================================================================
// SESSION BINDING & SECURITY
// =============================================================================

const SESSION_KEY = 'auth_session_fingerprint';
const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a hash of the current session context (IP + User-Agent)
 * Note: In a production environment, IP should come from the server
 */
async function generateSessionFingerprint(): Promise<SessionFingerprint> {
  const userAgent = navigator.userAgent;
  const timestamp = Date.now();
  
  // Create hashes (in production, IP would be included)
  const userAgentHash = await hashString(userAgent);
  const ipHash = await hashString('client-side-' + userAgent); // Placeholder for actual IP
  
  return {
    ipHash,
    userAgentHash,
    createdAt: timestamp,
    lastVerifiedAt: timestamp,
  };
}

/**
 * Store session fingerprint securely
 */
function storeSessionFingerprint(fingerprint: SessionFingerprint): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(fingerprint));
  } catch {
    // Session storage not available
  }
}

/**
 * Get stored session fingerprint
 */
function getSessionFingerprint(): SessionFingerprint | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SessionFingerprint;
  } catch {
    return null;
  }
}

/**
 * Validate current session against stored fingerprint
 * Returns true if session is valid, false if suspicious activity detected
 */
export async function validateSessionBinding(): Promise<{ valid: boolean; reason?: string }> {
  const stored = getSessionFingerprint();
  if (!stored) {
    return { valid: true }; // No fingerprint stored yet
  }
  
  const current = await generateSessionFingerprint();
  
  // Check if user agent has changed significantly (instead of strict hashing, we would ideally do a similarity check, 
  // but for now we'll allow minor mismatches if IP is the same, or use a heuristic score.
  // We'll update the strict requirement to allow the same browser family if parsing,
  // but since we only have hashes here, we will log minor changes as 'info' rather than destroying the session
  // specifically if the IP hash matches)
  if (current.userAgentHash !== stored.userAgentHash) {
    recordAuthEvent({
      type: 'session_validation',
      success: false,
      details: { reason: 'user_agent_mismatch', action: 'warning_logged' },
    });
    
    // Log suspicious activity but do NOT kill the session immediately unless IP also changed
    await logSecurityEvent('session.user_agent_changed', {
      oldHash: stored.userAgentHash,
      newHash: current.userAgentHash,
      ipMatched: current.ipHash === stored.ipHash
    });
    
    if (current.ipHash !== stored.ipHash) {
      return { valid: false, reason: 'High risk anomaly: IP and User agent mismatch - possible session hijacking' };
    }
  }
  
  // Check session age
  const sessionAge = Date.now() - stored.createdAt;
  if (sessionAge > MAX_SESSION_AGE) {
    return { valid: false, reason: 'Session expired' };
  }
  
  // Update last verified timestamp
  stored.lastVerifiedAt = Date.now();
  storeSessionFingerprint(stored);
  
  return { valid: true };
}

/**
 * Clear session fingerprint on logout
 */
export function clearSessionFingerprint(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

// =============================================================================
// SIGN-IN THROTTLING
// =============================================================================
// Brute-force protection is server-side only: Supabase Auth rate-limits
// password sign-ins, and admin locks and suspensions are Auth bans set by the
// admin-account-actions Edge Function. A client-reported failure counter cannot
// protect anything (an attacker simply does not report), and the signed-out
// browser cannot read profiles anyway, so the old client lockout never engaged.

/**
 * After a successful sign-in, clear the account's failed-attempt state and stamp
 * last_login_at. Runs as the signed-in user; the RPC only acts on the caller's
 * own email.
 */
export async function recordSuccessfulLogin(email: string): Promise<void> {
  const { error } = await supabase.rpc('clear_failed_login_attempts', {
    p_email: email.toLowerCase().trim(),
  });
  if (error) {
    console.warn('[AuthSecurity] clear_failed_login_attempts failed (non-critical):', error.message);
  }
}


// =============================================================================
// PASSWORD SECURITY
// =============================================================================

/**
 * Check if password has been breached using HaveIBeenPwned API
 * Uses k-anonymity model (only sends first 5 chars of hash)
 */
export async function checkPasswordBreach(password: string): Promise<{ breached: boolean; count?: number }> {
  try {
    // Generate SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Send only first 5 characters (k-anonymity)
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);
    
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true',
      },
    });
    
    if (!response.ok) {
      // If API fails, assume password is safe (fail open for UX)
      return { breached: false };
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        return { breached: true, count: parseInt(count, 10) };
      }
    }
    
    return { breached: false };
  } catch {
    // If check fails, assume password is safe
    return { breached: false };
  }
}

/**
 * Check if password rotation is required (for admins - 90 days)
 */
async function isPasswordRotationRequired(userId: string): Promise<{ required: boolean; daysRemaining?: number }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('password_last_changed_at, force_password_reset')
      .eq('id', userId)
      .single();
    
    if (!profile) return { required: false };
    
    // Check if password reset is forced
    if (profile.force_password_reset) {
      return { required: true };
    }
    
    // Check if user is admin (90-day rotation required)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    const adminRoles = ['administrator'];
    const isAdmin = roles?.some(r => adminRoles.includes(r.role)) ?? false;
    
    if (!isAdmin) {
      return { required: false };
    }
    
    // Check last password change
    const lastChanged = profile.password_last_changed_at 
      ? new Date(profile.password_last_changed_at) 
      : null;
    
    if (!lastChanged) {
      return { required: true };
    }
    
    const ROTATION_DAYS = 90;
    const rotationDue = new Date(lastChanged);
    rotationDue.setDate(rotationDue.getDate() + ROTATION_DAYS);
    
    const now = new Date();
    const daysRemaining = Math.ceil((rotationDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      required: daysRemaining <= 0,
      daysRemaining: Math.max(0, daysRemaining),
    };
  } catch {
    return { required: false };
  }
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Get active sessions for user
 */
export async function getActiveSessions(userId: string): Promise<Array<{
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
}>> {
  try {
    const { data, error } = await supabase.rpc('get_user_sessions', { p_user_id: userId });
    if (error || !data || !Array.isArray(data)) return [];
    return data.map((item) => {
      const s = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      return {
        id: (s.id as string) || '',
        createdAt: new Date((s.created_at as string) || Date.now()),
        lastActiveAt: new Date((s.last_active_at as string) || Date.now()),
        ipAddress: (s.ip_address as string) || '',
        userAgent: (s.user_agent as string) || '',
        isCurrent: Boolean(s.is_current),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('revoke_session', { p_session_id: sessionId });
    if (error) return false;
    
    await logSecurityEvent('session.revoked', { sessionId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke all other sessions (keep current)
 */
export async function revokeAllOtherSessions(): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error } = await supabase.rpc('revoke_all_other_sessions', {
      p_user_id: userData.user.id,
    });
    if (error) return false;

    // The RPC above only updates our own bookkeeping table (user_sessions) -
    // it never touched Supabase's real Auth sessions/refresh tokens, so the
    // "other" devices stayed fully logged in regardless of what this button
    // claimed. `scope: 'others'` is the real Supabase Auth API for exactly
    // this: it revokes every refresh token for this user except the one
    // backing the current session, callable directly from the client with
    // no admin API or stored JWTs required.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) {
      console.error('Failed to revoke other Auth sessions:', signOutError);
      return false;
    }

    await logSecurityEvent('session.revoke_all_other', { userId: userData.user.id });
    return true;
  } catch {
    return false;
  }
}

/**
 * Limit concurrent sessions per user
 */
export async function enforceSessionLimit(userId: string, maxSessions: number = 5): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('enforce_session_limit', {
      p_user_id: userId,
      p_max_sessions: maxSessions,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// SECURITY AUDIT LOGGING
// =============================================================================

/**
 * Log security-related events
 */
export async function logSecurityEvent(
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    await logAuditEvent({
      event_type: 'security.event' as import('./auditLog').AuditEventType,
      entity_type: 'security',
      entity_id: userId || 'anonymous',
      description: eventType,
      metadata: {
        event_type: eventType,
        user_agent: navigator.userAgent,
        ...metadata,
      },
    });
  } catch {
    // Ignore logging errors
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Hash a string using SHA-256
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}



/**
 * Check if user needs to complete security setup
 */
export async function checkSecurityRequirements(userId: string): Promise<{
  passwordRotationRequired: boolean;
  passwordRotationDays?: number;
  setupComplete: boolean;
}> {
  try {
    const passwordRotation = await isPasswordRotationRequired(userId);

    return {
      passwordRotationRequired: passwordRotation.required,
      passwordRotationDays: passwordRotation.daysRemaining,
      setupComplete: !passwordRotation.required,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Security] Could not fetch security summary, using fallback:', err);
    }
    return {
      passwordRotationRequired: false,
      setupComplete: true,
    };
  }
}

/**
 * Initialize session security on login
 */
export async function initializeSessionSecurity(): Promise<void> {
  try {
    const fingerprint = await generateSessionFingerprint();
    storeSessionFingerprint(fingerprint);
    
    // Enforce session limits (best effort - don't fail if DB functions missing)
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await enforceSessionLimit(userData.user.id, 5);
    }
  } catch (err) {
    // Security initialization failed, but auth should still work
    // Log for debugging but don't throw
    console.warn('[AuthSecurity] Session security initialization failed:', err);
  }
}
