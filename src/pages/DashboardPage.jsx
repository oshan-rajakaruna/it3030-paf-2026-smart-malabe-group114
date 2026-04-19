import {
  Bell,
  Building2,
  CalendarClock,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import styles from './DashboardPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import NotificationItem from '../components/navigation/NotificationItem';
import PageHeader from '../components/ui/PageHeader';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { campusPulse, roleAwareWidgets } from '../data/dashboard';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/formatters';
import { ROLES } from '../utils/constants';
import {
  getNotificationContext,
  getRoleNotifications,
  getUserNotifications,
  mapNotificationToUi,
} from '../services/notificationApi';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const BOOKINGS_API_URL = `${BACKEND_URL}/api/bookings`;
const TICKETS_API_URL = `${BACKEND_URL}/api/tickets`;
const RESOURCES_API_URL = `${BACKEND_URL}/api/resources`;
const USERS_API_URL = `${BACKEND_URL}/api/users`;
const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS'];

function normalizeTime(timeValue) {
  if (!timeValue) {
    return '--:--';
  }
  return String(timeValue).slice(0, 5);
}

function matchesCurrentUser(value, currentUser) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return [currentUser?.id, currentUser?.name, currentUser?.email]
    .map((item) => String(item ?? '').trim().toLowerCase())
    .includes(normalizedValue);
}

function safeFormatSchedule(booking) {
  if (!booking?.date) {
    return `${booking.startTime} - ${booking.endTime}`;
  }

  try {
    return `${formatDate(booking.date)} · ${booking.startTime} - ${booking.endTime}`;
  } catch {
    return `${booking.date} · ${booking.startTime} - ${booking.endTime}`;
  }
}

async function fetchArray(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setLoading(true);

      const [resourceRows, userRows, bookingRows, ticketRows] = await Promise.all([
        fetchArray(RESOURCES_API_URL),
        fetchArray(USERS_API_URL),
        fetchArray(BOOKINGS_API_URL),
        fetchArray(TICKETS_API_URL),
      ]);

      const userLookup = Object.fromEntries(
        userRows
          .filter((user) => user?.id)
          .map((user) => [String(user.id), user]),
      );
      const resourceLookup = Object.fromEntries(
        resourceRows
          .filter((resource) => resource?.id)
          .map((resource) => [String(resource.id), resource]),
      );

      const mappedBookings = bookingRows.map((booking, index) => {
        const requesterId = String(booking?.userId ?? '');
        const requesterUser = userLookup[requesterId];
        const facility = resourceLookup[String(booking?.resourceId ?? '')];

        return {
          id: booking?.id ? `bk-${booking.id}` : `bk-fallback-${index}`,
          backendId: booking?.id ? String(booking.id) : '',
          requesterId,
          requesterName:
            requesterUser?.name ||
            (matchesCurrentUser(requesterId, currentUser) ? currentUser.name : requesterId || 'Unknown'),
          facilityName: facility?.name || `Resource ${booking?.resourceId ?? '-'}`,
          date: booking?.bookingDate || booking?.date || '',
          startTime: normalizeTime(booking?.startTime),
          endTime: normalizeTime(booking?.endTime),
          status: String(booking?.status || 'PENDING').toUpperCase(),
          purpose: booking?.description || 'Booking request',
        };
      });

      const mappedTickets = ticketRows.map((ticket, index) => {
        const reporterId = String(ticket?.createdBy ?? '');
        const reporterUser = userLookup[reporterId];
        const technicianId = String(ticket?.assignedTechnician ?? '');
        const technicianUser = userLookup[technicianId];

        return {
          id: ticket?.id || `ticket-fallback-${index}`,
          title: ticket?.title || 'Untitled ticket',
          resourceName: ticket?.location || 'Campus resource',
          status: String(ticket?.status || 'OPEN').toUpperCase(),
          reporterId,
          reporterName:
            reporterUser?.name ||
            (matchesCurrentUser(reporterId, currentUser) ? currentUser.name : reporterId || 'Unknown user'),
          technicianId,
          technicianName:
            technicianUser?.name ||
            (matchesCurrentUser(technicianId, currentUser) ? currentUser.name : technicianId || 'Unassigned'),
          createdAt: ticket?.createdAt || '',
        };
      });

      const role = String(currentUser?.role || '').toUpperCase();
      const sessionContext = getNotificationContext();
      const targetUserId = String(currentUser?.id || sessionContext?.userId || '');

      let notificationRows = [];
      try {
        if (role === ROLES.ADMIN || role === ROLES.TECHNICIAN) {
          notificationRows = await getRoleNotifications(role);
        } else if (targetUserId) {
          notificationRows = await getUserNotifications(targetUserId);
        }
      } catch {
        notificationRows = [];
      }

      const mappedNotifications = Array.isArray(notificationRows)
        ? notificationRows.map((notification) =>
            mapNotificationToUi(notification, {
              role,
              userId: targetUserId,
            }),
          )
        : [];

      if (!isMounted) {
        return;
      }

      setResources(resourceRows);
      setBookings(mappedBookings);
      setTickets(mappedTickets);
      setNotifications(mappedNotifications);
      setLoading(false);
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.role]);

  const visibleBookings = useMemo(() => {
    if (currentUser.role === ROLES.ADMIN) {
      return bookings;
    }
    return bookings.filter((booking) => matchesCurrentUser(booking.requesterId, currentUser));
  }, [bookings, currentUser]);

  const visibleTickets = useMemo(() => {
    if (currentUser.role === ROLES.ADMIN) {
      return tickets;
    }

    if (currentUser.role === ROLES.TECHNICIAN) {
      return tickets.filter((ticket) => matchesCurrentUser(ticket.technicianId, currentUser));
    }

    return tickets.filter((ticket) => matchesCurrentUser(ticket.reporterId, currentUser));
  }, [tickets, currentUser]);

  const roleWidget = roleAwareWidgets[currentUser.role] ?? roleAwareWidgets[ROLES.USER];
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;
  const pendingBookings = bookings.filter((booking) => booking.status === 'PENDING').length;
  const activeFacilities = resources.filter((facility) => facility?.isActive !== false).length;
  const openTickets = tickets.filter((ticket) => OPEN_TICKET_STATUSES.includes(ticket.status)).length;
  const openVisibleTickets = visibleTickets.filter((ticket) => OPEN_TICKET_STATUSES.includes(ticket.status)).length;
  const recentBookings = visibleBookings
    .slice()
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .slice(0, 4);
  const recentTickets = visibleTickets.slice(0, 3);

  const roleWidgetMetric =
    currentUser.role === ROLES.ADMIN
      ? `${pendingBookings} items awaiting review`
      : currentUser.role === ROLES.TECHNICIAN
        ? `${openVisibleTickets} active field tasks`
        : `${visibleBookings.filter((booking) => booking.status === 'PENDING').length} pending requests`;

  const bookingColumns = [
    {
      key: 'purpose',
      header: 'Request',
      render: (booking) => (
        <div className={styles.tablePrimary}>
          <strong>{booking.purpose}</strong>
          <span>{booking.requesterName}</span>
        </div>
      ),
    },
    {
      key: 'facilityName',
      header: 'Facility',
    },
    {
      key: 'date',
      header: 'Schedule',
      render: (booking) => safeFormatSchedule(booking),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <StatusBadge status={booking.status} />,
    },
  ];

  const stats = [
    {
      label: 'Active resources',
      value: activeFacilities,
      meta: 'Facilities and assets ready for requests',
      trend: 'Live catalogue',
      icon: Building2,
      tone: 'primary',
    },
    {
      label: currentUser.role === ROLES.ADMIN ? 'Pending approvals' : 'My recent bookings',
      value: currentUser.role === ROLES.ADMIN ? pendingBookings : visibleBookings.length,
      meta: 'Booking workflow visibility',
      trend: 'Operational flow',
      icon: CalendarClock,
      tone: 'secondary',
    },
    {
      label: currentUser.role === ROLES.TECHNICIAN ? 'Assigned tickets' : 'Open incidents',
      value: currentUser.role === ROLES.ADMIN ? openTickets : openVisibleTickets,
      meta: 'Maintenance issues requiring attention',
      trend: 'Maintenance queue',
      icon: Wrench,
      tone: 'warning',
    },
    {
      label: 'Unread alerts',
      value: unreadNotifications,
      meta: 'Notifications available in the topbar',
      trend: 'Actionable updates',
      icon: Bell,
      tone: 'success',
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Campus Operations Overview"
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        description="This dashboard is structured for quick demos today and clean API integration later. Each card and panel is modular so teammates can extend it safely."
        actions={
          <>
            <Button variant="secondary" icon={Sparkles}>
              Demo insights
            </Button>
            <Button icon={ShieldCheck}>Role-aware preview</Button>
          </>
        }
      />

      <section className={styles.statsGrid}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className={styles.mainGrid}>
        <Card
          title="Recent bookings"
          subtitle="Latest requests visible for the current role."
          action={
            <Button variant="ghost" size="sm">
              View all
            </Button>
          }
        >
          <DataTable
            columns={bookingColumns}
            rows={recentBookings}
            loading={loading}
            emptyState={{
              title: 'No bookings yet',
              description:
                currentUser.role === ROLES.USER
                  ? 'Your latest booking requests will appear here.'
                  : 'No booking activity found yet.',
            }}
          />
        </Card>

        <Card
          title={roleWidget.title}
          subtitle={roleWidget.description}
          action={<StatusBadge status={currentUser.role} />}
        >
          <div className={styles.roleMetric}>{roleWidgetMetric || roleWidget.metric}</div>
          <div className={styles.actionList}>
            {roleWidget.actions.map((action) => (
              <div key={action} className={styles.actionItem}>
                <MoveRight size={16} />
                <span>{action}</span>
              </div>
            ))}
          </div>
          <Button>Open priority flow</Button>
        </Card>
      </section>

      <section className={styles.secondaryGrid}>
        <Card title="Open tickets snapshot" subtitle="Comments, assignments, and statuses can be expanded from the tickets page.">
          <div className={styles.ticketList}>
            {loading ? (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            ) : recentTickets.length ? (
              recentTickets.map((ticket) => (
                <article key={ticket.id} className={styles.ticketItem}>
                  <div>
                    <strong>{ticket.title}</strong>
                    <p>{ticket.resourceName}</p>
                  </div>
                  <div className={styles.ticketMeta}>
                    <StatusBadge status={ticket.status} />
                    <span>{ticket.technicianName}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className={styles.tablePrimary}>No tickets available for this role yet.</p>
            )}
          </div>
        </Card>

        <Card title="Campus pulse" subtitle="Optional analytics-style widgets ready for future backend data.">
          <div className={styles.pulseList}>
            {campusPulse.map((item) => (
              <div key={item.label} className={styles.pulseItem}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className={styles.bottomGrid}>
        <Card title="Notifications preview" subtitle="Live notifications for your current role.">
          <div className={styles.notificationList}>
            {loading ? (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            ) : notifications.length ? (
              notifications.slice(0, 3).map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            ) : (
              <p className={styles.tablePrimary}>No notifications yet.</p>
            )}
          </div>
        </Card>

        <Card title="Upcoming API widgets" subtitle="Skeleton placeholders indicate where live charts and service stats can attach later.">
          <div className={styles.skeletonStack}>
            <SkeletonBlock className={styles.skeletonTitle} />
            <SkeletonBlock className={styles.skeletonLine} />
            <SkeletonBlock className={styles.skeletonLine} />
            <SkeletonBlock className={styles.skeletonCard} />
          </div>
        </Card>
      </section>
    </div>
  );
}

