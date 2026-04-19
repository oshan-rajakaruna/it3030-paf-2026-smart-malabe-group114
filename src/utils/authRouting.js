import { ROLES } from './constants';
import { ROUTE_PATHS } from '../routes/routeConfig';

export function resolveRoleAndPath(normalizedEmail) {
  if (/^.+admin@sliit\.lk$/.test(normalizedEmail)) {
    return { role: ROLES.ADMIN, path: ROUTE_PATHS.ADMIN };
  }
  if (/^.+tech@sliit\.lk$/.test(normalizedEmail)) {
    return { role: ROLES.TECHNICIAN, path: ROUTE_PATHS.DASHBOARD };
  }
  return { role: ROLES.USER, path: ROUTE_PATHS.DASHBOARD };
}
