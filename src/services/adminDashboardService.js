const ADMIN_DASHBOARD_API_BASE = 'http://localhost:8080/api/admin/dashboard';

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
      `Dashboard request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function getAdminDashboardSummary() {
  const response = await fetch(`${ADMIN_DASHBOARD_API_BASE}/summary`);
  return parseResponse(response);
}
