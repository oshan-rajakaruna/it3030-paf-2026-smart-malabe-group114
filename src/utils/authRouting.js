import { ROLES } from './constants';
import { ROUTE_PATHS } from '../routes/routeConfig';

export function getDefaultRouteForRole(role) {
  const normalizedRole = String(role || ROLES.USER).toUpperCase();

  if (normalizedRole === ROLES.ADMIN) {
    return ROUTE_PATHS.DASHBOARD;
  }

  if (normalizedRole === ROLES.TECHNICIAN) {
    return ROUTE_PATHS.TICKETS;
  }

  return ROUTE_PATHS.FACILITIES;
}

export function resolveRoleAndPath(normalizedEmail) {
  if (/^.+admin@sliit\.lk$/.test(normalizedEmail)) {
    return { role: ROLES.ADMIN, path: getDefaultRouteForRole(ROLES.ADMIN) };
  }
  if (/^.+tech@sliit\.lk$/.test(normalizedEmail)) {
    return { role: ROLES.TECHNICIAN, path: getDefaultRouteForRole(ROLES.TECHNICIAN) };
  }
  return { role: ROLES.USER, path: getDefaultRouteForRole(ROLES.USER) };
}
