import {
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

import styles from './DashboardPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import NotificationItem from '../components/navigation/NotificationItem';
import PageHeader from '../components/ui/PageHeader';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { mockBookings } from '../data/bookings';
import { campusPulse, roleAwareWidgets } from '../data/dashboard';
import { mockFacilities } from '../data/facilities';
import { mockNotifications } from '../data/notifications';
import { mockTickets } from '../data/tickets';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/formatters';
import { ROLES } from '../utils/constants';

export default function DashboardPage() {
  const { currentUser } = useAuth();

  const visibleBookings =
    currentUser.role === ROLES.ADMIN ? mockBookings : mockBookings.filter((booking) => booking.requesterId === currentUser.id);

  const visibleTickets =
    currentUser.role === ROLES.USER
      ? mockTickets.filter((ticket) => ticket.reporterId === currentUser.id)
      : currentUser.role === ROLES.TECHNICIAN
        ? mockTickets.filter((ticket) => ticket.technicianId === currentUser.id)
        : mockTickets;

  const roleWidget = roleAwareWidgets[currentUser.role];
  const unreadNotifications = mockNotifications.filter((notification) => !notification.read).length;
  const pendingBookings = mockBookings.filter((booking) => booking.status === 'PENDING').length;
  const activeFacilities = mockFacilities.filter((facility) => facility.status !== 'OUT_OF_SERVICE').length;
  const openTickets = mockTickets.filter((ticket) => ['OPEN', 'IN_PROGRESS'].includes(ticket.status)).length;

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
      render: (booking) => `${formatDate(booking.date)} · ${booking.startTime} - ${booking.endTime}`,
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
      value: visibleTickets.length,
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
          <DataTable columns={bookingColumns} rows={visibleBookings.slice(0, 4)} />
        </Card>

        <Card
          title={roleWidget.title}
          subtitle={roleWidget.description}
          action={<StatusBadge status={currentUser.role} />}
        >
          <div className={styles.roleMetric}>{roleWidget.metric}</div>
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
            {mockTickets.slice(0, 3).map((ticket) => (
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
            ))}
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
        <Card title="Notifications preview" subtitle="Read and unread states are mocked for the base UI.">
          <div className={styles.notificationList}>
            {mockNotifications.slice(0, 3).map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
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
