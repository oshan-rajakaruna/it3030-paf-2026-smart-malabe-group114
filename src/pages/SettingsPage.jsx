import { Bell, MoonStar, Palette, ShieldCheck, SunMedium, UserRound } from 'lucide-react';
import { useState } from 'react';

import styles from './SettingsPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import ThemeToggle from '../components/navigation/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  NOTIFICATION_PREFERENCE_OPTIONS,
  ROLE_OPTIONS,
  THEMES,
} from '../utils/constants';
import { formatRoleLabel, joinClassNames } from '../utils/formatters';

const initialPreferences = {
  bookingUpdates: true,
  ticketUpdates: true,
  commentAlerts: true,
  systemBroadcasts: false,
};

export default function SettingsPage() {
  const { currentUser, switchRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState(initialPreferences);

  const togglePreference = (id) => {
    setPreferences((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Profile & Settings"
        title="Personalize the experience"
        description="Theme, profile, notification preferences, and demo role switching live here so future account settings can grow without touching every page."
      />

      <section className={styles.grid}>
        <Card title="Profile overview" subtitle="Current mock user loaded from the auth context.">
          <div className={styles.profileCard}>
            <span className={styles.avatar}>{currentUser.name.charAt(0)}</span>
            <div>
              <strong>{currentUser.name}</strong>
              <p>{currentUser.title}</p>
            </div>
          </div>
          <div className={styles.infoGrid}>
            <div>
              <span>Email</span>
              <strong>{currentUser.email}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{currentUser.phone}</strong>
            </div>
            <div>
              <span>Department</span>
              <strong>{currentUser.department}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{formatRoleLabel(currentUser.role)}</strong>
            </div>
          </div>
        </Card>

        <Card title="Appearance" subtitle="Theme tokens use localStorage persistence and CSS variables.">
          <div className={styles.themeSection}>
            <ThemeToggle />
            <div className={styles.themeButtons}>
              <button
                type="button"
                className={joinClassNames(styles.themeChoice, theme === THEMES.LIGHT && styles.themeChoiceActive)}
                onClick={() => setTheme(THEMES.LIGHT)}
              >
                <SunMedium size={18} />
                <span>Light theme</span>
              </button>
              <button
                type="button"
                className={joinClassNames(styles.themeChoice, theme === THEMES.DARK && styles.themeChoiceActive)}
                onClick={() => setTheme(THEMES.DARK)}
              >
                <MoonStar size={18} />
                <span>Dark theme</span>
              </button>
            </div>
          </div>
        </Card>
      </section>

      <section className={styles.grid}>
        <Card title="Notification preferences" subtitle="Optional innovation-friendly area for user-controlled alert settings.">
          <div className={styles.preferenceList}>
            {NOTIFICATION_PREFERENCE_OPTIONS.map((option) => (
              <label key={option.id} className={styles.preferenceItem}>
                <div>
                  <strong>{option.label}</strong>
                  <p>Mock toggle ready for API-backed profile preferences.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences[option.id]}
                  onChange={() => togglePreference(option.id)}
                />
              </label>
            ))}
          </div>
        </Card>

        <Card title="Demo role switcher" subtitle="Useful during viva to preview user, admin, and technician experiences quickly.">
          <div className={styles.roleList}>
            {ROLE_OPTIONS.map((role) => (
              <div key={role.value} className={styles.roleButton}>
                <div>
                  <strong>{role.label}</strong>
                  <p>{role.description}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => switchRole(role.value)}>
                  Preview
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card title="Integration placeholders" subtitle="These sections are intentionally visible so the team can demo future readiness.">
        <div className={styles.placeholderGrid}>
          <div className={styles.placeholderCard}>
            <UserRound size={20} />
            <strong>Profile editing</strong>
            <p>Later connect form-based account updates to the user service.</p>
          </div>
          <div className={styles.placeholderCard}>
            <ShieldCheck size={20} />
            <strong>OAuth controls</strong>
            <p>Google sign-in, token refresh, and secure logout can extend from this area.</p>
          </div>
          <div className={styles.placeholderCard}>
            <Bell size={20} />
            <strong>Notification channels</strong>
            <p>Add email or push delivery preferences after backend support is available.</p>
          </div>
          <div className={styles.placeholderCard}>
            <Palette size={20} />
            <strong>Brand customization</strong>
            <p>Campus-specific branding or department themes can layer onto the token system.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
