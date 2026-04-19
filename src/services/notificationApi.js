import { getDefaultRouteForRole } from '../utils/authRouting';

const NOTIFICATION_API_BASE = 'http://localhost:8080/api/notifications';
const MODULE_ACTION_PATHS = {
  AUTH: '/admin',
  BOOKING: '/bookings',
  RESOURCE: '/facilities',
  TICKET: '/tickets',
  SYSTEM: null,
};

function getNotificationActionPath(module, viewerRole = '') {
  const normalizedModule = String(module || 'SYSTEM').toUpperCase();
  const normalizedViewerRole = String(viewerRole || '').toUpperCase();
  if (normalizedModule === 'AUTH' && normalizedViewerRole && normalizedViewerRole !== 'ADMIN') {
    return '/settings';
  }
  if (normalizedModule === 'SYSTEM') {
    return getDefaultRouteForRole(normalizedViewerRole);
  }
  return MODULE_ACTION_PATHS[normalizedModule] || MODULE_ACTION_PATHS.SYSTEM;
}

function getNotificationActionLabel(module) {
  const normalizedModule = String(module || 'SYSTEM').toUpperCase();
  if (normalizedModule === 'BOOKING') return 'Open bookings';
  if (normalizedModule === 'TICKET') return 'Open tickets';
  if (normalizedModule === 'RESOURCE') return 'Open facilities';
  if (normalizedModule === 'AUTH') return 'Open user approvals';
  return 'Open dashboard';
}

async function parseResponse(response) {
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload === 'object' && (payload?.message || payload?.error)) ||
      `Notification API failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function normalizeRole(role) {
  const normalizedRole = String(role || '').toUpperCase();
  return normalizedRole === 'USER' ? 'STUDENT' : normalizedRole;
}

export async function createNotification(body) {
  const response = await fetch(NOTIFICATION_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseResponse(response);
}

export async function getAllNotifications() {
  const response = await fetch(NOTIFICATION_API_BASE);
  return parseResponse(response);
}

export async function getRoleNotifications(role) {
  const response = await fetch(`${NOTIFICATION_API_BASE}/role/${encodeURIComponent(normalizeRole(role))}`);
  return parseResponse(response);
}

export async function getUserNotifications(userId) {
  const response = await fetch(`${NOTIFICATION_API_BASE}/user/${encodeURIComponent(userId)}`);
  return parseResponse(response);
}

export async function markNotificationAsRead(id) {
  const response = await fetch(`${NOTIFICATION_API_BASE}/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
  });
  return parseResponse(response);
}

export async function updateNotification(id, body) {
  const response = await fetch(`${NOTIFICATION_API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
}

export async function deleteNotification(id) {
  const response = await fetch(`${NOTIFICATION_API_BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to delete notification (${response.status})`);
  }
  return true;
}

export function getNotificationContext() {
  let role = null;
  let userId = null;

  try {
    const rawSession = localStorage.getItem('smart-campus-session');
    if (rawSession) {
      const parsedSession = JSON.parse(rawSession);
      role = parsedSession?.role || null;
      userId = parsedSession?.userId || null;
    }
  } catch (error) {
    role = null;
    userId = null;
  }

  // Backward compatibility with older localStorage keys.
  if (!role) {
    role = localStorage.getItem('role');
  }
  if (!userId) {
    userId = localStorage.getItem('userId');
  }

  return {
    role: normalizeRole(role),
    userId,
  };
}

export function mapNotificationToUi(notification, context = {}) {
  const module = String(notification?.module || 'AUTH').toUpperCase();
  const read = String(notification?.status || 'UNREAD').toUpperCase() === 'READ';
  const priority = String(notification?.priority || 'NORMAL').toUpperCase();
  const role = String(context?.role || '').toUpperCase();

  return {
    id: notification?.id,
    title: notification?.title || 'Notification',
    message: notification?.message || 'No details provided.',
    role: String(notification?.role || 'ALL').toUpperCase(),
    userId: notification?.userId || null,
    module,
    channel: String(notification?.channel || 'WEB').toUpperCase(),
    priority,
    status: read ? 'READ' : 'UNREAD',
    read,
    createdAt: notification?.createdAt || new Date().toISOString(),
    createdBy: notification?.createdBy || 'SYSTEM',
    moduleTag: module,
    priorityTag: priority,
    actionPath: getNotificationActionPath(module, role),
    actionLabel: getNotificationActionLabel(module),
  };
}
