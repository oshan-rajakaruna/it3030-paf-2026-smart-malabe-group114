const STATUS_TONES = {
  ACTIVE: 'success',
  APPROVED: 'success',
  RESOLVED: 'success',
  OPEN: 'warning',
  PENDING: 'warning',
  IN_PROGRESS: 'secondary',
  LIMITED: 'secondary',
  CANCELLED: 'neutral',
  CLOSED: 'neutral',
  REJECTED: 'danger',
  OUT_OF_SERVICE: 'danger',
  BOOKING: 'primary',
  TICKET: 'secondary',
  COMMENT: 'warning',
  SYSTEM: 'neutral',
  USER: 'primary',
  ADMIN: 'secondary',
  TECHNICIAN: 'warning',
};

export function getStatusTone(status = '') {
  return STATUS_TONES[status] ?? 'neutral';
}
