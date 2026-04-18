import { BellRing, CheckCheck, Filter } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import styles from './NotificationsPage.module.css';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import NotificationItem from '../components/navigation/NotificationItem';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatCard from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';

const NOTIFICATION_API_BASE = 'http://localhost:8080/api/notifications';
const AUTO_REFRESH_MS = 7000;

const TYPE_BUCKETS = ['BOOKING', 'USER', 'SYSTEM'];

function normalizeType(rawType) {
  const normalized = String(rawType || '').toUpperCase();
  if (normalized.includes('BOOKING')) {
    return 'BOOKING';
  }
  if (normalized.includes('SIGNUP') || normalized.includes('ACCOUNT') || normalized.includes('USER')) {
    return 'USER';
  }
  return 'SYSTEM';
}

function isReadNotification(notification) {
  if (typeof notification?.read === 'boolean') {
    return notification.read;
  }
  return String(notification?.status || '').toUpperCase() === 'READ';
}

function mapBackendNotification(notification) {
  const type = normalizeType(notification?.type);
  const read = isReadNotification(notification);
  return {
    id: notification?.id,
    title: type === 'BOOKING' ? 'Booking update' : type === 'USER' ? 'User management update' : 'System update',
    message: notification?.message || 'No message available.',
    type,
    createdAt: notification?.createdAt || new Date().toISOString(),
    read,
    actionPath: '/notifications',
    actionLabel: read ? 'View details' : 'Mark as read',
    status: String(notification?.status || (read ? 'READ' : 'UNREAD')).toUpperCase(),
  };
}

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());
  const roleFromLocalStorage = localStorage.getItem('role');

  const loadNotifications = async () => {
    try {
      const role = String(roleFromLocalStorage || currentUser?.role || '').toUpperCase();
      const userId = String(localStorage.getItem('userId') || currentUser?.id || '');

      // Admin gets all system notifications from DB.
      const endpoint =
        role === 'ADMIN'
          ? NOTIFICATION_API_BASE
          : `${NOTIFICATION_API_BASE}/user/${encodeURIComponent(userId)}`;

      const response = await fetch(endpoint, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`Failed to load notifications (${response.status})`);
      }

      const payload = await response.json();
      const mapped = (Array.isArray(payload) ? payload : [])
        .map(mapBackendNotification)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(mapped);
      setLoadError('');
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      setLoadError('Could not load notifications from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [currentUser?.id, currentUser?.role, roleFromLocalStorage]);

  const markSingleAsRead = async (notificationId) => {
    if (!notificationId) {
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true, status: 'READ' } : notification,
      ),
    );

    try {
      // Preferred endpoint in your requirement.
      let response = await fetch(`${NOTIFICATION_API_BASE}/${encodeURIComponent(notificationId)}/read`, {
        method: 'PUT',
      });

      // Backward-compatible fallback for current backend.
      if (response.status === 404) {
        response = await fetch(`${NOTIFICATION_API_BASE}/${encodeURIComponent(notificationId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'READ' }),
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to mark as read (${response.status})`);
      }
    } catch (error) {
      console.error('Failed to mark notification as read', error);
      setLoadError('Failed to update notification status.');
      await loadNotifications();
    }
  };

  const filteredNotifications = useMemo(() => notifications.filter((notification) => {
    const matchesType = typeFilter === 'ALL' || notification.type === typeFilter;
    const matchesQuery =
      !deferredQuery ||
      [notification.title, notification.message, notification.type].join(' ').toLowerCase().includes(deferredQuery);

    return matchesType && matchesQuery;
  }), [deferredQuery, notifications, typeFilter]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const filters = ['ALL', ...TYPE_BUCKETS];
  const readProgress =
    notifications.length === 0 ? '0%' : `${Math.round(((notifications.length - unreadCount) / notifications.length) * 100)}%`;

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (!unreadIds.length) {
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, read: true, status: 'READ' })));

    try {
      await Promise.all(unreadIds.map((id) => markSingleAsRead(id)));
      setLoadError('');
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Notifications"
        title="Notification center"
        description="Live notifications are loaded from the backend database for the current signed-in role."
        actions={
          <Button icon={CheckCheck} onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        }
      />

      {loadError ? <p className={styles.error}>{loadError}</p> : null}

      <section className={styles.statsGrid}>
        <StatCard
          icon={BellRing}
          label="Total alerts"
          value={notifications.length}
          meta={isLoading ? 'Loading live notifications...' : 'All live notifications in the panel'}
        />
        <StatCard icon={Filter} label="Unread" value={unreadCount} meta="Unseen booking and ticket activity" tone="secondary" />
        <StatCard
          icon={CheckCheck}
          label="Read progress"
          value={readProgress}
          meta="Useful for future user engagement metrics"
          tone="success"
        />
      </section>

      <FilterPanel title="Filter notifications" description="Search by title or narrow the list by event type.">
        <div className={styles.filterGrid}>
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search notifications..."
          />
          <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {filters.map((type) => (
              <option key={type} value={type}>
                {type === 'ALL' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      <section className={styles.list}>
        {!isLoading && filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => {
                if (!notification.read) {
                  void markSingleAsRead(notification.id);
                }
              }}
            />
          ))
        ) : (
          <EmptyState
            icon={BellRing}
            title={isLoading ? 'Loading notifications...' : 'No notifications match this view'}
            description={
              isLoading
                ? 'Please wait while we load notifications from the database.'
                : 'Try another keyword or switch the notification type filter.'
            }
          />
        )}
      </section>
    </div>
  );
}
