import { useState } from 'react';
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import styles from './Topbar.module.css';
import ThemeToggle from './ThemeToggle';
import SearchBar from '../ui/SearchBar';
import NotificationBell from '../NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import { formatRoleLabel, getInitials } from '../../utils/formatters';

export default function Topbar({ onMenuToggle }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentUser, logout } = useAuth();

  return (
    <header className={styles.topbar}>
      <div className={styles.leftSection}>
        <button type="button" className={styles.menuButton} onClick={onMenuToggle} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <div className={styles.searchWrap}>
          <SearchBar placeholder="Search facilities, bookings, tickets..." />
        </div>
      </div>

      <div className={styles.actions}>
        <NotificationBell />

        <ThemeToggle />

        <div className={styles.userMenuWrap}>
          <button type="button" className={styles.userButton} onClick={() => setIsMenuOpen((current) => !current)}>
            <span className={styles.avatar}>{getInitials(currentUser.name)}</span>
            <span className={styles.userCopy}>
              <strong>{currentUser.name}</strong>
              <small>{formatRoleLabel(currentUser.role)}</small>
            </span>
            <ChevronDown size={16} className={styles.chevron} />
          </button>

          {isMenuOpen ? (
            <div className={styles.menuPanel}>
              <div className={styles.menuHeader}>
                <strong>{currentUser.title}</strong>
                <span>{currentUser.department}</span>
              </div>
              <Link className={styles.menuLink} to="/settings" onClick={() => setIsMenuOpen(false)}>
                <Settings size={16} />
                <span>Profile & settings</span>
              </Link>
              <button type="button" className={styles.menuLink} onClick={logout}>
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
