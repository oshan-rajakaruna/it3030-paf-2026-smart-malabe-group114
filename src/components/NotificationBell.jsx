import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import styles from './NotificationBell.module.css';
import { useAuth } from '../hooks/useAuth';
import {
  getNotificationContext,
  getRoleNotifications,
  getUserNotifications,
  mapNotificationToUi,
  markNotificationAsRead,
} from '../services/notificationApi';
import { formatDateTime } from '../utils/formatters';

const AUTO_REFRESH_MS = 5000;
const PREVIEW_LIMIT = 6;

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const context = getNotificationContext();
        const role = context.role || String(currentUser?.role || '').toUpperCase();
        const userId = context.userId || currentUser?.id;

        let payload = [];
        if (role === 'ADMIN') {
          payload = await getRoleNotifications('ADMIN');
        } else if (userId) {
          payload = await getUserNotifications(userId);
        }

        const normalized = (Array.isArray(payload) ? payload : [])
          .map((notification) => mapNotificationToUi(notification, { role }))
          .filter((notification) => {
            if (role === 'ADMIN') {
              return true;
            }

            if (!userId) {
              return !notification.userId;
            }

            return !notification.userId || String(notification.userId) === String(userId);
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isMounted) {
          setNotifications(normalized);
          setError('');
        }
      } catch (requestError) {
        if (isMounted) {
          console.error('Failed to load notification bell data', requestError);
          setError(requestError?.message || 'Could not load notifications.');
        }
      }
    };

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, AUTO_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.role]);

  const handleNotificationClick = async (clickedNotification) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === clickedNotification.id ? { ...notification, read: true, status: 'READ' } : notification,
      ),
    );

    try {
      if (!clickedNotification.read) {
        await markNotificationAsRead(clickedNotification.id);
      }
    } catch (requestError) {
      console.error('Failed to mark notification as read from bell', requestError);
    }

    if (clickedNotification.actionPath) {
      setIsOpen(false);
      navigate(clickedNotification.actionPath);
    }
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.iconButton} onClick={() => setIsOpen((current) => !current)} aria-label="Open notifications">
        <Bell size={18} />
        {unreadCount ? <span className={styles.badge}>{unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <section className={styles.dropdown}>
          <header className={styles.dropdownHeader}>
            <strong>Notifications</strong>
            <Link to="/notifications" className={styles.viewAll} onClick={() => setIsOpen(false)}>
              View all
            </Link>
          </header>

          {error ? <p className={styles.state}>{error}</p> : null}
          {!error && !notifications.length ? <p className={styles.state}>No notifications yet.</p> : null}

          <div className={styles.list}>
            {notifications.slice(0, PREVIEW_LIMIT).map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`${styles.item} ${!notification.read ? styles.unread : ''}`}
                onClick={() => void handleNotificationClick(notification)}
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemTags}>
                    <span className={styles.module}>{notification.moduleTag || notification.module}</span>
                    <span className={styles.priority}>{notification.priorityTag || notification.priority}</span>
                  </div>
                  {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
                </div>
                <p className={styles.itemTitle}>{notification.title}</p>
                <p className={styles.itemMessage}>{notification.message}</p>
                <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
