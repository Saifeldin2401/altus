import { supabase } from '@/lib/supabase'

/**
 * Personal fields on public.profiles are not selectable through the API
 * (column privileges, migration 20260927091000). Selecting them - or `*` -
 * fails with 42501. They come only from get_profiles_private(), which returns
 * rows for the member themselves, an owner/admin of a shared organization, or
 * a platform super admin, and silently omits everyone else.
 */
export const PRIVATE_PROFILE_FIELDS = [
  'phone',
  'date_of_birth',
  'emergency_contact_name',
  'emergency_contact_phone',
  'nationality',
  'blood_group',
  'iqama_number',
  'iqama_expiry',
  'national_id',
  'salary_grade',
  'contract_end_date',
  'suspend_reason',
] as const

export type PrivateProfileFields = {
  [K in (typeof PRIVATE_PROFILE_FIELDS)[number]]: string | null
}

/** Every profile column API roles may select - use instead of `*`. */
export const PUBLIC_PROFILE_COLUMNS = [
  'id', 'email', 'full_name', 'avatar_url', 'hire_date', 'is_active', 'created_at', 'updated_at',
  'job_title', 'reporting_to', 'is_deleted', 'is_temp_password', 'password_initialized',
  'password_last_changed_at', 'staff_id', 'suspended_until', 'account_status', 'suspended_at',
  'suspended_by', 'last_login_at', 'force_password_reset', 'employment_type', 'bio',
  'phone_extension', 'failed_login_attempts', 'locked_until', 'mfa_required', 'language',
  'organization_id', 'show_on_leaderboard', 'learner_welcome_seen_at',
].join(', ')

/**
 * Private fields for the given users, keyed by user id. Users the caller may
 * not see are simply absent. Never throws: a failure degrades to "no private
 * fields" so directory and login screens keep working.
 */
export async function fetchPrivateProfiles(userIds: string[]): Promise<Map<string, PrivateProfileFields>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.rpc('get_profiles_private', { p_user_ids: ids })
  if (error) {
    console.warn('Could not load private profile fields:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((row) => [row.id, row as PrivateProfileFields]))
}
