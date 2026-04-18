import { useEffect, useMemo, useState } from 'react';
import { BellRing, Plus, RefreshCw, SendHorizontal, Trash2 } from 'lucide-react';

import styles from './NotificationsPage.module.css';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routeConfig';
import {
  deleteNotification,
  getAllNotifications,
  getRoleNotifications,
  mapNotificationToUi,
  markNotificationAsRead,
  updateNotification,
} from '../../services/notificationApi';
import { formatDateTime } from '../../utils/formatters';

const STATUS_FILTERS = ['ALL', 'UNREAD', 'READ'];
const AUDIENCE_FILTERS = ['ALL', 'ADMIN', 'TECHNICIAN', 'STUDENT'];

export default function AdminNotificationsPage() {
  const { currentUser } = useAuth();
  const [allNotifications, setAllNotifications] = useState([]);
  const [receivedNotifications, setReceivedNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('received');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const [allPayload, receivedPayload] = await Promise.all([
        getAllNotifications(),
        getRoleNotifications('ADMIN'),
      ]);

      const sortedAll = (Array.isArray(allPayload) ? allPayload : [])
        .map(mapNotificationToUi)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const sortedReceived = (Array.isArray(receivedPayload) ? receivedPayload : [])
        .map(mapNotificationToUi)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setAllNotifications(sortedAll);
      setReceivedNotifications(sortedReceived);
      setError('');
    } catch (requestError) {
      console.error('Failed to load admin notifications', requestError);
      setError(requestError?.message || 'Could not load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    const refreshTimer = window.setInterval(() => {
      void loadNotifications();
    }, 5000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const sentNotifications = useMemo(() => {
    const currentUserId = currentUser?.id;
    return allNotifications.filter(
      (notification) =>
        notification.createdBy === currentUserId ||
        notification.createdBy === 'ADMIN',
    );
  }, [allNotifications, currentUser?.id]);

  const workingSet = activeTab === 'sent' ? sentNotifications : receivedNotifications;

  const filteredRows = useMemo(() => {
    return workingSet.filter((notification) => {
      const matchesStatus = statusFilter === 'ALL' || notification.status === statusFilter;
      const matchesAudience = audienceFilter === 'ALL' || notification.role === audienceFilter;
      const haystack = [
        notification.title,
        notification.message,
        notification.module,
        notification.channel,
        notification.priority,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !searchText.trim() || haystack.includes(searchText.trim().toLowerCase());
      return matchesStatus && matchesAudience && matchesSearch;
    });
  }, [audienceFilter, searchText, statusFilter, workingSet]);

  const handleDelete = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      await loadNotifications();
    } catch (requestError) {
      console.error('Failed to delete notification', requestError);
      setError(requestError?.message || 'Delete failed.');
    }
  };

  const handleEdit = async (notification) => {
    const nextTitle = window.prompt('Update subject', notification.title || '');
    if (nextTitle == null) {
      return;
    }
    const nextMessage = window.prompt('Update message', notification.message || '');
    if (nextMessage == null) {
      return;
    }

    try {
      await updateNotification(notification.id, {
        title: nextTitle.trim() || notification.title,
        message: nextMessage.trim() || notification.message,
        role: notification.role,
        userId: notification.userId,
        module: notification.module,
        channel: notification.channel,
        priority: notification.priority,
        status: notification.status,
      });
      await loadNotifications();
    } catch (requestError) {
      console.error('Failed to edit notification', requestError);
      setError(requestError?.message || 'Update failed.');
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (requestError) {
      console.error('Failed to mark as read', requestError);
      setError(requestError?.message || 'Failed to mark notification as read.');
    }
  };

  const columns = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div className={styles.subjectCell}>
          <strong>{row.title}</strong>
          <span>{row.message}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Audience',
      render: (row) => <StatusBadge status={row.role} />,
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (row) => <StatusBadge status={row.channel} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <StatusBadge status={row.priority} />,
    },
    {
      key: 'createdAt',
      header: 'Sent At',
      render: (row) => <span className={styles.meta}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className={styles.actions}>
          {row.status === 'UNREAD' ? (
            <Button variant="secondary" size="sm" onClick={() => void handleMarkAsRead(row.id)}>
              Mark read
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleDelete(row.id)}>
            <Trash2 size={14} />
            <span>Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Admin Notifications"
        title="Notification Control Center"
        description="Manage audience-targeted notifications and monitor what admins receive."
        actions={
          <div className={styles.headerActions}>
            <Button variant="secondary" icon={RefreshCw} onClick={() => void loadNotifications()}>
              Refresh
            </Button>
            <Button icon={Plus} to={ROUTE_PATHS.ADMIN_NOTIFICATIONS_CREATE}>
              Create Notification
            </Button>
          </div>
        }
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      <Card title="Notification center" subtitle="Switch between sent and received notifications.">
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'received' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('received')}
            >
              <BellRing size={15} />
              Received notifications
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === 'sent' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('sent')}
            >
              <SendHorizontal size={15} />
              Sent notifications
            </button>
          </div>

          <div className={styles.filters}>
            <SearchBar placeholder="Search notifications..." value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All status' : status}
                </option>
              ))}
            </select>
            <select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}>
              {AUDIENCE_FILTERS.map((role) => (
                <option key={role} value={role}>
                  {role === 'ALL' ? 'All audiences' : role}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredRows}
          loading={isLoading}
          emptyState={{
            icon: BellRing,
            title: 'No notifications found',
            description: 'Try changing filters or create a new notification.',
          }}
        />
      </Card>
    </div>
  );
}
