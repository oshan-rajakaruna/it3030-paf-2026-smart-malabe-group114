import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, UserRoundCheck, UserSearch, Wrench } from 'lucide-react';
import axios from 'axios';

import styles from './AdminPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { mockTickets } from '../data/tickets';
import { formatDateTime } from '../utils/formatters';

const USERS_API_BASE = 'http://localhost:8080/api/users';

export default function AdminPage() {
  const [managedUsers, setManagedUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [actionMessage, setActionMessage] = useState('');

  const loadAdminData = useCallback(async () => {
    try {
      const [usersResponse, pendingResponse] = await Promise.all([
        axios.get(USERS_API_BASE),
        axios.get(`${USERS_API_BASE}/pending`),
      ]);
      setManagedUsers(usersResponse.data || []);
      setPendingUsers(pendingResponse.data || []);
    } catch (error) {
      console.error('Failed to load admin dashboard data', error);
      setActionMessage('Failed to load latest database users. Please retry.');
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
    const refreshTimer = setInterval(() => {
      void loadAdminData();
    }, 8000);

    return () => clearInterval(refreshTimer);
  }, [loadAdminData]);

  const handleApproveSignup = async (userId) => {
    setActionMessage('');
    try {
      await axios.put(`${USERS_API_BASE}/${userId}/approve`);
      setActionMessage('User approved. They can now sign in.');
      await loadAdminData();
    } catch (error) {
      console.error('Approve failed', error);
      setActionMessage('Approve failed. Please check backend logs.');
    }
  };

  const handleRejectSignup = async (userId) => {
    setActionMessage('');
    try {
      await axios.put(`${USERS_API_BASE}/${userId}/reject`);
      setActionMessage('User rejected successfully.');
      await loadAdminData();
    } catch (error) {
      console.error('Reject failed', error);
      setActionMessage('Reject failed. Please check backend logs.');
    }
  };

  const userColumns = [
    {
      key: 'name',
      header: 'User',
      render: (user) => <strong>{user.name}</strong>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => <span className={styles.muted}>{user.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <StatusBadge status={user.role} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (user) => (user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className={styles.muted}>Never</span>),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: () => (
        <Button variant="secondary" size="sm" disabled>
          Synced
        </Button>
      ),
    },
  ];

  const signupColumns = [
    {
      key: 'name',
      header: 'Signup User',
      render: (user) => (
        <div className={styles.primaryCell}>
          <strong>{user.name || 'Not provided'}</strong>
          <span>{user.email || 'No email provided'}</span>
        </div>
      ),
    },
    {
      key: 'idNumber',
      header: 'ID Number',
      render: (user) => <span className={styles.muted}>{user.idNumber || '-'}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <StatusBadge status={user.role || 'USER'} />,
    },
    {
      key: 'createdAt',
      header: 'Requested At',
      render: (user) => (user.createdAt ? formatDateTime(user.createdAt) : <span className={styles.muted}>-</span>),
    },
    {
      key: 'decision',
      header: 'Decision',
      align: 'right',
      render: (user) => (
        <div className={styles.rowActions}>
          <Button variant="success" size="sm" onClick={() => handleApproveSignup(user.id)}>
            Approve
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleRejectSignup(user.id)}>
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
        description="User and role management is now synced directly with the database, so deleted users disappear automatically."
        
      />

      <section className={styles.statsGrid}>
        <StatCard
          icon={UserRoundCheck}
          label="Users in database"
          value={managedUsers.length}
          meta="Live user records from MySQL"
        />
        <StatCard
          icon={ShieldCheck}
          label="Pending signup approvals"
          value={pendingUsers.length}
          meta="Users waiting for admin decision"
          tone="warning"
        />
        <StatCard
          icon={Wrench}
          label="Open maintenance issues"
          value={mockTickets.filter((ticket) => ticket.status !== 'CLOSED').length}
          meta="Cross-team visibility for operations"
          tone="secondary"
        />
      </section>

      <section className={styles.grid}>
        <Card title="User and role management" subtitle="Live records from database users table.">
          <DataTable columns={userColumns} rows={managedUsers} />
        </Card>

        <Card title="Signup approval queue" subtitle="Approve or reject pending users from the database.">
          <DataTable
            columns={signupColumns}
            rows={pendingUsers}
            emptyState={{
              icon: UserSearch,
              title: 'No pending signups',
              description: 'No users are currently waiting for admin approval.',
            }}
          />
          {actionMessage ? <p className={styles.muted}>{actionMessage}</p> : null}
        </Card>
      </section>
    </div>
  );
}
