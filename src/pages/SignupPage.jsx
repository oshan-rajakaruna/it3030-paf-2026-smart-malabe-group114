import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import styles from './LoginPage.module.css';
import { useAuth } from '../hooks/useAuth';
import { ROLE_OPTIONS, ROLES } from '../utils/constants';
import { ROUTE_PATHS } from '../routes/routeConfig';
import { createPendingSignup } from '../utils/adminStorage';
import logoImage from '../assets/logo.jpeg';

const SIGNUP_INTENT_KEY = 'smart-campus-signup-intent';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const SIGNUP_API_URL = `${BACKEND_URL}/api/auth/signup`;
const GOOGLE_AUTH_URL =
  import.meta.env.VITE_GOOGLE_AUTH_URL || `${BACKEND_URL}/oauth2/authorization/google?prompt=select_account`;

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();

  const [role, setRole] = useState(ROLES.USER);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('Done');
  const [toastVisible, setToastVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const targetPath = currentUser?.role === ROLES.ADMIN ? ROUTE_PATHS.ADMIN : ROUTE_PATHS.DASHBOARD;
    navigate(targetPath, { replace: true });
  }, [isAuthenticated, currentUser, navigate]);

  const showToast = (message, duration = 2400) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, duration);
  };

  const savePendingAndRedirect = (payload) => {
    localStorage.removeItem(SIGNUP_INTENT_KEY);
    const request = createPendingSignup({
      ...payload,
      submittedAt: new Date().toISOString(),
    });
    navigate(ROUTE_PATHS.SIGNUP_PENDING, { replace: true, state: { signupId: request.id } });
  };

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);
  const resolveRoleFromId = (value) => {
    const upper = value.toUpperCase();
    if (upper.startsWith('AD')) {
      return ROLES.ADMIN;
    }
    if (upper.startsWith('TE')) {
      return ROLES.TECHNICIAN;
    }
    return ROLES.USER;
  };

  const handleCreateAccount = async () => {
    console.log('Signup button clicked');
    const normalizedName = name.trim();
    const normalizedId = userId.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!role || !normalizedName || !normalizedId || !normalizedEmail || !password) {
      setFormError('Role, name, ID, email, and password are all required.');
      return;
    }
    if (!validateEmail(normalizedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!normalizedEmail.endsWith('@sliit.lk')) {
      setFormError('Please use your SLIIT email (example: it9012@sliit.lk).');
      return;
    }
    if (normalizedEmail.split('@')[0] !== normalizedId.toLowerCase()) {
      setFormError('Email must match your ID number (example: IT9012 -> it9012@sliit.lk).');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    const resolvedRole = resolveRoleFromId(normalizedId);
    setRole(resolvedRole);
    const payload = {
      name: normalizedName,
      email: normalizedEmail,
      password,
      idNumber: normalizedId,
    };
    console.log('Sending request to backend', SIGNUP_API_URL, payload);

    try {
      const { data } = await axios.post(SIGNUP_API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('Signup API success', data);

      if ((data?.status || '').toUpperCase() === 'APPROVED') {
        showToast(data?.message || 'Signup successful. Please sign in from the login page.');
        setTimeout(() => {
          navigate(ROUTE_PATHS.LOGIN, { replace: true });
        }, 700);
        return;
      }

      showToast(data?.message || 'Signup submitted. Your account is pending approval.');
      savePendingAndRedirect({
        mode: 'manual',
        provider: 'manual',
        role: data?.role || resolvedRole,
        name: data?.name || normalizedName,
        userId: data?.idNumber || normalizedId,
        email: data?.email || normalizedEmail,
        backendUserId: data?.id || null,
      });
    } catch (error) {
      console.error('Signup API error', error);
      const backendMessage =
        error?.response?.data?.message || error?.response?.data?.error || 'Signup failed. Please try again.';
      setFormError(backendMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialSignup = () => {
    const normalizedName = name.trim();
    const normalizedId = userId.trim();
    const resolvedRole = resolveRoleFromId(normalizedId);

    if (!normalizedName || !normalizedId) {
      setFormError('Name and ID are required before Google signup.');
      return;
    }

    setFormError('');
    setRole(resolvedRole);
    localStorage.setItem(
      SIGNUP_INTENT_KEY,
      JSON.stringify({
        provider: 'google',
        role: resolvedRole,
        name: normalizedName,
        userId: normalizedId,
        createdAt: Date.now(),
      }),
    );

    window.location.href = GOOGLE_AUTH_URL;
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.left}>
          <div className={styles.leftBg} />
          <div className={styles.leftContent}>
            <div className={styles.leftLogo}>
              <img className={styles.leftLogoImage} src={logoImage} alt="UniMatrix logo" />
              <div>
                <div className={styles.leftLogoText}>UniMatrix</div>
                <span className={styles.leftLogoSub}>Smart Operations Platform</span>
              </div>
            </div>

            <h1 className={styles.leftHeadline}>
              Create your
              <br />
              <span>UniMatrix</span>
              <br />
              account.
            </h1>

            <p className={styles.leftDesc}>
              Register with your role details, then we will place your account into pending review before dashboard
              access is enabled.
            </p>

            <div className={styles.modulePills}>
              <div className={styles.pill}>
                <div className={styles.pillDot} />
                Role selection required
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />
                Social signup supported
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />
                Pending approval workflow
              </div>
            </div>
          </div>
        </section>

        <section className={styles.right}>
          <div className={styles.rightGlow} />

          <div className={styles.formHeader}>
            <span className={styles.formEyebrow}>Create Account</span>
            <h2 className={styles.formTitle}>Sign up</h2>
            <p className={styles.formSubtitle}>Fill all required details to request access.</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="signup-role">
              Role
            </label>
            <select
              id="signup-role"
              className={styles.formInput}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              className={styles.formInput}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="signup-id">
              ID (ADxxxx = Admin, TExxxx = Technician, ITxxxx = User)
            </label>
            <input
              id="signup-id"
              className={styles.formInput}
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Student or staff ID"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="signup-email">
              Email address
            </label>
            <input
              id="signup-email"
              className={styles.formInput}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="signup-password">
              Password
            </label>
            <div className={styles.passwordField}>
              <input
                id="signup-password"
                className={`${styles.formInput} ${styles.inputWithToggle}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path
                      d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M9.9 5.3A11.7 11.7 0 0 1 12 5c5.7 0 9.5 5.6 9.5 7s-1.1 3.1-2.9 4.7M6.2 6.2C3.9 7.8 2.5 10.2 2.5 12c0 1.4 3.8 7 9.5 7 1 0 2-.2 2.9-.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2.5 12s3.8-7 9.5-7 9.5 7 9.5 7-3.8 7-9.5 7-9.5-7-9.5-7z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="button" className={styles.primaryBtn} onClick={handleCreateAccount} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
          {formError ? <p className={styles.formError}>{formError}</p> : null}

          <div className={styles.dividerRow}>
            <span>OR CONTINUE WITH</span>
          </div>

          <div className={styles.socialRow}>
            <button type="button" className={styles.socialBtn} onClick={handleSocialSignup}>
              <svg className={styles.socialIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>
          </div>

          <p className={styles.legalText}>
            Already have an account?{' '}
            <button type="button" onClick={() => navigate(ROUTE_PATHS.LOGIN)}>
              Sign in -&gt;
            </button>
          </p>
        </section>
      </div>

      <div className={`${styles.toast} ${toastVisible ? styles.toastShow : ''}`}>
        <div className={styles.toastDot} />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
