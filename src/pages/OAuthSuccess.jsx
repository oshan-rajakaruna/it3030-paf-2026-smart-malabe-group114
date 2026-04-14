import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './OAuthSuccess.module.css';

export default function OAuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 0);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.spinner} aria-hidden="true" />
        <h1 className={styles.title}>Success! Redirecting...</h1>
        <p className={styles.subtitle}>Please wait while we finish connecting your Google account.</p>
      </div>
    </main>
  );
}
