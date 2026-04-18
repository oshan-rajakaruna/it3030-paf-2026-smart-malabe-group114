import {
  Bell,
  Building2,
  CalendarRange,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
};

export const ROLE_OPTIONS = [
  { label: 'User', value: ROLES.USER, description: 'Students and staff request bookings and track tickets.' },
  { label: 'Admin', value: ROLES.ADMIN, description: 'Approves bookings, manages roles, and monitors operations.' },
  { label: 'Technician', value: ROLES.TECHNICIAN, description: 'Handles assigned incidents and updates resolutions.' },
];

export const FACILITY_TYPES = ['Lecture Hall', 'Lab', 'Meeting Room', 'Equipment', 'Studio'];

export const FACILITY_STATUS_OPTIONS = ['ALL', 'ACTIVE', 'LIMITED', 'OUT_OF_SERVICE'];

export const CAPACITY_OPTIONS = ['ALL', '1-20', '21-50', '51-120', '120+'];

export const LOCATIONS = ['All Locations', 'Block A', 'Block B', 'Innovation Centre', 'Library Wing', 'Media Hub'];

export const BOOKING_STATUS_OPTIONS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export const TICKET_STATUS_OPTIONS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];

export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

export const NOTIFICATION_TYPES = ['BOOKING', 'TICKET', 'COMMENT', 'SYSTEM'];

export const NOTIFICATION_FILTERS = ['ALL', ...NOTIFICATION_TYPES];

export const NOTIFICATION_PREFERENCE_OPTIONS = [
  { id: 'bookingUpdates', label: 'Booking approvals and rejections' },
  { id: 'ticketUpdates', label: 'Ticket status changes' },
  { id: 'commentAlerts', label: 'New comments on assigned tickets' },
  { id: 'systemBroadcasts', label: 'Campus-wide system notices' },
];

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview and live activity',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
  {
    label: 'Facilities',
    path: '/facilities',
    icon: Building2,
    description: 'Catalogue and resource discovery',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
  {
    label: 'Bookings',
    path: '/bookings',
    icon: CalendarRange,
    description: 'Booking requests and approvals',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
  {
    label: 'Tickets',
    path: '/tickets',
    icon: Wrench,
    description: 'Maintenance and incident tracking',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: Bell,
    description: 'Alerts and updates',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
  {
    label: 'User Role',
    path: '/admin',
    icon: ShieldCheck,
    description: 'User roles, approvals, assignments',
    roles: [ROLES.ADMIN],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    description: 'Profile and preferences',
    roles: [ROLES.USER, ROLES.ADMIN, ROLES.TECHNICIAN],
  },
];
