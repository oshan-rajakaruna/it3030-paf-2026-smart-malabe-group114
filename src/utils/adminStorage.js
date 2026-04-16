const STORAGE_KEYS = {
  PENDING_SIGNUPS: 'smart-campus-pending-signups',
  APPROVED_SIGNUPS: 'smart-campus-approved-signups',
  LOGIN_ACTIVITY: 'smart-campus-login-activity',
  LATEST_PENDING_ID: 'smart-campus-latest-pending-signup-id',
};

function readJson(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures in restrictive environments.
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPendingSignups() {
  return readJson(STORAGE_KEYS.PENDING_SIGNUPS, []);
}

export function replacePendingSignups(items) {
  writeJson(STORAGE_KEYS.PENDING_SIGNUPS, Array.isArray(items) ? items : []);
}

export function getApprovedSignups() {
  return readJson(STORAGE_KEYS.APPROVED_SIGNUPS, []);
}

export function getPendingSignupById(id) {
  if (!id) {
    return null;
  }
  return getPendingSignups().find((item) => item.id === id) ?? null;
}

export function setLatestPendingSignupId(id) {
  if (!id || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.LATEST_PENDING_ID, id);
  } catch (error) {
    // Ignore storage failures in restrictive environments.
  }
}

export function getLatestPendingSignup() {
  const signups = getPendingSignups();
  if (!signups.length) {
    return null;
  }

  if (typeof window !== 'undefined') {
    try {
      const latestId = window.localStorage.getItem(STORAGE_KEYS.LATEST_PENDING_ID);
      if (latestId) {
        const matched = signups.find((item) => item.id === latestId);
        if (matched) {
          return matched;
        }
      }
    } catch (error) {
      // Ignore storage failures in restrictive environments.
    }
  }

  return signups[0] ?? null;
}

export function createPendingSignup(payload) {
  const pendingSignups = getPendingSignups();
  const request = {
    id: createId('pending-signup'),
    status: 'PENDING',
    requestedAt: new Date().toISOString(),
    ...payload,
  };

  writeJson(STORAGE_KEYS.PENDING_SIGNUPS, [request, ...pendingSignups]);
  setLatestPendingSignupId(request.id);
  return request;
}

export function approvePendingSignup(requestId, approvedBy = 'Admin') {
  const pending = getPendingSignups();
  const target = pending.find((item) => item.id === requestId);
  if (!target) {
    return null;
  }

  const remaining = pending.filter((item) => item.id !== requestId);
  const approved = {
    ...target,
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    approvedBy,
  };

  const approvedSignups = getApprovedSignups();
  writeJson(STORAGE_KEYS.PENDING_SIGNUPS, remaining);
  writeJson(STORAGE_KEYS.APPROVED_SIGNUPS, [approved, ...approvedSignups]);
  return approved;
}

export function updatePendingSignup(requestId, patch) {
  const pending = getPendingSignups();
  const updated = pending.map((item) => (item.id === requestId ? { ...item, ...patch } : item));
  writeJson(STORAGE_KEYS.PENDING_SIGNUPS, updated);
  return updated.find((item) => item.id === requestId) || null;
}

export function rejectPendingSignup(requestId, rejectedBy = 'Admin') {
  const pending = getPendingSignups();
  const target = pending.find((item) => item.id === requestId);
  if (!target) {
    return null;
  }

  const remaining = pending.filter((item) => item.id !== requestId);
  writeJson(STORAGE_KEYS.PENDING_SIGNUPS, remaining);
  return {
    ...target,
    status: 'REJECTED',
    rejectedAt: new Date().toISOString(),
    rejectedBy,
  };
}

export function getLoginActivity() {
  return readJson(STORAGE_KEYS.LOGIN_ACTIVITY, []);
}

export function appendLoginActivity(entry) {
  const activity = getLoginActivity();
  const next = [
    {
      id: createId('login'),
      loggedInAt: new Date().toISOString(),
      ...entry,
    },
    ...activity,
  ].slice(0, 200);

  writeJson(STORAGE_KEYS.LOGIN_ACTIVITY, next);
}
