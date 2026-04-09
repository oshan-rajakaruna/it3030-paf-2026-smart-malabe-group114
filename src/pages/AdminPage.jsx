import { ShieldCheck, UserCog, UserRoundCheck, Wrench } from 'lucide-react';

import styles from './AdminPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { mockBookings } from '../data/bookings';
import { mockTickets } from '../data/tickets';
import { mockUsers } from '../data/users';
import { formatDate, formatRoleLabel } from '../utils/formatters';

export default function AdminPage() {
  const pendingBookings = mockBookings.filter((booking) => booking.status === 'PENDING');
  const technicianUsers = mockUsers.filter((user) => user.role === 'TECHNICIAN');

  const userColumns = [
    {
      key: 'name',
      header: 'User',
      render: (user) => (
        <div className={styles.primaryCell}>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <StatusBadge status={user.role} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        <Button variant="secondary" size="sm">
          Edit role
        </Button>
      ),
    },
  ];

  const bookingColumns = [
    {
      key: 'purpose',
      header: 'Request',
      render: (booking) => (
        <div className={styles.primaryCell}>
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
      header: 'Date',
      render: (booking) => formatDate(booking.date),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <StatusBadge status={booking.status} />,
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right',
      render: () => (
        <div className={styles.rowActions}>
          <Button variant="success" size="sm">
            Approve
          </Button>
          <Button variant="danger" size="sm">
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Admin Management"
        title="Admin command center"
        description="This page groups role management, booking approvals, and technician workload placeholders so individual team contributions stay visible and easy to demo."
        actions={<Button icon={ShieldCheck}>Admin action placeholder</Button>}
      />

      <section className={styles.statsGrid}>
        <StatCard icon={UserRoundCheck} label="Users in mock directory" value={mockUsers.length} meta="Ready for future user service integration" />
        <StatCard icon={ShieldCheck} label="Pending approvals" value={pendingBookings.length} meta="Bookings waiting for admin action" tone="warning" />
        <StatCard icon={Wrench} label="Open maintenance issues" value={mockTickets.filter((ticket) => ticket.status !== 'CLOSED').length} meta="Cross-team visibility for operations" tone="secondary" />
      </section>

      <section className={styles.grid}>
        <Card title="User and role management" subtitle="Shared table structure minimizes future RBAC UI duplication.">
          <DataTable columns={userColumns} rows={mockUsers} />
        </Card>

        <Card title="Approve or reject bookings" subtitle="Admin actions are placeholders until backend decisions and notifications are wired.">
          <DataTable columns={bookingColumns} rows={pendingBookings} />
        </Card>
      </section>

      <Card title="Technician assignment board" subtitle="Simple workload cards help the team extend this into SLA or dispatch management later.">
        <div className={styles.technicianGrid}>
          {technicianUsers.map((technician) => {
            const assignedCount = mockTickets.filter((ticket) => ticket.technicianId === technician.id && ticket.status !== 'CLOSED').length;

            return (
              <article key={technician.id} className={styles.technicianCard}>
                <div className={styles.technicianHeader}>
                  <div>
                    <strong>{technician.name}</strong>
                    <span>{formatRoleLabel(technician.role)}</span>
                  </div>
                  <StatusBadge status="IN_PROGRESS" />
                </div>
                <p>{technician.department}</p>
                <div className={styles.technicianMeta}>
                  <span>Active assignments</span>
                  <strong>{assignedCount}</strong>
                </div>
                <Button variant="secondary" icon={UserCog}>
                  Reassign work
                </Button>
              </article>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
