import { ArrowRight, Globe, ShieldCheck, Sparkles } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import styles from './LoginPage.module.css';
import fieldStyles from '../components/ui/Field.module.css';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { useAuth } from '../hooks/useAuth';
import { ROLE_OPTIONS, ROLES } from '../utils/constants';
import { joinClassNames } from '../utils/formatters';
import { rolePreviewCards } from '../data/users';
import { ROUTE_PATHS } from '../routes/routeConfig';

const heroHighlights = [
  { value: 'Facilities', label: 'Catalogue, status, and availability visibility' },
  { value: 'Bookings', label: 'Approval-ready request flow for campus resources' },
  { value: 'Tickets', label: 'Incident capture, comments, and technician updates' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const [selectedRole, setSelectedRole] = useState(ROLES.USER);

  const preview = rolePreviewCards.find((item) => item.role === selectedRole);
  const redirectTo = location.state?.from ?? ROUTE_PATHS.DASHBOARD;

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    login(selectedRole);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <span className={styles.badge}>IT3030 Assignment Demo UI</span>
        <h1>Smart Campus Operations Hub</h1>
        <p className={styles.subtitle}>
          A clean university operations dashboard for facilities, bookings, tickets, notifications,
          and role-based workflows.
        </p>

        <div className={styles.heroCard}>
          <div className={styles.heroCardTop}>
            <Sparkles size={20} />
            <span>Production-inspired frontend foundation</span>
          </div>
          <strong>{preview?.headline}</strong>
          <p>
            Theme tokens, modular routing, reusable UI, and mock data are already prepared for
            future Spring Boot integration.
          </p>
        </div>

        <div className={styles.highlightGrid}>
          {heroHighlights.map((item) => (
            <article key={item.value} className={styles.highlightCard}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.formPanel}>
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.formHeader}>
            <span className={styles.formEyebrow}>Secure access placeholder</span>
            <h2>Sign in to preview the system</h2>
            <p>
              Use a demo role for UI walkthroughs now. Real OAuth 2.0 token exchange will plug in
              here later.
            </p>
          </div>

          <div className={styles.roleGrid}>
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={joinClassNames(styles.roleButton, selectedRole === option.value && styles.roleButtonActive)}
                onClick={() => setSelectedRole(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <div className={styles.formFields}>
            <FormField id="email" label="University Email">
              <input
                id="email"
                className={fieldStyles.control}
                type="email"
                defaultValue={`${selectedRole.toLowerCase()}@smartcampus.demo`}
                placeholder="name@sliit.lk"
              />
            </FormField>

            <FormField id="password" label="Password Placeholder">
              <input
                id="password"
                className={fieldStyles.control}
                type="password"
                defaultValue="demo-password"
                placeholder="Enter password"
              />
            </FormField>
          </div>

          <Button type="submit" size="lg" icon={ArrowRight} fullWidth>
            Continue as {ROLE_OPTIONS.find((role) => role.value === selectedRole)?.label}
          </Button>

          <Button type="button" variant="secondary" size="lg" icon={Globe} fullWidth>
            Google OAuth Placeholder
          </Button>

          <div className={styles.footerNote}>
            <ShieldCheck size={16} />
            <span>Protected routes and theme persistence are already wired for future auth integration.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
