
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LoginView } from './LoginView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { ForgotPasswordSuccessView } from './ForgotPasswordSuccessView';

type AuthView = 'login' | 'forgot' | 'forgot_success';

export function LoginForm() {
  const { i18n } = useTranslation('auth');
  const [authView, setAuthView] = useState<AuthView>('login');
  const [resetEmail, setResetEmail] = useState('');
  // Track whether the forgot-password flow was triggered by the unlock CTA

  const isRTL = i18n.dir() === 'rtl';

  const openForgotPassword = useCallback((email?: string) => {
    setResetEmail(email?.trim() ?? '');
    setAuthView('forgot');
  }, []);

  /**
   * Triggered by the "Unlock Account via Password Reset" button on the lockout error.
   * Pre-fills the user's email. Resetting the password is the way back in; any
   * throttling itself is enforced and lifted by Supabase Auth.
   */
  const openUnlockAccount = useCallback((email: string) => {
    setResetEmail(email.trim());
    setAuthView('forgot');
  }, []);

  const handleBackToLogin = useCallback(() => {
    setAuthView('login');
  }, []);

  const handleForgotSuccess = useCallback((email: string) => {
    setResetEmail(email);
    setAuthView('forgot_success');
  }, []);

  const handleTryDifferentEmail = useCallback(() => {
    setResetEmail('');
    setAuthView('forgot');
  }, []);

  if (authView === 'forgot_success') {
    return (
      <ForgotPasswordSuccessView
        email={resetEmail}
        isRTL={isRTL}
        onBackToLogin={handleBackToLogin}
        onTryDifferentEmail={handleTryDifferentEmail}
      />
    );
  }

  if (authView === 'forgot') {
    return (
      <ForgotPasswordView
        isRTL={isRTL}
        initialEmail={resetEmail}
        onBackToLogin={handleBackToLogin}
        onSuccess={handleForgotSuccess}
      />
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <LoginView
          isRTL={isRTL}
          onForgotPassword={() => openForgotPassword()}
          onUnlockAccount={(email: string) => openUnlockAccount(email)}
        />
      </m.div>
    </LazyMotion>
  );
}

export default LoginForm;
