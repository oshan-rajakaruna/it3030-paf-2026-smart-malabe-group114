import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import CreateNotification from '../pages/admin/CreateNotification';
import AdminNotificationsPage from '../pages/admin/NotificationsPage';
import AdminPage from '../pages/AdminPage';
import BookingsPage from '../pages/BookingsPage';
import DashboardPage from '../pages/DashboardPage';
import FacilitiesPage from '../pages/FacilitiesPage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import OAuthSuccess from '../pages/OAuthSuccess';
import SettingsPage from '../pages/SettingsPage';
import SignupPage from '../pages/SignupPage';
import SignupPendingPage from '../pages/SignupPendingPage';
import TicketsPage from '../pages/TicketsPage';
import { ROLES } from '../utils/constants';
import { ROUTE_PATHS } from './routeConfig';

function HomeRedirect() {
  return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route index element={<HomeRedirect />} />
      <Route path={ROUTE_PATHS.LOGIN} element={<LoginPage />} />
      <Route path={ROUTE_PATHS.SIGNUP} element={<SignupPage />} />
      <Route path={ROUTE_PATHS.SIGNUP_PENDING} element={<SignupPendingPage />} />
      <Route path={ROUTE_PATHS.OAUTH_SUCCESS} element={<OAuthSuccess />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path={ROUTE_PATHS.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTE_PATHS.FACILITIES} element={<FacilitiesPage />} />
        <Route path={ROUTE_PATHS.BOOKINGS} element={<BookingsPage />} />
        <Route path={ROUTE_PATHS.TICKETS} element={<TicketsPage />} />
        <Route path={ROUTE_PATHS.NOTIFICATIONS} element={<NotificationsPage />} />
        <Route path={ROUTE_PATHS.SETTINGS} element={<SettingsPage />} />
        <Route
          path={ROUTE_PATHS.ADMIN}
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.ADMIN_NOTIFICATIONS}
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <AdminNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.ADMIN_NOTIFICATIONS_CREATE}
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <CreateNotification />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
