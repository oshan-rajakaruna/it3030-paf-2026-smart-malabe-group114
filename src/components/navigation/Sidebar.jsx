import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';

import styles from './Sidebar.module.css';
import campusMark from '../../assets/campus-mark.svg';
import { useAuth } from '../../hooks/useAuth';
import { NAV_ITEMS } from '../../utils/constants';
import { formatRoleLabel, getInitials, joinClassNames } from '../../utils/formatters';

export default function Sidebar({ isOpen, onClose }) {
  const { currentUser, logout } = useAuth();

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));

  return (
    <aside className={joinClassNames(styles.sidebar, isOpen && styles.open)}>
      <div className={styles.topSection}>
        <div className={styles.brand}>
          <img src={campusMark} alt="Smart Campus Operations Hub" className={styles.brandMark} />
          <div>
            <strong>Smart Campus</strong>
            <span>Operations Hub</span>
          </div>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <nav className={styles.nav}>
        {navItems.map(({ path, label, icon: Icon, description }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => joinClassNames(styles.navItem, isActive && styles.active)}
            onClick={onClose}
          >
            <span className={styles.navIcon}>
              <Icon size={18} />
            </span>
            <span className={styles.navCopy}>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <span className={styles.avatar}>{getInitials(currentUser.name)}</span>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{formatRoleLabel(currentUser.role)}</span>
          </div>
        </div>
        <button type="button" className={styles.signOutButton} onClick={logout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
