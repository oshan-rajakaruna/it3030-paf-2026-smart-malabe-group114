import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import styles from './SignupPendingPage.module.css';
import { ROUTE_PATHS } from '../routes/routeConfig';
import { getLatestPendingSignup, getPendingSignupById } from '../utils/adminStorage';

export default function SignupPendingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const pendingProfile = useMemo(() => {
    const signupId = location.state?.signupId;
    if (signupId) {
      const matched = getPendingSignupById(signupId);
      if (matched) {
        return matched;
      }
    }
    return getLatestPendingSignup();
  }, [location.state]);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.eyebrow}>Registration Pending</span>
        <h1 className={styles.title}>Your signup request is waiting for approval</h1>
        <p className={styles.subtitle}>
          We received your details successfully. An admin needs to approve your account before dashboard access is
          enabled.
        </p>

        {pendingProfile ? (
          <div className={styles.profileGrid}>
            <div className={styles.profileItem}>
              <span>Name</span>
              <strong>{pendingProfile.name || 'Not provided'}</strong>
            </div>
            <div className={styles.profileItem}>
              <span>Role</span>
              <strong>{pendingProfile.role || 'Not selected'}</strong>
            </div>
            <div className={styles.profileItem}>
              <span>ID</span>
              <strong>{pendingProfile.userId || 'Not provided'}</strong>
            </div>
            <div className={styles.profileItem}>
              <span>Email</span>
              <strong>{pendingProfile.email || 'Not provided'}</strong>
            </div>
            <div className={styles.profileItem}>
              <span>Signup Type</span>
              <strong>{pendingProfile.provider || pendingProfile.mode || 'manual'}</strong>
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={() => navigate(ROUTE_PATHS.LOGIN)}>
            Back to login
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => navigate(ROUTE_PATHS.SIGNUP)}>
            Edit and signup again
          </button>
        </div>
      </section>
    </main>
  );
}
