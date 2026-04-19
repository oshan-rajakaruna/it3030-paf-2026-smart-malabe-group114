import {
  AlertCircle,
  Bell,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import DashboardBreakdownCard from '../components/dashboard/DashboardBreakdownCard';
import DashboardQuickActions from '../components/dashboard/DashboardQuickActions';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { ROUTE_PATHS } from '../routes/routeConfig';
import { getAdminDashboardSummary } from '../services/adminDashboardService';
import { getRoleNotifications, mapNotificationToUi } from '../services/notificationApi';
import { ROLES } from '../utils/constants';
import { formatDate, formatDateTime, formatStatusLabel } from '../utils/formatters';
import styles from './DashboardPage.module.css';

function toBreakdownItems(breakdown = {}) {
  return Object.entries(breakdown).map(([key, value]) => ({
    label: formatStatusLabel(key),
    value: Number(value || 0),
  }));
}

function formatTimeRange(startTime, endTime) {
  const formattedStart = startTime ? String(startTime).slice(0, 5) : '--:--';
  const formattedEnd = endTime ? String(endTime).slice(0, 5) : '--:--';
  return `${formattedStart} - ${formattedEnd}`;
}

function DashboardSkeleton() {
  return (
    <>
      <section className={styles.overviewCard}>
        <div className={styles.overviewMain}>
          <SkeletonBlock className={styles.skeletonEyebrow} />
          <SkeletonBlock className={styles.skeletonHeading} />
          <SkeletonBlock className={styles.skeletonLine} />
          <SkeletonBlock className={styles.skeletonLineShort} />
        </div>
        <div className={styles.highlightGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className={styles.highlightSkeleton} />
          ))}
        </div>
      </section>

      <section className={styles.statsGrid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} className={styles.statSkeleton} />
        ))}
      </section>

      <section className={styles.breakdownGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={index} className={styles.panelSkeleton} />
        ))}
      </section>

      <section className={styles.recentGrid}>
        <SkeletonBlock className={styles.tableSkeleton} />
        <SkeletonBlock className={styles.tableSkeleton} />
      </section>

      <section className={styles.bottomGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBlock key={index} className={styles.panelSkeleton} />
        ))}
      </section>
    </>
  );
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');

  const quickActions = useMemo(
    () => [
      {
        label: 'Add Resource',
        description: 'Open Facilities and create a new campus resource.',
        to: ROUTE_PATHS.FACILITIES,
        icon: Building2,
        variant: 'primary',
      },
      {
        label: 'View All Bookings',
        description: 'Review pending requests and booking activity.',
        to: ROUTE_PATHS.BOOKINGS,
        icon: CalendarRange,
      },
      {
        label: 'View Tickets',
        description: 'Check incident progress and technician workload.',
        to: ROUTE_PATHS.TICKETS,
        icon: Wrench,
      },
      {
        label: 'Go to Notifications',
        description: 'Open the admin notification center for alerts.',
        to: ROUTE_PATHS.ADMIN_NOTIFICATIONS,
        icon: Bell,
      },
    ],
    [],
  );

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const response = await getAdminDashboardSummary();
      setSummary(response);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      setSummaryError(error.message || 'Failed to load dashboard summary.');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadActivity() {
    setActivityLoading(true);
    setActivityError('');

    try {
      const response = await getRoleNotifications(ROLES.ADMIN);
      const mappedNotifications = (Array.isArray(response) ? response : [])
        .map((notification) => mapNotificationToUi(notification, { role: ROLES.ADMIN }))
        .slice(0, 5);

      setActivityItems(mappedNotifications);
    } catch (error) {
      setActivityError(error.message || 'Failed to load recent activity.');
    } finally {
      setActivityLoading(false);
    }
  }

  function handleRefresh() {
    void loadSummary();
    void loadActivity();
  }

  useEffect(() => {
    void loadSummary();
    void loadActivity();
  }, []);

  if (currentUser.role !== ROLES.ADMIN) {
    return (
      <Card title="Admin dashboard only" subtitle="This overview is reserved for admins.">
        <EmptyState
          icon={ShieldCheck}
          title="Admin access required"
          description="Use the role-appropriate modules in the sidebar to continue with your daily work."
          action={
            <Button to={currentUser.role === ROLES.TECHNICIAN ? ROUTE_PATHS.TICKETS : ROUTE_PATHS.FACILITIES}>
              Open my workspace
            </Button>
          }
        />
      </Card>
    );
  }

  const unreadAlertCount = activityItems.filter((item) => item.status === 'UNREAD').length;
  const summaryStats = [
    {
      label: 'Total Resources',
      value: summary?.totalResources ?? 0,
      meta: 'All resources currently stored in the catalogue',
      trend: 'Facilities',
      icon: Building2,
      tone: 'primary',
    },
    {
      label: 'Active Resources',
      value: summary?.activeResources ?? 0,
      meta: 'Resources currently marked active and operational',
      trend: 'Live availability',
      icon: ShieldCheck,
      tone: 'success',
    },
    {
      label: 'Total Bookings',
      value: summary?.totalBookings ?? 0,
      meta: 'Overall booking records in the system',
      trend: 'Booking flow',
      icon: CalendarRange,
      tone: 'secondary',
    },
    {
      label: 'Pending Bookings',
      value: summary?.pendingBookings ?? 0,
      meta: 'Requests waiting for admin review',
      trend: 'Needs attention',
      icon: Clock3,
      tone: 'warning',
    },
    {
      label: 'Total Tickets',
      value: summary?.totalTickets ?? 0,
      meta: 'Incident and maintenance tickets tracked',
      trend: 'Service desk',
      icon: ClipboardList,
      tone: 'secondary',
    },
    {
      label: 'Open / In Progress',
      value: summary?.openAndInProgressTickets ?? 0,
      meta: 'Tickets that still need operational follow-up',
      trend: 'Active queue',
      icon: Wrench,
      tone: 'warning',
    },
  ];

  const recentBookingColumns = [
    {
      key: 'resourceName',
      header: 'Resource',
      render: (booking) => (
        <div className={styles.primaryCell}>
          <strong>{booking.resourceName || 'Campus resource'}</strong>
          <span>{booking.requesterName || 'Unknown user'}</span>
        </div>
      ),
    },
    {
      key: 'bookingDate',
      header: 'Schedule',
      render: (booking) => (
        <div className={styles.primaryCell}>
          <strong>{booking.bookingDate ? formatDate(booking.bookingDate) : 'Date not set'}</strong>
          <span>{formatTimeRange(booking.startTime, booking.endTime)}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (booking) => (booking.createdAt ? formatDateTime(booking.createdAt) : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <StatusBadge status={booking.status || 'UNKNOWN'} />,
    },
  ];

  const recentTicketColumns = [
    {
      key: 'title',
      header: 'Ticket',
      render: (ticket) => (
        <div className={styles.primaryCell}>
          <strong>{ticket.title || 'Untitled ticket'}</strong>
          <span>{ticket.location || 'Campus'}</span>
        </div>
      ),
    },
    {
      key: 'reporterName',
      header: 'Ownership',
      render: (ticket) => (
        <div className={styles.primaryCell}>
          <strong>{ticket.reporterName || 'Unknown user'}</strong>
          <span>{ticket.assignedTechnicianName || 'Unassigned'}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (ticket) => (ticket.createdAt ? formatDateTime(ticket.createdAt) : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ticket) => <StatusBadge status={ticket.status || 'UNKNOWN'} />,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Admin Dashboard"
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        description="Live campus operations overview for resources, bookings, incidents, and recent admin activity."
        actions={
          <>
            <Button variant="secondary" to={ROUTE_PATHS.ADMIN_NOTIFICATIONS} icon={Bell}>
              Notifications
            </Button>
            <Button icon={RefreshCcw} onClick={handleRefresh}>
              Refresh
            </Button>
          </>
        }
      />

      {summaryLoading && !summary ? <DashboardSkeleton /> : null}

      {!summaryLoading && !summary ? (
        <Card title="Dashboard unavailable" subtitle="The admin summary could not be loaded right now.">
          <EmptyState
            icon={AlertCircle}
            title="Failed to load live dashboard data"
            description={summaryError || 'Please try refreshing the page once the backend is available.'}
            action={
              <Button icon={RefreshCcw} onClick={handleRefresh}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : null}

      {summary ? (
        <>
          {summaryError ? (
            <div className={styles.inlineNotice} data-type="error">
              <AlertCircle size={18} />
              <span>{summaryError}</span>
            </div>
          ) : null}

          <section className={styles.overviewCard}>
            <div className={styles.overviewMain}>
              <span className={styles.overviewEyebrow}>Operations Snapshot</span>
              <h2>Real-time visibility across the core campus modules</h2>
              <p>
                The dashboard now reads live backend data for resources, bookings, tickets, and recent admin alerts.
                It is designed to surface approvals, incidents, and activity quickly without changing the existing module flows.
              </p>
              <small>
                Last refreshed {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : 'just now'}
              </small>
            </div>

            <div className={styles.highlightGrid}>
              <article className={styles.highlightCard}>
                <span>Pending bookings</span>
                <strong>{summary.pendingBookings ?? 0}</strong>
                <small>Requests waiting for review</small>
              </article>
              <article className={styles.highlightCard}>
                <span>Open ticket queue</span>
                <strong>{summary.openAndInProgressTickets ?? 0}</strong>
                <small>Issues still in progress</small>
              </article>
              <article className={styles.highlightCard}>
                <span>Unread alerts</span>
                <strong>{unreadAlertCount}</strong>
                <small>Recent admin-facing notifications</small>
              </article>
              <article className={styles.highlightCard}>
                <span>Active resources</span>
                <strong>{summary.activeResources ?? 0}</strong>
                <small>Ready for bookings and operations</small>
              </article>
            </div>
          </section>

          <section className={styles.statsGrid}>
            {summaryStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <section className={styles.breakdownGrid}>
            <DashboardBreakdownCard
              title="Resources by Type"
              subtitle="Quick split of room, lab, and equipment inventory."
              items={toBreakdownItems(summary.resourcesByType)}
            />
            <DashboardBreakdownCard
              title="Resources by Status"
              subtitle="Operational state of the facilities catalogue."
              items={toBreakdownItems(summary.resourcesByStatus)}
            />
            <DashboardBreakdownCard
              title="Bookings by Status"
              subtitle="Current booking workflow distribution."
              items={toBreakdownItems(summary.bookingsByStatus)}
            />
            <DashboardBreakdownCard
              title="Tickets by Status"
              subtitle="Live service desk workload across all incidents."
              items={toBreakdownItems(summary.ticketsByStatus)}
            />
          </section>

          <section className={styles.recentGrid}>
            <Card
              title="Recent Bookings"
              subtitle="Latest booking requests and updates from the backend."
              action={<Button to={ROUTE_PATHS.BOOKINGS} variant="ghost">View all</Button>}
            >
              <DataTable
                columns={recentBookingColumns}
                rows={summary.recentBookings || []}
                emptyState={{
                  icon: CalendarClock,
                  title: 'No recent bookings',
                  description: 'Booking activity will appear here once requests are created.',
                }}
              />
            </Card>

            <Card
              title="Recent Tickets"
              subtitle="Latest incidents reported across campus operations."
              action={<Button to={ROUTE_PATHS.TICKETS} variant="ghost">View all</Button>}
            >
              <DataTable
                columns={recentTicketColumns}
                rows={summary.recentTickets || []}
                emptyState={{
                  icon: ClipboardList,
                  title: 'No recent tickets',
                  description: 'New maintenance or incident items will appear here.',
                }}
              />
            </Card>
          </section>

          <section className={styles.bottomGrid}>
            <DashboardQuickActions actions={quickActions} />

            <Card
              title="Recently Added Resources"
              subtitle="Latest resource records that were added or updated most recently."
            >
              <div className={styles.resourceList}>
                {(summary.recentResources || []).length ? (
                  summary.recentResources.map((resource) => (
                    <article key={resource.id} className={styles.resourceItem}>
                      <div className={styles.resourceTopRow}>
                        <div>
                          <strong>{resource.name || 'Unnamed resource'}</strong>
                          <span>{resource.resourceCode || 'No resource code'}</span>
                        </div>
                        <StatusBadge status={resource.status || 'UNKNOWN'} />
                      </div>
                      <div className={styles.resourceMeta}>
                        <span>{formatStatusLabel(resource.type || 'UNSPECIFIED')}</span>
                        <span>{resource.location || 'Campus location not set'}</span>
                        <span>{resource.isActive === false ? 'Inactive' : 'Active'}</span>
                      </div>
                      <small>{resource.createdAt ? `Created ${formatDateTime(resource.createdAt)}` : 'Creation time unavailable'}</small>
                    </article>
                  ))
                ) : (
                  <p className={styles.emptyCopy}>No recent resource records available.</p>
                )}
              </div>
            </Card>

            <Card
              title="Recent Activity"
              subtitle="Latest admin notifications and alerts from the notification module."
            >
              {activityError ? (
                <div className={styles.inlineNotice} data-type="error">
                  <AlertCircle size={18} />
                  <span>{activityError}</span>
                </div>
              ) : null}

              {activityLoading ? (
                <div className={styles.activitySkeletonList}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className={styles.activitySkeleton} />
                  ))}
                </div>
              ) : null}

              {!activityLoading && !activityError ? (
                <div className={styles.activityList}>
                  {activityItems.length ? (
                    activityItems.map((item) => (
                      <article key={item.id} className={styles.activityItem}>
                        <div className={styles.activityHeader}>
                          <strong>{item.title}</strong>
                          <span className={styles.activityPill}>{formatStatusLabel(item.moduleTag)}</span>
                        </div>
                        <p>{item.message}</p>
                        <div className={styles.activityMeta}>
                          <span>{item.createdAt ? formatDateTime(item.createdAt) : 'Just now'}</span>
                          <span>{item.read ? 'Read' : 'Unread'}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className={styles.emptyCopy}>No recent admin activity available.</p>
                  )}
                </div>
              ) : null}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
