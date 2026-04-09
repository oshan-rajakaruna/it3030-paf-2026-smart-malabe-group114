import { ROLES } from '../utils/constants';

export const roleAwareWidgets = {
  [ROLES.USER]: {
    title: 'My next priority',
    metric: '2 pending requests',
    description: 'Track your upcoming approvals, rejections, and ticket follow-ups from one place.',
    actions: ['Create booking request', 'Report maintenance issue'],
  },
  [ROLES.ADMIN]: {
    title: 'Operations control',
    metric: '4 items awaiting review',
    description: 'Focus on pending approvals, technician balancing, and service-critical incidents.',
    actions: ['Review booking queue', 'Assign technician'],
  },
  [ROLES.TECHNICIAN]: {
    title: 'Technician focus',
    metric: '3 active field tasks',
    description: 'Keep response times low by triaging urgent issues and updating resolution notes.',
    actions: ['Update ticket status', 'Log resolution note'],
  },
};

export const campusPulse = [
  { label: 'Utilization trend', value: '+12%', note: 'Compared with last week' },
  { label: 'Approval turnaround', value: '2.3h', note: 'Average mock response time' },
  { label: 'Incident resolution', value: '86%', note: 'Resolved within SLA target' },
];
