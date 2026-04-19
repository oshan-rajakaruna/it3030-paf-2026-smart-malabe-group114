export function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(' ');
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatRoleLabel(role) {
  const normalizedRole = String(role || '');
  if (normalizedRole.toUpperCase() === 'USER') {
    return 'Student';
  }

  return normalizedRole.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatStatusLabel(status) {
  const normalizedStatus = String(status || '');
  if (normalizedStatus.toUpperCase() === 'USER') {
    return 'Student';
  }

  return normalizedStatus
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
