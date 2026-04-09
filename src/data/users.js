import { ROLES } from '../utils/constants';

export const mockUsers = [
  {
    id: 'user-001',
    name: 'Ayesha Perera',
    role: ROLES.USER,
    email: 'ayesha.perera@sliit.lk',
    department: 'Faculty of Computing',
    phone: '+94 77 123 4501',
    title: 'Student Coordinator',
  },
  {
    id: 'admin-001',
    name: 'Kavindu Silva',
    role: ROLES.ADMIN,
    email: 'kavindu.silva@sliit.lk',
    department: 'Campus Operations Office',
    phone: '+94 71 444 2811',
    title: 'Operations Administrator',
  },
  {
    id: 'tech-001',
    name: 'Nethmi Fernando',
    role: ROLES.TECHNICIAN,
    email: 'nethmi.fernando@sliit.lk',
    department: 'Facilities Maintenance',
    phone: '+94 76 221 8440',
    title: 'Lead Technician',
  },
  {
    id: 'user-002',
    name: 'Dilan Samarasinghe',
    role: ROLES.USER,
    email: 'dilan.samarasinghe@sliit.lk',
    department: 'Business School',
    phone: '+94 75 332 5510',
    title: 'Lecturer',
  },
  {
    id: 'tech-002',
    name: 'Ravini Jayasundara',
    role: ROLES.TECHNICIAN,
    email: 'ravini.jayasundara@sliit.lk',
    department: 'IT Support Services',
    phone: '+94 70 664 9022',
    title: 'Support Technician',
  },
];

export const rolePreviewCards = [
  {
    role: ROLES.USER,
    headline: 'Request rooms, labs, and equipment in minutes.',
  },
  {
    role: ROLES.ADMIN,
    headline: 'Review campus demand, approvals, and assignments from one hub.',
  },
  {
    role: ROLES.TECHNICIAN,
    headline: 'Track incidents, update fixes, and close maintenance loops quickly.',
  },
];
