import { MoonStar, SunMedium } from 'lucide-react';

import styles from './ThemeToggle.module.css';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDarkTheme = theme === 'dark';

  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme} aria-label="Toggle theme">
      <span className={styles.icon}>{isDarkTheme ? <SunMedium size={17} /> : <MoonStar size={17} />}</span>
      <span className={styles.label}>{isDarkTheme ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
