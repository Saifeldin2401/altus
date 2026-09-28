import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    classifyAuthLinkError,
    withAuthLinkTimeout,
} from '@/lib/authLinkRecovery'
import { clearAuthFlowState, setAuthFlowState } from '@/lib/authFlowState'
import { auditLog } from '@/lib/auditLog'
import { securityConfig } from '@/lib/security-config'
import { SecurityMiddleware, rateLimitConfig } from '@/lib/security-middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { Session } from '@supabase/supabase-js'
import { safeLocalStorage, safeSessionStorage } from '@/lib/storage'
import { REMEMBER_ME_KEY } from '@/hooks/useInactivityTimeout'

type SupportedOtpType = 'recovery'

function isSupportedOtpType(value: string | null): value is SupportedOtpType {
    return value === 'recovery'
}

export default function ResetPassword() {
    const { t } = useTranslation('auth')
    const navigate = useNavigate()
    const { signOut } = useAuth()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [validatingToken, setValidatingToken] = useState(false)
    const [tokenValid, setTokenValid] = useState(false)
    const [serviceUnavailableMessage, setServiceUnavailableMessage] = useState<string | null>(null)
    const [validationNonce, setValidationNonce] = useState(0)
    const validationInFlightRef = useRef(false)
    const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
    const sessionRef = useRef<Session | null>(null)

    const markRecoverySessionActive = useCallback((session: Session) => {
        sessionRef.current = session
        safeSessionStorage.setItem('altus_session_active', 'true')
        safeLocalStorage.setItem(REMEMBER_ME_KEY, 'true')
    }, [])

    const getInitialEmail = () => {
        try {
            const url = new URL(window.location.href)
            const qEmail = url.searchParams.get('email')
            if (qEmail) return qEmail
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            const hEmail = hashParams.get('email')
            if (hEmail) return hEmail
        } catch {
            // ignore
        }
        return safeLocalStorage.getItem('last_reset_email') || ''
    }

    const getInitialUrlError = () => {
        try {
            const url = new URL(window.location.href)
            const qErr = url.searchParams.get('error_description') || url.searchParams.get('error')
            if (qErr) return decodeURIComponent(qErr.replace(/\+/g, ' '))
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            const hErr = hashParams.get('error_description') || hashParams.get('error')
            if (hErr) return decodeURIComponent(hErr.replace(/\+/g, ' '))
        } catch {
            // ignore
        }
        return null
    }

    const [urlErrorDescription, setUrlErrorDescription] = useState<string | null>(getInitialUrlError)

    // Protect against mail scanners prefetching the direct token link.
    const getHasTokenHashInUrl = () => {
        try {
            const url = new URL(window.location.href)
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            const hasError = Boolean(
                url.searchParams.get('error') ||
                url.searchParams.get('error_description') ||
                hashParams.get('error') ||
                hashParams.get('error_description')
            )
            if (hasError) return false

            return Boolean(
                url.searchParams.get('token_hash') ||
                url.searchParams.get('token') ||
                hashParams.get('token_hash') ||
                hashParams.get('token')
            )
        } catch {
            return false
        }
    }
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(getHasTokenHashInUrl)

    const [resendEmail, setResendEmail] = useState(getInitialEmail)
    const [resendLoading, setResendLoading] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const [resendError, setResendError] = useState<string | null>(null)

    useEffect(() => {
        setAuthFlowState('reset-password')
    }, [])

    const hasResetParams = useCallback(() => {
        try {
            const url = new URL(window.location.href)
            const queryParams = url.searchParams
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            return Boolean(
                queryParams.get('code') ||
                queryParams.get('token_hash') ||
                queryParams.get('token') ||
                hashParams.get('code') ||
                hashParams.get('token_hash') ||
                hashParams.get('token') ||
                hashParams.get('access_token')
            )
        } catch {
            return false
        }
    }, [])

    useEffect(() => {
        if (awaitingConfirmation) return

        // Reset in-flight flag on mount/cleanup to prevent stale state on mobile
        validationInFlightRef.current = false

        const checkSession = async () => {
            if (validationInFlightRef.current) return
            validationInFlightRef.current = true
            setValidatingToken(true)
            setServiceUnavailableMessage(null)
            let isTokenCurrentlyValid = false
            let temporaryFailureMessage: string | null = null

            const rememberValidationError = (candidateError: unknown) => {
                const classified = classifyAuthLinkError(candidateError)
                if (classified.kind !== 'invalid_link') {
                    temporaryFailureMessage = AUTH_SERVICE_UNAVAILABLE_MESSAGE
                } else if (candidateError instanceof Error && candidateError.message) {
                    setUrlErrorDescription(candidateError.message)
                }
            }

            try {
                const url = new URL(window.location.href)
                const queryParams = url.searchParams
                const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

                const urlErr = queryParams.get('error_description') || hashParams.get('error_description')
                if (urlErr) {
                    const decoded = decodeURIComponent(urlErr.replace(/\+/g, ' '))
                    setUrlErrorDescription(decoded)
                    setTokenValid(false)
                    setValidatingToken(false)
                    validationInFlightRef.current = false
                    return
                }

                const code = queryParams.get('code') || hashParams.get('code')
                const tokenHash = queryParams.get('token_hash') || queryParams.get('token') || hashParams.get('token_hash') || hashParams.get('token')
                const otpType: SupportedOtpType = 'recovery'

                if (!isTokenCurrentlyValid && code) {
                    const { data, error: exchangeError } = await withAuthLinkTimeout(
                        supabase.auth.exchangeCodeForSession(code),
                        'Password reset session exchange'
                    )

                    if (!exchangeError && data.session) {
                        isTokenCurrentlyValid = true
                        markRecoverySessionActive(data.session)
                        url.searchParams.delete('code')
                        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''))
                        setAuthFlowState('reset-password')
                    } else if (exchangeError) {
                        rememberValidationError(exchangeError)
                    }
                }

                if (!isTokenCurrentlyValid && tokenHash) {
                    const { data, error: verifyError } = await withAuthLinkTimeout(
                        supabase.auth.verifyOtp({
                            token_hash: tokenHash,
                            type: otpType,
                        }),
                        'Password reset token verification'
                    )

                    if (!verifyError && data.session) {
                        isTokenCurrentlyValid = true
                        markRecoverySessionActive(data.session)
                        url.searchParams.delete('token_hash')
                        url.searchParams.delete('token')
                        url.searchParams.delete('type')
                        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''))
                        setAuthFlowState('reset-password')
                    } else if (verifyError) {
                        rememberValidationError(verifyError)
                    }
                }

                if (!isTokenCurrentlyValid) {
                    // Session credentials come from the fragment only - Supabase puts them there
                    // specifically so they never reach the server (no logs, no history, no
                    // Referer leakage). Reading them from the query string as a fallback would
                    // defeat that.
                    const accessToken = hashParams.get('access_token')
                    const refreshToken = hashParams.get('refresh_token')

                    if (accessToken && refreshToken) {
                        const { data, error: setSessionError } = await withAuthLinkTimeout(
                            supabase.auth.setSession({
                                access_token: accessToken,
                                refresh_token: refreshToken,
                            }),
                            'Password reset session restore'
                        )

                        if (!setSessionError && data.session) {
                            isTokenCurrentlyValid = true
                            markRecoverySessionActive(data.session)
                            window.history.replaceState({}, document.title, window.location.pathname)
                            setAuthFlowState('reset-password')
                        } else if (setSessionError) {
                            rememberValidationError(setSessionError)
                        }
                    }
                }

                if (!isTokenCurrentlyValid) {
                    if (sessionRef.current) {
                        isTokenCurrentlyValid = true
                        markRecoverySessionActive(sessionRef.current)
                        setAuthFlowState('reset-password')
                    } else {
                        const { data: { session }, error: sessionError } = await withAuthLinkTimeout(
                            supabase.auth.getSession(),
                            'Password reset session lookup'
                        )

                        if (session?.user) {
                            isTokenCurrentlyValid = true
                            markRecoverySessionActive(session)
                            setAuthFlowState('reset-password')
                        } else if (sessionError) {
                            rememberValidationError(sessionError)
                        }
                    }
                }
            } catch (candidateError) {
                console.error('Token validation error:', candidateError)
                rememberValidationError(candidateError)
            } finally {
                setTokenValid(isTokenCurrentlyValid)
                setServiceUnavailableMessage(isTokenCurrentlyValid ? null : temporaryFailureMessage)
                setValidatingToken(false)
                validationInFlightRef.current = false
            }
        }

        void checkSession()
    }, [awaitingConfirmation, validationNonce])

    useEffect(() => {
        if (!success) {
            setRedirectCountdown(null)
            return
        }

        setRedirectCountdown(3)
        const interval = window.setInterval(() => {
            setRedirectCountdown((value) => {
                if (value === null) return value
                return Math.max(0, value - 1)
            })
        }, 1000)

        return () => {
            window.clearInterval(interval)
        }
    }, [success])

    const handleConfirmClick = () => {
        setAuthFlowState('reset-password')
        setAwaitingConfirmation(false)
    }

    const handleResend = async () => {
        setResendError(null)
        setResendSuccess(false)

        const email = resendEmail.trim().toLowerCase()
        if (!email || !email.includes('@')) {
            setResendError(t('forgot_password.invalid_email', { defaultValue: 'Please enter a valid email address.' }))
            return
        }

        safeLocalStorage.setItem('last_reset_email', email)

        // Rate limiting check
        const rateLimitKey = `auth:password-reset:${email}`
        if (!SecurityMiddleware.rateLimit(rateLimitKey, rateLimitConfig.auth.maxRequests, rateLimitConfig.auth.windowMs)) {
            setResendError(t('reset_password.resend_rate_limited', { defaultValue: 'Too many requests. Please wait a few minutes before trying again.' }))
            return
        }

        setResendLoading(true)
        try {
            const { error: invokeError } = await supabase.functions.invoke('public-forgot-password', {
                body: {
                    email,
                    redirectTo: `${window.location.origin}/reset-password`,
                },
            })

            if (invokeError?.message?.toLowerCase().includes('too many')) {
                setResendError(t('reset_password.resend_rate_limited', { defaultValue: 'Too many requests. Please wait a few minutes before trying again.' }))
                return
            }

            if (invokeError) {
                const classified = classifyAuthLinkError(invokeError)
                if (classified.kind !== 'invalid_link') {
                    setResendError(AUTH_SERVICE_UNAVAILABLE_MESSAGE)
                    return
                }
                setResendError(invokeError.message || t('forgot_password.error', { defaultValue: 'Failed to send reset email. Please try again.' }))
                return
            }

            setResendSuccess(true)
        } catch (candidateError: unknown) {
            console.error('Password reset resend error:', candidateError)
            const classified = classifyAuthLinkError(candidateError)
            setResendError(
                classified.kind === 'service_unavailable'
                    ? AUTH_SERVICE_UNAVAILABLE_MESSAGE
                    : t('forgot_password.error', { defaultValue: 'Failed to send reset email. Please try again.' })
            )
        } finally {
            setResendLoading(false)
        }
    }

    const validatePassword = (pwd: string): string[] => {
        const errors: string[] = []
        const config = securityConfig.auth

        if (pwd.length < config.passwordMinLength) {
            errors.push(`At least ${config.passwordMinLength} characters`)
        }
        if (config.passwordRequireUppercase && !/[A-Z]/.test(pwd)) {
            errors.push('One uppercase letter')
        }
        if (config.passwordRequireLowercase && !/[a-z]/.test(pwd)) {
            errors.push('One lowercase letter')
        }
        if (config.passwordRequireNumbers && !/\d/.test(pwd)) {
            errors.push('One number')
        }
        if (config.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
            errors.push('One special character')
        }

        return errors
    }

    const passwordErrors = validatePassword(password)
    const isPasswordValid = passwordErrors.length === 0 && password.length > 0
    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!isPasswordValid) {
            setError('Please meet all password requirements')
            return
        }

        if (!doPasswordsMatch) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)

        try {
            // Ensure session is active before updating password
            let { data: { session: activeSession } } = await supabase.auth.getSession()

            // If Supabase client lost session but we have our verified sessionRef, restore it
            if (!activeSession && sessionRef.current) {
                console.warn('[ResetPassword] Active session missing from GoTrue client, restoring from cached recovery session...')
                const { data: restored, error: restoreError } = await supabase.auth.setSession({
                    access_token: sessionRef.current.access_token,
                    refresh_token: sessionRef.current.refresh_token,
                })
                if (!restoreError && restored.session) {
                    activeSession = restored.session
                    markRecoverySessionActive(restored.session)
                }
            }

            if (!activeSession) {
                setError(t('reset_password.session_expired', {
                    defaultValue: 'Your password reset session has expired or is invalid. Please request a new password reset link below.'
                }))
                setTokenValid(false)
                return
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password,
            })

            if (updateError) {
                throw updateError
            }

            const { error: finalizeError } = await supabase.rpc('complete_password_reset')
            if (finalizeError) {
                console.warn('Password updated, but failed to finalize reset flags:', finalizeError)
            }

            setSuccess(true)
            await auditLog.passwordChange().catch(() => undefined)

            window.setTimeout(() => {
                signOut().finally(() => {
                    clearAuthFlowState('reset-password')
                    navigate('/login')
                })
            }, 3000)
        } catch (candidateError: unknown) {
            console.error('Password update error:', candidateError)
            const classified = classifyAuthLinkError(candidateError)
            const errorMessage = candidateError instanceof Error ? candidateError.message : ''

            if (errorMessage.toLowerCase().includes('session missing') || classified.kind === 'invalid_link') {
                setError(t('reset_password.session_expired', {
                    defaultValue: 'Your password reset session has expired or is invalid. Please request a new password reset link below.'
                }))
                setTokenValid(false)
            } else {
                setError(
                    classified.kind === 'service_unavailable'
                        ? AUTH_SERVICE_UNAVAILABLE_MESSAGE
                        : (errorMessage || 'Failed to update password. Please try again.')
                )
            }
        } finally {
            setLoading(false)
        }
    }

    const renderWrapper = (content: React.ReactNode) => (
        <div className="min-h-screen flex flex-col items-center justify-center bg-ds-surface-subtle px-4 py-12">
            <div className="w-full max-w-md flex flex-col items-center">
                <div className="mt-16 mb-8 text-center">
                    <img src="/altus-logo-light.png" alt="Altus" className="h-14 w-auto mx-auto object-contain" />
                </div>
                {content}
            </div>
        </div>
    )

    if (awaitingConfirmation && hasResetParams()) {
        return renderWrapper(
            <Card className="w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{t('reset_password.confirm_title')}</CardTitle>
                    <CardDescription>
                        {t('reset_password.confirm_message')}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full" size="lg" onClick={handleConfirmClick}>
                        {t('reset_password.confirm_button')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                            clearAuthFlowState('reset-password')
                            navigate('/login')
                        }}
                    >
                        {t('forgot_password.back_to_login', { defaultValue: 'Back to Login' })}
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    if (validatingToken) {
        return renderWrapper(
            <Card className="w-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-ds-muted">{t('reset_password.validating')}</p>
                </CardContent>
            </Card>
        )
    }

    if (!tokenValid && serviceUnavailableMessage) {
        return renderWrapper(
            <Card className="w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-ds-warning-soft rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-ds-warning" />
                    </div>
                    <CardTitle>
                        {t('reset_password.service_unavailable_title', { defaultValue: 'Authentication service unavailable' })}
                    </CardTitle>
                    <CardDescription>
                        {t('reset_password.service_unavailable_message', { defaultValue: serviceUnavailableMessage })}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={() => setValidationNonce((value) => value + 1)}
                    >
                        <RefreshCw className="h-4 w-4 me-2" />
                        {t('reset_password.revalidate_link', { defaultValue: 'Retry Verification' })}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                            clearAuthFlowState('reset-password')
                            navigate('/login')
                        }}
                    >
                        {t('forgot_password.back_to_login', { defaultValue: 'Back to Login' })}
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    if (!tokenValid) {
        if (resendSuccess) {
            return renderWrapper(
                <Card className="w-full">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 bg-ds-success-soft rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="h-6 w-6 text-ds-success" />
                        </div>
                        <CardTitle>{t('forgot_password.success_title', { defaultValue: 'Check Your Email' })}</CardTitle>
                        <CardDescription>
                            {t('reset_password.resend_success', { defaultValue: 'A new reset link has been sent to your email. Please check your inbox.' })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <div className="p-4 bg-ds-surface-subtle dark:bg-muted/50 rounded-lg">
                            <Mail className="h-5 w-5 mx-auto text-ds-muted mb-2" />
                            <p className="text-sm font-medium text-ds-ink">{resendEmail}</p>
                        </div>
                        <p className="text-xs text-ds-muted">
                            {t('forgot_password.check_spam', { defaultValue: "Didn't receive the email? Check your spam folder." })}
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setResendSuccess(false)
                            }}
                        >
                            {t('forgot_password.try_different', { defaultValue: 'Try a different email' })}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                clearAuthFlowState('reset-password')
                                navigate('/login')
                            }}
                        >
                            {t('forgot_password.back_to_login', { defaultValue: 'Back to Login' })}
                        </Button>
                    </CardFooter>
                </Card>
            )
        }

        return renderWrapper(
            <Card className="w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-ds-danger-soft rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-ds-danger" />
                    </div>
                    <CardTitle>{t('reset_password.invalid_title')}</CardTitle>
                    <CardDescription>
                        {urlErrorDescription || t('reset_password.invalid_message')}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={(e) => { e.preventDefault(); void handleResend(); }}>
                    <CardContent className="space-y-4">
                        {resendError && (
                            <div className="flex items-center gap-2 p-3 bg-ds-danger-soft border border-ds-danger/30 rounded-md text-ds-danger text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{resendError}</span>
                            </div>
                        )}
                        <div className="space-y-2 text-start">
                            <Label htmlFor="resend-email">{t('forgot_password.email_label', { defaultValue: 'Email Address' })}</Label>
                            <div className="relative">
                                <Input
                                    id="resend-email"
                                    type="email"
                                    value={resendEmail}
                                    onChange={(e) => setResendEmail(e.target.value)}
                                    placeholder={t('email_placeholder', { defaultValue: 'name@example.com' })}
                                    disabled={resendLoading}
                                    className="ps-10"
                                    autoFocus
                                />
                                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-muted" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={resendLoading || !resendEmail.trim()}
                        >
                            {resendLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin me-2" />
                                    {t('forgot_password.sending', { defaultValue: 'Sending...' })}
                                </>
                            ) : (
                                <>
                                    <Mail className="h-4 w-4 me-2" />
                                    {t('forgot_password.send_link', { defaultValue: 'Send Reset Link' })}
                                </>
                            )}
                        </Button>
                        {hasResetParams() && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => setValidationNonce((val) => val + 1)}
                            >
                                <RefreshCw className="h-4 w-4 me-2" />
                                {t('reset_password.retry_link', { defaultValue: 'Retry Link' })}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                                clearAuthFlowState('reset-password')
                                navigate('/login')
                            }}
                        >
                            {t('forgot_password.back_to_login', { defaultValue: 'Back to Login' })}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        )
    }

    if (success) {
        return renderWrapper(
            <Card className="w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-ds-success-soft rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="h-6 w-6 text-ds-success" />
                    </div>
                    <CardTitle>{t('reset_password.success_title')}</CardTitle>
                    <CardDescription>
                        {t('reset_password.success_message')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-ds-muted" />
                    {redirectCountdown !== null && (
                        <p className="mt-4 text-sm text-ds-muted">{t('reset_password.redirecting', { count: redirectCountdown })}</p>
                    )}
                </CardContent>
            </Card>
        )
    }

    return renderWrapper(
        <Card className="w-full">
            <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t('reset_password.title')}</CardTitle>
                <CardDescription>
                    {t('reset_password.description')}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-ds-danger-soft border border-ds-danger/30 rounded-md text-ds-danger">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="password">{t('reset_password.new_password')}</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="pe-10"
                            />
                            <button
                                type="button"
                                className="absolute end-3 top-1/2 -translate-y-1/2 text-ds-muted hover:text-ds-ink"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="bg-ds-surface-subtle dark:bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-ds-ink flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Password Requirements:
                        </p>
                        <ul className="text-xs space-y-1">
                            {[
                                { check: password.length >= securityConfig.auth.passwordMinLength, text: `At least ${securityConfig.auth.passwordMinLength} characters` },
                                { check: /[A-Z]/.test(password), text: 'One uppercase letter' },
                                { check: /[a-z]/.test(password), text: 'One lowercase letter' },
                                { check: /\d/.test(password), text: 'One number' },
                                { check: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'One special character' },
                            ].map((requirement) => (
                                <li key={requirement.text} className={`flex items-center gap-1 ${requirement.check ? 'text-ds-success ' : 'text-ds-muted '}`}>
                                    {requirement.check ? <CheckCircle className="h-3 w-3" /> : <span className="w-3 h-3 rounded-full border border-ds-border" />}
                                    {requirement.text}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('reset_password.confirm_password')}</Label>
                        <Input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                        />
                        {confirmPassword && !doPasswordsMatch && (
                            <p className="text-xs text-ds-danger">Passwords do not match</p>
                        )}
                        {doPasswordsMatch && (
                            <p className="text-xs text-ds-success flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Passwords match
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading || !isPasswordValid || !doPasswordsMatch}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                {t('reset_password.updating')}
                            </>
                        ) : (
                            t('reset_password.update_password')
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
