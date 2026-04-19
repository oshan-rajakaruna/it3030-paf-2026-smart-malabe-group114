import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserRoundCheck, UserSearch, Wrench } from 'lucide-react';
import axios from 'axios';

import styles from './AdminPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { mockTickets } from '../data/tickets';
import { ROUTE_PATHS } from '../routes/routeConfig';
import { formatDateTime } from '../utils/formatters';

const USERS_API_BASE = 'http://localhost:8080/api/users';

export default function AdminPage() {
  const [managedUsers, setManagedUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [actionMessage, setActionMessage] = useState('');

  const getUserId = (user) => user?.id || user?._id || '';

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
    if (!userId) {
      setActionMessage('Unable to approve user: missing user id.');
      return;
    }
    try {
      await axios.put(`${USERS_API_BASE}/${userId}/approve`);
      setActionMessage('User approved. They can now sign in.');
      await loadAdminData();
    } catch (error) {
      console.error('Approve failed', error);
      const errorMessage = error?.response?.data?.message || 'Approve failed. Please check backend logs.';
      setActionMessage(errorMessage);
    }
  };

  const handleRejectSignup = async (userId) => {
    setActionMessage('');
    if (!userId) {
      setActionMessage('Unable to reject user: missing user id.');
      return;
    }
    try {
      await axios.put(`${USERS_API_BASE}/${userId}/reject`);
      setActionMessage('User rejected successfully.');
      await loadAdminData();
    } catch (error) {
      console.error('Reject failed', error);
      const errorMessage = error?.response?.data?.message || 'Reject failed. Please check backend logs.';
      setActionMessage(errorMessage);
    }
  };

  const handleDeleteUser = async (userId) => {
    setActionMessage('');
    if (!userId) {
      setActionMessage('Unable to delete user: missing user id.');
      return;
    }
    try {
      await axios.delete(`${USERS_API_BASE}/${encodeURIComponent(userId)}`);
      setManagedUsers((prevUsers) => prevUsers.filter((user) => getUserId(user) !== userId));
      setPendingUsers((prevUsers) => prevUsers.filter((user) => getUserId(user) !== userId));
      setActionMessage('User deleted successfully.');
    } catch (error) {
      const serverMessage = String(error?.response?.data?.message || '');
      if (serverMessage.includes('No static resource')) {
        try {
          await axios.post(`${USERS_API_BASE}/${encodeURIComponent(userId)}/delete`);
          setManagedUsers((prevUsers) => prevUsers.filter((user) => getUserId(user) !== userId));
          setPendingUsers((prevUsers) => prevUsers.filter((user) => getUserId(user) !== userId));
          setActionMessage('User deleted successfully.');
        } catch (fallbackError) {
          console.error('Delete user fallback failed', fallbackError);
          const fallbackMessage = fallbackError?.response?.data?.message || 'Delete failed. Please check backend logs.';
          setActionMessage(fallbackMessage);
        }
      } else {
        console.error('Delete user failed', error);
        const errorMessage = error?.response?.data?.message || 'Delete failed. Please check backend logs.';
        setActionMessage(errorMessage);
      }
    } finally {
      await loadAdminData();
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
      render: (user) => (
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteUser(getUserId(user))}>
          Delete
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
          <Button variant="success" size="sm" onClick={() => handleApproveSignup(getUserId(user))}>
            Approve
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleRejectSignup(getUserId(user))}>
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
        actions={
          <Button to={ROUTE_PATHS.ADMIN_NOTIFICATIONS}>Open Notifications Admin</Button>
        }
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
          {actionMessage ? <p className={styles.muted}>{actionMessage}</p> : null}
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
        </Card>
      </section>
    </div>
  );
}
