import { BellRing, CheckCheck, Filter } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './NotificationsPage.module.css';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import NotificationItem from '../components/navigation/NotificationItem';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatCard from '../components/ui/StatCard';
import { useAuth } from '../hooks/useAuth';
import {
  deleteNotification,
  getNotificationContext,
  getRoleNotifications,
  getUserNotifications,
  mapNotificationToUi,
  markNotificationAsRead,
} from '../services/notificationApi';

const TYPE_FILTERS = ['ALL', 'AUTH', 'BOOKING', 'RESOURCE', 'TICKET'];
const AUTO_REFRESH_MS = 5000;

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());

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

        const mapped = (Array.isArray(payload) ? payload : [])
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
          setNotifications(mapped);
          setLoadError('');
          setIsLoading(false);
        }
      } catch (requestError) {
        if (isMounted) {
          console.error('Failed to fetch role-based notifications', requestError);
          setLoadError(requestError?.message || 'Could not load notifications.');
          setIsLoading(false);
        }
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, AUTO_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [currentUser?.id, currentUser?.role]);

  const markSingleAsRead = async (notificationId) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true, status: 'READ' } : notification,
      ),
    );

    try {
      await markNotificationAsRead(notificationId);
    } catch (requestError) {
      console.error('Failed to mark notification as read', requestError);
      setLoadError(requestError?.message || 'Failed to update notification.');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    } catch (requestError) {
      console.error('Failed to delete notification', requestError);
      setLoadError(requestError?.message || 'Failed to delete notification.');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (!unreadIds.length) {
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, read: true, status: 'READ' })));

    await Promise.all(unreadIds.map((id) => markSingleAsRead(id)));
  };

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const matchesModule = moduleFilter === 'ALL' || notification.module === moduleFilter;
        const haystack = [notification.title, notification.message, notification.module, notification.priority]
          .join(' ')
          .toLowerCase();
        const matchesQuery = !deferredQuery || haystack.includes(deferredQuery);
        return matchesModule && matchesQuery;
      }),
    [deferredQuery, moduleFilter, notifications],
  );
 
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const readProgress =
    notifications.length === 0 ? '0%' : `${Math.round(((notifications.length - unreadCount) / notifications.length) * 100)}%`;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Notifications"
        title="Notification center"
        description="Strict role-based notifications: admins see admin alerts, technicians see technician alerts, and students see personal alerts."
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
          meta={isLoading ? 'Loading targeted notifications...' : 'Live data from MongoDB'}
        />
        <StatCard icon={Filter} label="Unread" value={unreadCount} meta="Notifications requiring attention" tone="secondary" />
        <StatCard icon={CheckCheck} label="Read progress" value={readProgress} meta="Overall notification hygiene" tone="success" />
      </section>

      <FilterPanel title="Filter notifications" description="Search by keyword and narrow by module.">
        <div className={styles.filterGrid}>
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search notifications..."
          />
          <select className={styles.select} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            {TYPE_FILTERS.map((module) => (
              <option key={module} value={module}>
                {module === 'ALL' ? 'All Modules' : module}
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
              onDelete={(id) => void handleDeleteNotification(id)}
              onClick={() => {
                if (!notification.read) {
                  void markSingleAsRead(notification.id);
                }
                if (notification.actionPath) {
                  navigate(notification.actionPath);
                }
              }}
            />
          ))
        ) : (
          <EmptyState
            icon={BellRing}
            title={isLoading ? 'Loading notifications...' : 'No notifications for this filter'}
            description={
              isLoading
                ? 'Fetching notifications from the backend.'
                : 'Try a different module filter or search keyword.'
            }
          />
        )}
      </section>
    </div>
  );
}
