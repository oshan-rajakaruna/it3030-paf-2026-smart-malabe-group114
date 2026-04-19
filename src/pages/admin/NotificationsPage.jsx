import { useEffect, useMemo, useState } from 'react';
import { BellRing, Plus, RefreshCw, SendHorizontal, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import styles from './NotificationsPage.module.css';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import FormField from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import SearchBar from '../../components/ui/SearchBar';
import SelectField from '../../components/ui/SelectField';
import StatusBadge from '../../components/ui/StatusBadge';
import TextAreaField from '../../components/ui/TextAreaField';
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
const CHANNEL_OPTIONS = ['WEB', 'EMAIL', 'BOTH'];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH'];
const MODULE_OPTIONS = ['AUTH', 'BOOKING', 'RESOURCE', 'TICKET'];
const NOTIFICATION_STATUS_OPTIONS = ['UNREAD', 'READ'];

export default function AdminNotificationsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [allNotifications, setAllNotifications] = useState([]);
  const [receivedNotifications, setReceivedNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('received');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingNotification, setEditingNotification] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    message: '',
    role: 'ADMIN',
    module: 'AUTH',
    channel: 'WEB',
    priority: 'NORMAL',
    status: 'UNREAD',
    userId: '',
  });
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadNotifications = async ({ forceLoader = false } = {}) => {
    try {
      if (forceLoader) {
        setIsLoading(true);
      }
      const [allPayload, receivedPayload] = await Promise.all([
        getAllNotifications(),
        getRoleNotifications('ADMIN'),
      ]);

      const sortedAll = (Array.isArray(allPayload) ? allPayload : [])
        .map((notification) => mapNotificationToUi(notification, { role: 'ADMIN' }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const sortedReceived = (Array.isArray(receivedPayload) ? receivedPayload : [])
        .map((notification) => mapNotificationToUi(notification, { role: 'ADMIN' }))
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

  const openEditModal = (notification) => {
    if (activeTab !== 'sent') {
      setError('Only sent notifications can be edited.');
      return;
    }
    setEditError('');
    setEditingNotification(notification);
    setEditForm({
      title: notification.title || '',
      message: notification.message || '',
      role: notification.role || 'ADMIN',
      module: notification.module || 'AUTH',
      channel: notification.channel || 'WEB',
      priority: notification.priority || 'NORMAL',
      status: notification.status || 'UNREAD',
      userId: notification.userId || '',
    });
  };

  const handleEditFormChange = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditSave = async () => {
    if (!editingNotification) {
      return;
    }
    if (!editForm.title.trim() || !editForm.message.trim()) {
      setEditError('Subject and message are required.');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      await updateNotification(editingNotification.id, {
        title: editForm.title.trim(),
        message: editForm.message.trim(),
        role: editForm.role,
        userId: editForm.userId.trim() || null,
        module: editForm.module,
        channel: editForm.channel,
        priority: editForm.priority,
        status: editForm.status,
      });
      setEditingNotification(null);
      await loadNotifications();
    } catch (requestError) {
      console.error('Failed to edit notification', requestError);
      setEditError(requestError?.message || 'Update failed.');
    } finally {
      setIsSavingEdit(false);
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
      key: 'module',
      header: 'Tag',
      render: (row) => <StatusBadge status={row.moduleTag || row.module} />,
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
      headerClassName: styles.sentAtColumn,
      cellClassName: styles.sentAtColumn,
      render: (row) => <span className={styles.meta}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const canEdit = activeTab === 'sent';
        const canDelete = true;

        return (
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => navigate(row.actionPath || ROUTE_PATHS.DASHBOARD)}>
              Open
            </Button>
            {row.status === 'UNREAD' ? (
              <Button variant="secondary" size="sm" onClick={() => void handleMarkAsRead(row.id)}>
                Mark read
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => openEditModal(row)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className={styles.deleteIconButton}
                onClick={() => handleDelete(row.id)}
                aria-label="Delete notification"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        );
      },
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
            <Button variant="secondary" icon={RefreshCw} onClick={() => void loadNotifications({ forceLoader: true })}>
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

      <Modal
        isOpen={Boolean(editingNotification)}
        onClose={() => {
          setEditingNotification(null);
          setEditError('');
        }}
        title="Edit Notification"
        description="Update this notification using the same style as the create form."
        footer={
          editingNotification ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingNotification(null);
                  setEditError('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleEditSave()} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </Button>
            </>
          ) : null
        }
      >
        {editingNotification ? (
          <div className={styles.editFormGrid}>
            <FormField id="edit-notification-subject" label="Subject" required>
              <input
                id="edit-notification-subject"
                className={styles.control}
                value={editForm.title}
                onChange={(event) => handleEditFormChange('title', event.target.value)}
                placeholder="Notification subject"
              />
            </FormField>

            <SelectField
              id="edit-notification-audience"
              label="Audience"
              value={editForm.role}
              onChange={(event) => handleEditFormChange('role', event.target.value)}
              options={AUDIENCE_FILTERS.filter((value) => value !== 'ALL').map((value) => ({
                label: value,
                value,
              }))}
            />

            <SelectField
              id="edit-notification-channel"
              label="Channel"
              value={editForm.channel}
              onChange={(event) => handleEditFormChange('channel', event.target.value)}
              options={CHANNEL_OPTIONS.map((value) => ({ label: value, value }))}
            />

            <SelectField
              id="edit-notification-priority"
              label="Priority"
              value={editForm.priority}
              onChange={(event) => handleEditFormChange('priority', event.target.value)}
              options={PRIORITY_OPTIONS.map((value) => ({ label: value, value }))}
            />

            <SelectField
              id="edit-notification-module"
              label="Module"
              value={editForm.module}
              onChange={(event) => handleEditFormChange('module', event.target.value)}
              options={MODULE_OPTIONS.map((value) => ({ label: value, value }))}
            />

            <SelectField
              id="edit-notification-status"
              label="Status"
              value={editForm.status}
              onChange={(event) => handleEditFormChange('status', event.target.value)}
              options={NOTIFICATION_STATUS_OPTIONS.map((value) => ({ label: value, value }))}
            />

            <FormField
              id="edit-notification-user-id"
              label="Target user id (optional)"
              hint="Leave blank for audience-wide notification."
            >
              <input
                id="edit-notification-user-id"
                className={styles.control}
                value={editForm.userId}
                onChange={(event) => handleEditFormChange('userId', event.target.value)}
                placeholder="User id"
              />
            </FormField>

            <TextAreaField
              id="edit-notification-message"
              label="Message"
              value={editForm.message}
              onChange={(event) => handleEditFormChange('message', event.target.value)}
              rows={5}
              required
            />

            {editError ? <p className={styles.editError}>{editError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
