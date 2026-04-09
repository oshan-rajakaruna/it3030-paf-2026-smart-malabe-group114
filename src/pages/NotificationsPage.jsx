import { BellRing, CheckCheck, Filter } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import styles from './NotificationsPage.module.css';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import NotificationItem from '../components/navigation/NotificationItem';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatCard from '../components/ui/StatCard';
import { mockNotifications } from '../data/notifications';
import { NOTIFICATION_FILTERS } from '../utils/constants';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());

  const filteredNotifications = notifications.filter((notification) => {
    const matchesType = typeFilter === 'ALL' || notification.type === typeFilter;
    const matchesQuery =
      !deferredQuery ||
      [notification.title, notification.message, notification.type].join(' ').toLowerCase().includes(deferredQuery);

    return matchesType && matchesQuery;
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Notifications"
        title="Notification center"
        description="Notification UI is ready for read and unread states, type filters, and future real-time updates from the backend."
        actions={
          <Button
            icon={CheckCheck}
            onClick={() =>
              setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
            }
          >
            Mark all as read
          </Button>
        }
      />

      <section className={styles.statsGrid}>
        <StatCard icon={BellRing} label="Total alerts" value={notifications.length} meta="All mock notifications in the panel" />
        <StatCard icon={Filter} label="Unread" value={unreadCount} meta="Unseen booking and ticket activity" tone="secondary" />
        <StatCard
          icon={CheckCheck}
          label="Read progress"
          value={`${Math.round(((notifications.length - unreadCount) / notifications.length) * 100)}%`}
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
            {NOTIFICATION_FILTERS.map((type) => (
              <option key={type} value={type}>
                {type === 'ALL' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      <section className={styles.list}>
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))
        ) : (
          <EmptyState
            icon={BellRing}
            title="No notifications match this view"
            description="Try another keyword or switch the notification type filter."
          />
        )}
      </section>
    </div>
  );
}
