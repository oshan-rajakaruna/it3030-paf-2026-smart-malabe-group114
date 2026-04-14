import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './LoginPage.module.css';
import { ROUTE_PATHS } from '../routes/routeConfig';
import { useAuth } from '../hooks/useAuth';
import { resolveRoleAndPath } from '../utils/authRouting';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toastMessage, setToastMessage] = useState('Done');
  const [toastVisible, setToastVisible] = useState(false);
  const [formError, setFormError] = useState('');

  const googleAuthUrl = 'http://localhost:8080/oauth2/authorization/google?prompt=select_account';
  const microsoftAuthUrl = 'http://localhost:8080/oauth2/authorization/microsoft';

  const toastTimerRef = useRef(null);
  const socialTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (socialTimerRef.current) {
        clearTimeout(socialTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthProvider = params.get('oauth');
    const oauthEmail = params.get('email');

    if (oauthProvider && oauthEmail) {
      const normalizedEmail = oauthEmail.trim().toLowerCase();
      localStorage.setItem('oauth_last_email', normalizedEmail);
      const { role, path } = resolveRoleAndPath(normalizedEmail);
      login(role);
      navigate(path, { replace: true });
    }
  }, [login, navigate]);

  const showToast = (message, duration = 3000) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, duration);
  };

  const handleSignIn = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!email || !password) {
      setFormError('Please enter your email and password.');
      return;
    }

    if (!normalizedEmail.endsWith('@sliit.lk')) {
      setFormError('Please use your SLIIT email address.');
      return;
    }

    setFormError('');

    const { role: nextRole, path: targetPath } = resolveRoleAndPath(normalizedEmail);

    login(nextRole);
    showToast('Authenticating... redirecting to dashboard', 1500);
    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 600);
  };

  const handleGoogleSignIn = () => {
    setFormError('');
    window.location.href = googleAuthUrl;
  };

  const handleMicrosoftSignIn = () => {
    setFormError('');
    window.location.href = microsoftAuthUrl;
  };

  const handleSocial = (provider) => {
    showToast(`Launching ${provider} sign-in...`, 3200);
    if (socialTimerRef.current) {
      clearTimeout(socialTimerRef.current);
    }
    socialTimerRef.current = setTimeout(() => {
      showToast(`${provider} authentication initiated`, 3000);
    }, 1600);
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.left}>
          <div className={styles.leftBg} />

          <div className={styles.buildingWrap} aria-hidden="true">
            <svg
              width="520"
              height="480"
              viewBox="0 0 520 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0.55 }}
            >
              <ellipse
                cx="260"
                cy="370"
                rx="220"
                ry="55"
                fill="rgba(212,168,67,0.04)"
                stroke="rgba(212,168,67,0.12)"
                strokeWidth="1"
              />

              <polygon
                points="100,230 100,360 200,390 200,260"
                fill="rgba(15,30,65,0.9)"
                stroke="rgba(212,168,67,0.3)"
                strokeWidth="1"
              />
              <polygon
                points="200,260 200,390 320,360 320,230"
                fill="rgba(10,20,48,0.9)"
                stroke="rgba(212,168,67,0.2)"
                strokeWidth="1"
              />
              <polygon
                points="100,230 200,200 320,230 200,260"
                fill="rgba(25,50,100,0.85)"
                stroke="rgba(212,168,67,0.4)"
                strokeWidth="1"
              />

              <rect
                x="118"
                y="255"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.25)"
                stroke="rgba(212,168,67,0.4)"
                strokeWidth="0.5"
              />
              <rect
                x="152"
                y="255"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.15)"
                stroke="rgba(212,168,67,0.3)"
                strokeWidth="0.5"
              />
              <rect
                x="118"
                y="285"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.35)"
                stroke="rgba(212,168,67,0.5)"
                strokeWidth="0.5"
              />
              <rect
                x="152"
                y="285"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.2)"
                stroke="rgba(212,168,67,0.35)"
                strokeWidth="0.5"
              />
              <rect
                x="118"
                y="315"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.1)"
                stroke="rgba(212,168,67,0.25)"
                strokeWidth="0.5"
              />
              <rect
                x="152"
                y="315"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.3)"
                stroke="rgba(212,168,67,0.45)"
                strokeWidth="0.5"
              />

              <rect
                x="218"
                y="262"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.15)"
                stroke="rgba(212,168,67,0.25)"
                strokeWidth="0.5"
              />
              <rect
                x="252"
                y="268"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.25)"
                stroke="rgba(212,168,67,0.38)"
                strokeWidth="0.5"
              />
              <rect
                x="286"
                y="274"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.12)"
                stroke="rgba(212,168,67,0.22)"
                strokeWidth="0.5"
              />
              <rect
                x="218"
                y="295"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.3)"
                stroke="rgba(212,168,67,0.45)"
                strokeWidth="0.5"
              />
              <rect
                x="252"
                y="300"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.18)"
                stroke="rgba(212,168,67,0.3)"
                strokeWidth="0.5"
              />
              <rect
                x="286"
                y="305"
                width="22"
                height="16"
                rx="2"
                fill="rgba(212,168,67,0.22)"
                stroke="rgba(212,168,67,0.35)"
                strokeWidth="0.5"
              />

              <polygon
                points="60,260 60,345 120,360 120,275"
                fill="rgba(12,25,55,0.9)"
                stroke="rgba(212,168,67,0.25)"
                strokeWidth="1"
              />
              <polygon
                points="120,275 120,360 160,348 160,263"
                fill="rgba(8,16,40,0.85)"
                stroke="rgba(212,168,67,0.18)"
                strokeWidth="1"
              />
              <polygon
                points="60,260 120,245 160,263 100,278"
                fill="rgba(20,40,85,0.85)"
                stroke="rgba(212,168,67,0.35)"
                strokeWidth="1"
              />
              <rect
                x="76"
                y="285"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.28)"
                stroke="rgba(212,168,67,0.45)"
                strokeWidth="0.5"
              />
              <rect
                x="76"
                y="307"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.14)"
                stroke="rgba(212,168,67,0.3)"
                strokeWidth="0.5"
              />

              <polygon
                points="320,230 320,345 390,325 390,210"
                fill="rgba(10,20,50,0.9)"
                stroke="rgba(212,168,67,0.22)"
                strokeWidth="1"
              />
              <polygon
                points="390,210 390,325 430,315 430,200"
                fill="rgba(7,14,36,0.85)"
                stroke="rgba(212,168,67,0.15)"
                strokeWidth="1"
              />
              <polygon
                points="320,230 390,210 430,200 360,220"
                fill="rgba(18,36,80,0.9)"
                stroke="rgba(212,168,67,0.32)"
                strokeWidth="1"
              />
              <rect
                x="334"
                y="252"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.22)"
                stroke="rgba(212,168,67,0.38)"
                strokeWidth="0.5"
              />
              <rect
                x="358"
                y="248"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.32)"
                stroke="rgba(212,168,67,0.48)"
                strokeWidth="0.5"
              />
              <rect
                x="334"
                y="274"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.16)"
                stroke="rgba(212,168,67,0.28)"
                strokeWidth="0.5"
              />
              <rect
                x="358"
                y="270"
                width="16"
                height="12"
                rx="2"
                fill="rgba(212,168,67,0.26)"
                stroke="rgba(212,168,67,0.4)"
                strokeWidth="0.5"
              />

              <line
                x1="200"
                y1="200"
                x2="200"
                y2="140"
                stroke="rgba(212,168,67,0.5)"
                strokeWidth="1.5"
              />
              <polygon
                points="200,140 228,152 200,162"
                fill="rgba(212,168,67,0.4)"
                stroke="rgba(212,168,67,0.6)"
                strokeWidth="0.8"
              />

              <path
                d="M145 370 Q200 380 260 375 Q310 370 350 368"
                stroke="rgba(212,168,67,0.15)"
                strokeWidth="1"
                fill="none"
              />

              <line
                x1="100"
                y1="295"
                x2="60"
                y2="295"
                stroke="rgba(212,168,67,0.2)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
              />
              <line
                x1="320"
                y1="280"
                x2="390"
                y2="260"
                stroke="rgba(212,168,67,0.2)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
              />

              <circle cx="118" cy="263" r="3" fill="rgba(212,168,67,0.7)">
                <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="358" cy="254" r="3" fill="rgba(212,168,67,0.7)">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="252" cy="276" r="3" fill="rgba(212,168,67,0.7)">
                <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          

          <div className={styles.leftContent}>
            <div className={styles.leftLogo}>
              <div className={styles.leftLogoIcon}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(212,168,67,0.9)"
                  strokeWidth="1.5"
                >
                  <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7L12 2z" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className={styles.leftLogoText}>CampusHub</div>
                <span className={styles.leftLogoSub}>Smart Operations Platform</span>
              </div>
            </div>

            <h1 className={styles.leftHeadline}>
              Smart Campus,<br />
              <span>Operations</span>
              <br />
              Hub.
            </h1>

            <p className={styles.leftDesc}>
              A unified home for class schedules, spaces, events, and services - designed for the rhythm of
              university life.
            </p>

            <div className={styles.hubNav}>
              <span className={styles.hubNavItem}>Library</span>
              <span className={styles.hubNavItem}>Labs</span>
              <span className={styles.hubNavItem}>Sports</span>
              <span className={styles.hubNavItem}>Student Affairs</span>
            </div>

           

            <div className={styles.modulePills}>
              <div className={styles.pill}>
                <div className={styles.pillDot} />Booking Management
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />Maintenance Tickets
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />Asset Catalogue
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />Role-Based Access
              </div>
              <div className={styles.pill}>
                <div className={styles.pillDot} />Real-Time Alerts
              </div>
            </div>

            <div className={styles.bottomStrip}>
              
              
            </div>
          </div>
        </section>

        <section className={styles.right}>
          <div className={styles.rightGlow} />

          <div className={styles.formHeader}>
            <span className={styles.formEyebrow}>Secure Sign In</span>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSubtitle}>Sign in to your campus workspace to continue.</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="email">
              Email address
            </label>
            <input
              className={styles.formInput}
              type="email"
              id="email"
              placeholder="you@sliit.lk"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="password">
              Password
            </label>
            <input
              className={styles.formInput}
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.linkBtn}>
              Forgot password?
            </button>
          </div>

          <button type="button" className={styles.primaryBtn} onClick={handleSignIn}>
            Sign in to CampusHub
          </button>
          {formError ? <p className={styles.formError}>{formError}</p> : null}

          <div className={styles.dividerRow}>
            <span>or continue with</span>
          </div>

          <div className={styles.socialRow}>
            <button type="button" className={styles.socialBtn} onClick={handleGoogleSignIn}>
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
              <span>Sign in with Google</span>
            </button>
            <button type="button" className={styles.socialBtn} onClick={handleMicrosoftSignIn}>
              <svg className={styles.socialIcon} viewBox="0 0 24 24" aria-hidden="true">
                <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
                <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
                <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
                <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
              </svg>
              <span>Sign in with Microsoft</span>
            </button>
          </div>

          <p className={styles.legalText}>
            No account yet? <button type="button">Create one -&gt;</button>
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
