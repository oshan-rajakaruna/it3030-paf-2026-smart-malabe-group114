import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  QrCode,
  Search,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import styles from './BookingsPage.module.css';
import fieldStyles from '../components/ui/Field.module.css';
import campusMark from '../assets/campus-mark.png';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import SmartSuggestionsCard from '../components/dashboard/SmartSuggestionsCard';
import Modal from '../components/ui/Modal';
import SearchBar from '../components/ui/SearchBar';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import StatusBadge from '../components/ui/StatusBadge';
import { mockBookings } from '../data/bookings';
import { mockFacilities } from '../data/facilities';
import { mockNotifications } from '../data/notifications';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatDateTime, joinClassNames } from '../utils/formatters';

const CALENDAR_MODES = ['Weekly', 'Monthly'];
const PAGE_SECTIONS = {
  OVERVIEW: 'OVERVIEW',
  BOOKINGS: 'BOOKINGS',
  CREATE: 'CREATE',
};
const CREATE_VIEW_MODES = {
  LIST: 'LIST',
  FORM: 'FORM',
};
const DAY_MINUTES_START = 8 * 60;
const DAY_MINUTES_END = 19 * 60;
const weeklyTimeSlots = Array.from({ length: 12 }, (_, index) => `${(8 + index).toString().padStart(2, '0')}:00`);

const initialForm = {
  facilityId: '',
  date: '2026-04-15',
  startTime: '14:00',
  endTime: '16:00',
  purpose: '',
  attendees: '24',
};

const timelineSteps = ['Created', 'Pending', 'Approved', 'Cancelled'];

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function addDays(value, days) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toDateKey(value) {
  return value.toISOString().slice(0, 10);
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function formatTimeRange(startTime, endTime) {
  return `${startTime} - ${endTime}`;
}

function getTimelineIndex(status) {
  if (status === 'CANCELLED') return 3;
  if (status === 'APPROVED') return 2;
  return 1;
}

function buildAvailability(bookings, facilityId, date) {
  const dayBookings = bookings
    .filter(
      (booking) =>
        booking.facilityId === facilityId &&
        booking.date === date &&
        !['REJECTED', 'CANCELLED'].includes(booking.status),
    )
    .sort((left, right) => toMinutes(left.startTime) - toMinutes(right.startTime));

  const windows = [];
  let cursor = DAY_MINUTES_START;

  dayBookings.forEach((booking) => {
    const start = toMinutes(booking.startTime);
    const end = toMinutes(booking.endTime);

    if (start > cursor) {
      windows.push({ startTime: fromMinutes(cursor), endTime: fromMinutes(start) });
    }

    cursor = Math.max(cursor, end);
  });

  if (cursor < DAY_MINUTES_END) {
    windows.push({ startTime: fromMinutes(cursor), endTime: fromMinutes(DAY_MINUTES_END) });
  }

  return windows.filter((window) => toMinutes(window.endTime) - toMinutes(window.startTime) >= 60);
}

function buildQrPattern(seed) {
  return Array.from({ length: 49 }, (_, index) => ((seed.charCodeAt(index % seed.length) + index * 7) % 3 === 0));
}

function getCapacityLabel(capacity) {
  if (capacity <= 20) return '1-20';
  if (capacity <= 50) return '21-50';
  if (capacity <= 120) return '51-120';
  return '120+';
}

function getCalendarDays(anchorDate, mode) {
  if (mode === 'Weekly') {
    const weekStart = addDays(anchorDate, -anchorDate.getDay());
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const startOffset = monthStart.getDay();
  const gridStart = addDays(monthStart, -startOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getBookingBlockStyle(booking) {
  const toneClass =
    booking.status === 'APPROVED'
      ? styles.blockApproved
      : booking.status === 'PENDING'
        ? styles.blockPending
        : styles.blockRejected;

  return joinClassNames(styles.bookingBlock, toneClass);
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getDurationHours(startTime, endTime) {
  return ((toMinutes(endTime) - toMinutes(startTime)) / 60).toFixed(1).replace('.0', '');
}

function inferFloor(location) {
  if (location.includes('Block A')) return 'Floor 1';
  if (location.includes('Block B')) return 'Floor 2';
  if (location.includes('Innovation Centre')) return 'Floor 3';
  if (location.includes('Media Hub')) return 'Floor 1';
  if (location.includes('Library')) return 'Floor 2';
  return 'Campus Level';
}

function drawHexBadge(pdf, x, y, radius, fillColor) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });

  pdf.setFillColor(...fillColor);
  pdf.lines(
    points.slice(1).map((point, index) => [point[0] - points[index][0], point[1] - points[index][1]]),
    points[0][0],
    points[0][1],
    [1, 1],
    'F',
    true,
  );
}

export default function BookingsPage() {
  const { currentUser } = useAuth();
  const student = currentUser ?? { id: 'user-001', name: 'Student', department: 'Smart Campus' };

  const [bookings, setBookings] = useState(mockBookings.filter((booking) => booking.requesterId === student.id));
  const [activeSection, setActiveSection] = useState(PAGE_SECTIONS.OVERVIEW);
  const [calendarMode, setCalendarMode] = useState('Weekly');
  const [calendarAnchor, setCalendarAnchor] = useState(new Date('2026-04-15T00:00:00'));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', type: 'ALL', capacity: 'ALL', startDate: '', endDate: '' });
  const [form, setForm] = useState(initialForm);
  const [conflictMessage, setConflictMessage] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [notifications, setNotifications] = useState(mockNotifications);
  const [createViewMode, setCreateViewMode] = useState(CREATE_VIEW_MODES.LIST);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setLoading(false), 950);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!qrBooking) {
      setQrCodeUrl('');
      return;
    }

    const qrValue = JSON.stringify({
      bookingId: qrBooking.id,
      resource: qrBooking.facilityName,
      date: qrBooking.date,
      startTime: qrBooking.startTime,
      endTime: qrBooking.endTime,
      requester: qrBooking.requesterName,
      status: qrBooking.status,
    });

    QRCode.toDataURL(qrValue, {
      width: 280,
      margin: 1,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
    })
      .then(setQrCodeUrl)
      .catch(() => setQrCodeUrl(''));
  }, [qrBooking]);

  useEffect(() => {
    if (!form.facilityId || !form.date || !form.startTime || !form.endTime) {
      setConflictMessage('');
      return;
    }

    const overlapsExisting = bookings.some((booking) => {
      if (booking.facilityId !== form.facilityId || booking.date !== form.date || ['REJECTED', 'CANCELLED'].includes(booking.status)) {
        return false;
      }

      return overlaps(toMinutes(form.startTime), toMinutes(form.endTime), toMinutes(booking.startTime), toMinutes(booking.endTime));
    });

    const slots = buildAvailability(bookings, form.facilityId, form.date).slice(0, 3);

    if (overlapsExisting) {
      setConflictMessage(
        slots.length
          ? `Time slot already booked. Available: ${slots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(', ')}`
          : 'Time slot already booked. No 1-hour availability remains for this date.',
      );
      return;
    }

    if (slots.length) {
      setConflictMessage(`Available: ${slots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(', ')}`);
      return;
    }

    setConflictMessage('Selected resource is available within the current operating window.');
  }, [bookings, form]);

  const filteredBookings = bookings.filter((booking) => {
    const facility = mockFacilities.find((item) => item.id === booking.facilityId);
    const matchesQuery =
      !deferredQuery ||
      [booking.facilityName, booking.purpose, booking.status, booking.date].join(' ').toLowerCase().includes(deferredQuery);
    const matchesStatus = filters.status === 'ALL' || booking.status === filters.status;
    const matchesType = filters.type === 'ALL' || facility?.type === filters.type;
    const matchesCapacity = filters.capacity === 'ALL' || getCapacityLabel(facility?.capacity ?? 0) === filters.capacity;
    const matchesStart = !filters.startDate || booking.date >= filters.startDate;
    const matchesEnd = !filters.endDate || booking.date <= filters.endDate;

    return matchesQuery && matchesStatus && matchesType && matchesCapacity && matchesStart && matchesEnd;
  });

  const approvedCount = bookings.filter((booking) => booking.status === 'APPROVED').length;
  const pendingCount = bookings.filter((booking) => booking.status === 'PENDING').length;
  const rejectedCount = bookings.filter((booking) => booking.status === 'REJECTED').length;
  const upcomingBookings = [...bookings]
    .sort((left, right) => new Date(`${left.date}T${left.startTime}`).getTime() - new Date(`${right.date}T${right.startTime}`).getTime())
    .slice(0, 4);
  const calendarDays = getCalendarDays(calendarAnchor, calendarMode);
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSuggestionAction = (suggestion) => {
    if (suggestion.id === 'free-slot') {
      setForm((current) => ({ ...current, date: '2026-04-15', startTime: '14:00', endTime: '16:00' }));
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.FORM);
      return;
    }

    if (suggestion.id === 'resource') {
      const lab = mockFacilities.find((facility) => facility.type === 'Lab' && facility.status !== 'OUT_OF_SERVICE');
      setForm((current) => ({ ...current, facilityId: lab?.id ?? current.facilityId }));
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.FORM);
      return;
    }

    setActiveSection(PAGE_SECTIONS.BOOKINGS);
  };

  const handleCreateBooking = (event) => {
    event.preventDefault();

    const facility = mockFacilities.find((item) => item.id === form.facilityId);
    if (!facility) return;

    const hasConflict = bookings.some((booking) => {
      if (booking.facilityId !== form.facilityId || booking.date !== form.date || ['REJECTED', 'CANCELLED'].includes(booking.status)) {
        return false;
      }

      return overlaps(toMinutes(form.startTime), toMinutes(form.endTime), toMinutes(booking.startTime), toMinutes(booking.endTime));
    });

    if (hasConflict) {
      setSubmitMessage('Please choose one of the suggested free slots before sending the request.');
      return;
    }

    const nextBooking = {
      id: `bk-${Date.now()}`,
      facilityId: facility.id,
      facilityName: facility.name,
      requesterId: student.id,
      requesterName: student.name,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      purpose: form.purpose,
      attendees: Number(form.attendees || 0),
      status: 'PENDING',
      adminNote: 'Student request captured and queued for approval.',
    };

    setBookings((current) => [nextBooking, ...current]);
    setSubmitMessage('Booking request created and added to My Bookings as a pending item.');
    setCreateViewMode(CREATE_VIEW_MODES.LIST);
    setForm(initialForm);
    setActiveSection(PAGE_SECTIONS.CREATE);
  };

  const handleBookingDrop = (event, nextDate) => {
    const bookingId = event.dataTransfer.getData('bookingId');
    if (!bookingId) return;

    setBookings((current) => current.map((booking) => (booking.id === bookingId ? { ...booking, date: nextDate } : booking)));
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications((current) =>
      current.map((notification) => (notification.id === notificationId ? { ...notification, read: true } : notification)),
    );
  };

  const buildBookingQrValue = (booking) =>
    JSON.stringify({
      bookingId: booking.id,
      resource: booking.facilityName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      requester: booking.requesterName,
      status: booking.status,
    });

  const downloadBookingPdf = (booking, bookingQrCodeUrl) => {
    const facility = mockFacilities.find((item) => item.id === booking.facilityId);
    const location = facility?.location ?? 'Campus resource hub';
    const floor = inferFloor(location);
    const roomCode = facility?.assetCode ?? booking.id.toUpperCase();
    const durationHours = getDurationHours(booking.startTime, booking.endTime);
    const amenities = facility?.features?.length
      ? facility.features
      : ['Air Conditioning', 'Campus Wi-Fi', 'Presentation Display', 'Power Access'];
    const altResources = mockFacilities
      .filter((item) => item.id !== booking.facilityId && item.status !== 'OUT_OF_SERVICE')
      .slice(0, 3);
    const isApproved = booking.status === 'APPROVED';
    const isRejected = booking.status === 'REJECTED';
    const theme = isRejected
      ? {
          primary: [185, 28, 28],
          accent: [239, 68, 68],
          soft: [254, 242, 242],
          panel: [254, 226, 226],
          stamp: [220, 38, 38],
          avatar: [254, 202, 202],
          footer: [127, 29, 29],
        }
      : {
          primary: [67, 56, 202],
          accent: [124, 58, 237],
          soft: [238, 242, 255],
          panel: [220, 252, 231],
          stamp: [34, 197, 94],
          avatar: [224, 231, 255],
          footer: [49, 46, 129],
        };
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const reviewDate = formatDate('2026-04-14');
    const reviewerName = isRejected ? 'Facility Review Board' : 'Campus Resource Office';
    const statusLabel = isRejected ? 'REJECTED' : isApproved ? 'APPROVED' : booking.status;
    const documentName = `UniMatrix_Booking_${statusLabel}.pdf`;

    if (isApproved) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setFillColor(236, 253, 245);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setDrawColor(22, 163, 74);
      pdf.setLineWidth(0.6);
      pdf.line(0, 4, pageWidth, 4);
      pdf.line(0, 20, pageWidth, 20);

      drawHexBadge(pdf, 15, 10.5, 5.8, [220, 252, 231]);
      pdf.addImage(campusMark, 'PNG', 10.8, 6.4, 8.4, 8.4);
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11.5);
      pdf.text('UniMatrix Smart Campus', 23, 10.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Student Booking and Resource Access Platform', 23, 15.2);

      pdf.setFillColor(220, 252, 231);
      pdf.roundedRect(pageWidth - 44, 5.5, 32, 8.5, 4, 4, 'F');
      pdf.setTextColor(6, 95, 70);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.9);
      pdf.text('OFFICIAL DOCUMENT', pageWidth - 28, 10.9, { align: 'center' });

      pdf.setFillColor(22, 163, 74);
      pdf.rect(14, 24, 3, 10, 'F');
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('STUDENT INFORMATION', 21, 31);

      pdf.roundedRect(14, 38, 140, 44, 4, 4);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(14, 38, 140, 44, 4, 4, 'S');

      const studentRows = [
        ['Full Name', student.name],
        ['Student ID', student.id?.toUpperCase() ?? 'SC-2024-ENG-0192'],
        ['Faculty', student.department ?? 'Faculty of Computing'],
        ['Email', `${student.name.toLowerCase().replace(/\s+/g, '.')}@campus.edu`],
      ];

      let studentY = 52;
      studentRows.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, 20, studentY);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 65, 85);
        pdf.text(value, 58, studentY);
        studentY += 9;
      });

      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(158, 12, 38, 250, 5, 5, 'F');
      pdf.setDrawColor(22, 163, 74);
      pdf.roundedRect(158, 12, 38, 250, 5, 5, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(22, 163, 74);
      pdf.text('QUICK INFO', 177, 38, { align: 'center' });
      pdf.setDrawColor(187, 247, 208);
      pdf.line(164, 42, 190, 42);

      const quickInfoRows = [
        ['Capacity', `${facility?.capacity ?? booking.attendees} seats`],
        ['Room Type', facility?.type ?? 'Campus Resource'],
        ['AC / Wi-Fi', 'Yes / Yes'],
        ['Projector', amenities.some((item) => /projector/i.test(item)) ? 'Available' : 'On Request'],
        ['Status', 'APPROVED'],
        ['Booking ID', booking.id.toUpperCase()],
        ['Valid Until', booking.endTime],
      ];

      let quickY = 54;
      quickInfoRows.forEach(([label, value], index) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.4);
        pdf.setTextColor(148, 163, 184);
        pdf.text(label, 177, quickY, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.8);
        pdf.setTextColor(label === 'Status' ? 22 : 51, label === 'Status' ? 163 : 65, label === 'Status' ? 74 : 85);
        pdf.text(value, 177, quickY + 7, { align: 'center' });
        if (index !== quickInfoRows.length - 1) {
          pdf.setDrawColor(226, 232, 240);
          pdf.line(166, quickY + 11, 188, quickY + 11);
        }
        quickY += 18;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(22, 163, 74);
      pdf.text('DIGITAL CHECK-IN', 177, 188, { align: 'center' });
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(166, 194, 22, 22, 2, 2, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(166, 194, 22, 22, 2, 2, 'S');
      if (bookingQrCodeUrl) {
        pdf.addImage(bookingQrCodeUrl, 'PNG', 168, 196, 18, 18);
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Scan at the resource', 177, 222, { align: 'center' });
      pdf.text('entrance to check in.', 177, 226, { align: 'center' });

      pdf.setFillColor(22, 163, 74);
      pdf.rect(14, 86, 3, 10, 'F');
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('BOOKING DETAILS', 21, 93);

      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(14, 98, 140, 64, 4, 4, 'S');

      const detailRows = [
        ['Booking Reference', booking.id.toUpperCase()],
        ['Resource Name', booking.facilityName],
        ['Resource Type', facility?.type ?? 'Campus Resource'],
        ['Building / Block', location],
        ['Floor', floor],
        ['Booking Date', formatDate(booking.date)],
        ['Start Time', booking.startTime],
        ['End Time', booking.endTime],
        ['Duration', `${durationHours} hours`],
      ];

      let detailY = 109;
      detailRows.forEach(([label, value], index) => {
        if (index % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(16, detailY - 6, 136, 8.5, 'F');
        }
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, 20, detailY);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 65, 85);
        pdf.text(value, 82, detailY);
        detailY += 7;
      });

      pdf.setFillColor(22, 163, 74);
      pdf.rect(14, 165, 3, 10, 'F');
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('APPROVAL STATUS', 21, 172);

      pdf.setFillColor(220, 252, 231);
      pdf.setDrawColor(16, 185, 129);
      pdf.roundedRect(14, 178, 140, 31, 4, 4, 'FD');
      pdf.setFillColor(5, 150, 105);
      pdf.circle(26, 193, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('✓', 26, 196, { align: 'center' });
      pdf.setTextColor(5, 150, 105);
      pdf.setFontSize(15);
      pdf.text('APPROVED', 40, 190);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(6, 95, 70);
      pdf.text('Your booking has been approved by the Campus Resource Office.', 40, 197);
      pdf.text(`Approved on: ${reviewDate}   |   Approved by: Dr. R. Fernando (${reviewerName})`, 40, 203);

      pdf.setFillColor(22, 163, 74);
      pdf.rect(14, 214, 3, 10, 'F');
      pdf.setTextColor(17, 24, 39);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('TERMS & CONDITIONS', 21, 221);

      const terms = [
        'Please arrive 5 minutes before your booking start time.',
        'Carry your Student ID and this confirmation document for entry.',
        'Present the QR code below at the entrance for digital check-in.',
        'Cancellations must be made at least 2 hours before the booking time.',
        'Any damage to campus resources will be charged to the student account.',
        'Ensure the resource is left clean and in its original state after use.',
      ];

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.8);
      pdf.setTextColor(71, 85, 105);
      terms.forEach((term, index) => {
        pdf.text(`${index + 1}. ${term}`, 20, 231 + index * 8);
      });

      pdf.setTextColor(16, 185, 129);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.text('APPROVED', 160, 255, { angle: -28, align: 'center' });

      pdf.setFillColor(21, 128, 61);
      pdf.rect(0, 282, pageWidth, 15, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('support@unimatrix.edu | +94 11 234 5678 | Student Resource Office', 14, 290);
      pdf.text(`Generated ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 290, { align: 'right' });

      pdf.save(documentName);
      return;
    }

    pdf.setFillColor(7, 17, 31);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFillColor(...theme.primary);
    pdf.rect(0, 0, pageWidth, 34, 'F');
    pdf.setFillColor(...theme.accent);
    pdf.rect(0, 34, pageWidth, 8, 'F');

    drawHexBadge(pdf, 23, 20, 9, theme.soft);
    pdf.addImage(campusMark, 'PNG', 17, 13.5, 12, 12);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('UniMatrix Smart Campus', 36, 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text('Student Booking and Resource Access Platform', 36, 24);

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(pageWidth - 54, 11, 38, 12, 6, 6, 'F');
    pdf.setTextColor(...theme.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('OFFICIAL DOCUMENT', pageWidth - 35, 18.3, { align: 'center' });

    pdf.setDrawColor(255, 255, 255);
    pdf.setTextColor(theme.stamp[0], theme.stamp[1], theme.stamp[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(34);
    pdf.text(statusLabel, 104, 173, { angle: -28, align: 'center' });

    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(14, 50, 126, 160, 6, 6, 'F');
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(145, 50, 51, 160, 6, 6, 'F');

    pdf.setFillColor(...theme.avatar);
    pdf.circle(28, 67, 10, 'F');
    pdf.setTextColor(...theme.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(getInitials(student.name), 28, 70, { align: 'center' });

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('STUDENT PROFILE', 42, 61);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(student.name, 42, 69);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text(student.department ?? 'Faculty of Computing', 42, 75);
    pdf.text(`Booking ID: ${booking.id}`, 42, 81);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    pdf.text('Booking Details', 20, 95);

    const detailRows = [
      ['Resource', booking.facilityName],
      ['Room', roomCode],
      ['Floor', floor],
      ['Date', formatDate(booking.date)],
      ['Time', formatTimeRange(booking.startTime, booking.endTime)],
      ['Duration', `${durationHours} hours`],
    ];

    let rowY = 102;
    detailRows.forEach(([label, value], index) => {
      pdf.setFillColor(...(isRejected && index % 2 === 0 ? [254, 242, 242] : [241, 245, 249]));
      pdf.roundedRect(20, rowY - 5, 114, 10, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(label, 24, rowY + 1.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(15, 23, 42);
      pdf.text(value, 62, rowY + 1.5);
      rowY += 12;
    });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    pdf.text(isRejected ? 'Rejection Summary' : 'Approval Summary', 20, 178);
    pdf.setFillColor(...(isRejected ? [254, 226, 226] : [220, 252, 231]));
    pdf.roundedRect(20, 183, 114, 24, 4, 4, 'F');
    pdf.setTextColor(...(isRejected ? [185, 28, 28] : [22, 163, 74]));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(isRejected ? '✕' : '✓', 26, 198);
    pdf.setFontSize(10);
    pdf.text(
      isRejected ? 'Booking request rejected' : 'Booking request approved',
      34,
      193,
    );
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(8.6);
    const summaryText = isRejected
      ? booking.adminNote ?? 'Rejected due to availability or policy conflict.'
      : `${booking.adminNote ?? 'Approved for scheduled access.'} Approved by ${reviewerName} on ${reviewDate}.`;
    pdf.text(pdf.splitTextToSize(summaryText, 92), 34, 198);

    if (isApproved) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Terms & Conditions', 20, 221);
      const terms = [
        'Arrive 10 minutes before the reserved start time.',
        'Carry your student ID together with this booking pass.',
        'QR code must be presented at the check-in desk.',
        'Resource damage must be reported immediately.',
        'Booking extensions depend on live room availability.',
        'Repeated no-shows may affect future approvals.',
      ];
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.3);
      terms.forEach((term, index) => {
        pdf.setTextColor(71, 85, 105);
        pdf.text(`• ${term}`, 22, 228 + index * 6.5);
      });
    } else if (isRejected) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Next Steps & Appeal Process', 20, 221);
      const nextSteps = [
        'Review the rejection reason and note the conflict window.',
        'Check alternative labs or rooms with similar capacity.',
        'Update your purpose or attendee count if needed.',
        'Submit a revised request with a different time slot.',
        'Contact the resource office for urgent academic needs.',
        'Appeal before the deadline shown in the sidebar.',
      ];
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.3);
      nextSteps.forEach((term, index) => {
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${index + 1}. ${term}`, 22, 228 + index * 6.5);
      });
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(isRejected ? 'Appeal & Resource Options' : 'Room Amenities', 149, 62);

    if (isRejected) {
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(149, 68, 43, 18, 4, 4, 'F');
      pdf.setTextColor(185, 28, 28);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('Appeal Deadline', 153, 75);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(51, 65, 85);
      pdf.text('April 20, 2026', 153, 81);

      let suggestionY = 94;
      altResources.forEach((resource) => {
        pdf.setFillColor(255, 245, 245);
        pdf.roundedRect(149, suggestionY, 43, 22, 4, 4, 'F');
        pdf.setTextColor(127, 29, 29);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.6);
        pdf.text(resource.name, 152, suggestionY + 6, { maxWidth: 37 });
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(7.7);
        pdf.text(resource.availabilityWindow.replace('â€¢', '-'), 152, suggestionY + 13, { maxWidth: 37 });
        pdf.text(`Capacity ${resource.capacity} • ${resource.type}`, 152, suggestionY + 18, { maxWidth: 37 });
        suggestionY += 26;
      });
    } else {
      let amenityY = 72;
      amenities.slice(0, 6).forEach((feature) => {
        pdf.setFillColor(238, 242, 255);
        pdf.roundedRect(149, amenityY, 43, 11, 4, 4, 'F');
        pdf.setTextColor(67, 56, 202);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.2);
        pdf.text(feature, 153, amenityY + 7, { maxWidth: 35 });
        amenityY += 14;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Digital Check-In', 149, 164);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(152, 170, 37, 37, 3, 3, 'F');
      if (bookingQrCodeUrl) {
        pdf.addImage(bookingQrCodeUrl, 'PNG', 155, 173, 31, 31);
      } else {
        pdf.setDrawColor(148, 163, 184);
        pdf.rect(159, 177, 23, 23);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.text('QR placeholder', 170.5, 191, { align: 'center' });
      }
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('Use this QR for', 170.5, 212, { align: 'center' });
      pdf.text('digital check-in', 170.5, 216, { align: 'center' });
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Booking Timeline', 149, isRejected ? 182 : 228);
    const timelineX = 154;
    const timelineStartY = isRejected ? 192 : 238;
    const timelineSteps = isRejected
      ? ['Submitted', 'Review', 'Rejected']
      : ['Submitted', 'Review', 'Approved', 'Upcoming'];
    timelineSteps.forEach((step, index) => {
      const y = timelineStartY + index * 11;
      if (index < timelineSteps.length - 1) {
        pdf.setDrawColor(203, 213, 225);
        pdf.line(timelineX, y + 2, timelineX, y + 10);
      }
      pdf.setFillColor(...(index === timelineSteps.length - 1 ? theme.accent : [148, 163, 184]));
      pdf.circle(timelineX, y, 2.3, 'F');
      pdf.setTextColor(51, 65, 85);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(step, timelineX + 5, y + 1);
    });

    pdf.setFillColor(...theme.footer);
    pdf.rect(0, 282, pageWidth, 15, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('support@unimatrix.edu | +94 11 234 5678 | Student Resource Office', 14, 290);
    pdf.text(`Generated ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 290, { align: 'right' });

    pdf.save(documentName);
  };

  const handleDownloadQrCode = () => {
    if (!qrCodeUrl || !qrBooking) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${qrBooking.facilityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${qrBooking.id}-qr.png`;
    link.click();
  };

  const handleDownloadBookingPdf = async (booking) => {
    try {
      const bookingQrCodeUrl =
        booking.status === 'APPROVED'
          ? await QRCode.toDataURL(buildBookingQrValue(booking), {
              width: 280,
              margin: 1,
              color: {
                dark: '#111827',
                light: '#FFFFFF',
              },
            })
          : '';

      downloadBookingPdf(booking, bookingQrCodeUrl);
    } catch {
      downloadBookingPdf(booking, '');
    }
  };

  const stats = [
    { label: 'Total bookings', value: bookings.length, tone: 'primary' },
    { label: 'Approved', value: approvedCount, tone: 'success' },
    { label: 'Pending', value: pendingCount, tone: 'warning' },
    { label: 'Rejected', value: rejectedCount, tone: 'danger' },
  ];

  const renderPageNav = () => (
    <section className={styles.pageNav}>
      <div className={styles.pageNavBrand}>
        <span className={styles.pageNavEyebrow}>Smart Campus Student Booking</span>
        <strong>{student.name}</strong>
      </div>

      <div className={styles.pageNavActions}>
        <button type="button" className={joinClassNames(styles.pageNavLink, activeSection === PAGE_SECTIONS.OVERVIEW && styles.pageNavActive)} onClick={() => setActiveSection(PAGE_SECTIONS.OVERVIEW)}>
          Overview
        </button>
        <button type="button" className={joinClassNames(styles.pageNavLink, activeSection === PAGE_SECTIONS.BOOKINGS && styles.pageNavActive)} onClick={() => setActiveSection(PAGE_SECTIONS.BOOKINGS)}>
          Bookings
        </button>
        <button
          type="button"
          className={joinClassNames(styles.pageNavLink, activeSection === PAGE_SECTIONS.CREATE && styles.pageNavActive)}
          onClick={() => {
            setActiveSection(PAGE_SECTIONS.CREATE);
            setCreateViewMode(CREATE_VIEW_MODES.LIST);
          }}
        >
          My Bookings
        </button>
      </div>
    </section>
  );

  const renderStats = () => (
    <section className={styles.statsGrid}>
      {stats.map((stat) => (
        <Card key={stat.label} className={styles.statCard}>
          <span className={styles.statLabel}>{stat.label}</span>
          <strong className={styles.statValue}>{stat.value}</strong>
          <span className={joinClassNames(styles.statGlow, styles[`statGlow${stat.tone}`])} />
        </Card>
      ))}
    </section>
  );

  const renderSkeletons = () => (
    <>
      <div className={styles.skeletonHero}>
        <SkeletonBlock className={styles.skeletonTitle} />
        <SkeletonBlock className={styles.skeletonLine} />
        <SkeletonBlock className={styles.skeletonButtonRow} />
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className={styles.skeletonCard} />
        ))}
      </div>
    </>
  );

  const renderOverviewPanels = () => (
    <section className={styles.overviewGrid}>
      <Card title="Upcoming bookings" subtitle="Your next campus reservations in a compact card view." className={joinClassNames(styles.panelCard, styles.overviewWideCard)}>
        <div className={styles.upcomingCards}>
          {upcomingBookings.map((booking) => (
            <button key={booking.id} type="button" className={styles.upcomingBookingCard} onClick={() => setSelectedBooking(booking)}>
              <div className={styles.upcomingBookingTop}>
                <div className={styles.upcomingBookingMain}>
                  <strong>{booking.purpose}</strong>
                  <span className={styles.upcomingLocation}>
                    <MapPin size={15} />
                    {mockFacilities.find((item) => item.id === booking.facilityId)?.location ?? booking.facilityName}
                  </span>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className={styles.upcomingMetaRow}>
                <span>
                  <CalendarRange size={15} />
                  {formatDate(booking.date)}
                </span>
                <span>
                  <Clock3 size={15} />
                  {formatTimeRange(booking.startTime, booking.endTime)}
                </span>
                <span>
                  <Users size={15} />
                  {booking.attendees} attendees
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <SmartSuggestionsCard onAction={handleSuggestionAction} onViewAll={() => setActiveSection(PAGE_SECTIONS.BOOKINGS)} />

      <Card title="Notification preview" subtitle="Approvals, rejections, and reminders without leaving the page." className={styles.panelCard}>
        <div className={styles.notificationPreview}>
          {notifications.slice(0, 3).map((notification) => (
            <article key={notification.id} className={styles.notificationRow}>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
              {!notification.read ? (
                <button type="button" className={styles.markRead} onClick={() => markNotificationAsRead(notification.id)}>
                  Mark as read
                </button>
              ) : (
                <span className={styles.readState}>Read</span>
              )}
            </article>
          ))}
        </div>
      </Card>
    </section>
  );

  const renderFilters = () => (
    <Card title="Advanced filters" subtitle="Refine by date range, status, resource type, capacity, and live search." className={styles.filterCard}>
      <div className={styles.filterGrid}>
        <SearchBar value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by resource, purpose, date, or status" />
        <select className={styles.select} value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className={styles.select} value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
          <option value="ALL">All resources</option>
          {[...new Set(mockFacilities.map((facility) => facility.type))].map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select className={styles.select} value={filters.capacity} onChange={(event) => handleFilterChange('capacity', event.target.value)}>
          <option value="ALL">All capacities</option>
          <option value="1-20">1-20</option>
          <option value="21-50">21-50</option>
          <option value="51-120">51-120</option>
          <option value="120+">120+</option>
        </select>
        <input type="date" className={fieldStyles.control} value={filters.startDate} onChange={(event) => handleFilterChange('startDate', event.target.value)} />
        <input type="date" className={fieldStyles.control} value={filters.endDate} onChange={(event) => handleFilterChange('endDate', event.target.value)} />
      </div>
    </Card>
  );

  const renderBookingsView = () => (
    <div className={styles.tabContent}>
      <Card
        title="Calendar view"
        subtitle="Drag bookings across days, switch between square monthly tiles and weekly scheduler view."
        action={
          <div className={styles.calendarToolbar}>
            <div className={styles.modeToggle}>
              {CALENDAR_MODES.map((mode) => (
                <button key={mode} type="button" className={joinClassNames(styles.modeButton, calendarMode === mode && styles.modeButtonActive)} onClick={() => setCalendarMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
            <div className={styles.calendarNav}>
              <button type="button" className={styles.iconAction} onClick={() => setCalendarAnchor((current) => addDays(current, calendarMode === 'Weekly' ? -7 : -30))} aria-label="Previous">
                <ChevronLeft size={16} />
              </button>
              <button type="button" className={styles.iconAction} onClick={() => setCalendarAnchor((current) => addDays(current, calendarMode === 'Weekly' ? 7 : 30))} aria-label="Next">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        }
      >
        {calendarMode === 'Monthly' ? (
          <div className={styles.monthlyCalendar}>
            <div className={styles.monthHeaderRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <span key={label} className={styles.monthHeaderCell}>{label}</span>
              ))}
            </div>
            <div className={styles.monthlyGrid}>
              {calendarDays.map((day) => {
                const dateKey = toDateKey(day);
                const dayBookings = filteredBookings.filter((booking) => booking.date === dateKey);
                const isOutsideCurrentMonth = day.getMonth() !== calendarAnchor.getMonth();

                return (
                  <article key={dateKey} className={joinClassNames(styles.monthCell, isOutsideCurrentMonth && styles.monthCellMuted)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBookingDrop(event, dateKey)}>
                    <header className={styles.monthCellHeader}>
                      <strong>{day.getDate()}</strong>
                      <span>{day.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </header>
                    <div className={styles.monthCellBody}>
                      {dayBookings.length ? (
                        dayBookings.map((booking) => (
                          <div key={booking.id} draggable onDragStart={(event) => event.dataTransfer.setData('bookingId', booking.id)} className={joinClassNames(getBookingBlockStyle(booking), styles.monthBookingBlock)} onClick={() => setSelectedBooking(booking)}>
                            <strong>{booking.facilityName}</strong>
                            <span>{booking.startTime}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.monthCellEmpty}>Available</div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.weeklyPlanner}>
            <div className={styles.weeklyHeader}>
              <div className={styles.timeHeaderCell}>Time</div>
              {calendarDays.map((day) => (
                <div key={toDateKey(day)} className={styles.weekDayHeader}>
                  <strong>{day.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                  <span>{day.toLocaleDateString('en-US', { day: 'numeric' })}</span>
                </div>
              ))}
            </div>
            <div className={styles.weeklyBody}>
              {weeklyTimeSlots.map((time) => (
                <div key={time} className={styles.weekRow}>
                  <div className={styles.timeLabel}>{time}</div>
                  {calendarDays.map((day) => {
                    const dateKey = toDateKey(day);
                    const cellBookings = filteredBookings.filter((booking) => booking.date === dateKey && booking.startTime.slice(0, 2) === time.slice(0, 2));

                    return (
                      <div key={`${dateKey}-${time}`} className={styles.weekSlot} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBookingDrop(event, dateKey)}>
                        {cellBookings.map((booking) => (
                          <div key={booking.id} draggable onDragStart={(event) => event.dataTransfer.setData('bookingId', booking.id)} className={joinClassNames(getBookingBlockStyle(booking), styles.weeklyBookingBlock)} onClick={() => setSelectedBooking(booking)}>
                            <strong>{booking.facilityName}</strong>
                            <span>{formatTimeRange(booking.startTime, booking.endTime)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const renderCreateView = () => {
    const durationHours = Math.max(1, Math.round((toMinutes(form.endTime) - toMinutes(form.startTime)) / 60) || 2);

    const handleDurationChange = (event) => {
      const nextDuration = Math.max(1, Number(event.target.value || 1));
      const nextEndMinutes = Math.min(toMinutes(form.startTime) + nextDuration * 60, DAY_MINUTES_END);

      setForm((current) => ({
        ...current,
        endTime: fromMinutes(nextEndMinutes),
      }));
    };

    const renderCreateBookingForm = () => (
      <div className={styles.createBookingView}>
        <div className={styles.createBookingHeader}>
          <div>
            <h2>Create New Booking</h2>
            <p>Reserve campus resources for your needs.</p>
          </div>
          <Button variant="secondary" onClick={() => setCreateViewMode(CREATE_VIEW_MODES.LIST)}>
            Back to My Bookings
          </Button>
        </div>

        <div className={styles.createBookingLayout}>
          <Card className={styles.createBookingFormCard}>
            <form className={styles.createBookingForm} onSubmit={handleCreateBooking}>
              <label className={styles.formField}>
                <span>Select Resource</span>
                <select name="facilityId" className={styles.createSelect} value={form.facilityId} onChange={handleFormChange} required>
                  <option value="">Choose a resource...</option>
                  {mockFacilities
                    .filter((facility) => facility.status !== 'OUT_OF_SERVICE')
                    .map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Date</span>
                <input type="date" name="date" className={styles.createInput} value={form.date} onChange={handleFormChange} required />
              </label>

              <div className={styles.createBookingSplit}>
                <label className={styles.formField}>
                  <span>Start Time</span>
                  <input type="time" name="startTime" className={styles.createInput} value={form.startTime} onChange={handleFormChange} required />
                </label>

                <label className={styles.formField}>
                  <span>Duration (hours)</span>
                  <input type="number" min="1" max="4" step="1" className={styles.createInput} value={durationHours} onChange={handleDurationChange} required />
                </label>
              </div>

              <label className={styles.formField}>
                <span>Description (Optional)</span>
                <textarea
                  name="purpose"
                  rows="5"
                  className={styles.createTextarea}
                  value={form.purpose}
                  onChange={handleFormChange}
                  placeholder="Add any notes or special requests..."
                />
              </label>

              {conflictMessage ? (
                <p className={joinClassNames(styles.bookingNotice, conflictMessage.startsWith('Available') ? styles.bookingNoticeSuccess : styles.bookingNoticeDanger)}>
                  {conflictMessage}
                </p>
              ) : null}

              {submitMessage ? <p className={styles.submitMessage}>{submitMessage}</p> : null}

              <Button type="submit" size="lg" fullWidth>
                Request Booking
              </Button>
            </form>
          </Card>

          <div className={styles.createBookingSideColumn}>
            <Card className={styles.tipCard}>
              <div className={styles.tipCardBody}>
                <h3>Booking Tips</h3>
                <ul className={styles.tipList}>
                  <li>Book at least 24 hours in advance</li>
                  <li>Maximum booking duration is 4 hours</li>
                  <li>Cancellations must be 12 hours before</li>
                  <li>You&apos;ll receive a QR code for check-in</li>
                </ul>
              </div>
            </Card>

            <Card className={styles.supportCard}>
              <div className={styles.supportCardBody}>
                <p>Need help booking a resource?</p>
                <Button variant="secondary" fullWidth>
                  Contact Support
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );

    if (createViewMode === CREATE_VIEW_MODES.FORM) {
      return <div className={styles.tabContent}>{renderCreateBookingForm()}</div>;
    }

    if (!bookings.length) {
      return (
        <div className={styles.tabContent}>
          <Card className={styles.emptyBookingsCard}>
            <div className={styles.emptyBookingsInner}>
              <CalendarRange size={44} />
              <h3>No Bookings Yet</h3>
              <p>You do not have any bookings yet. Create one to reserve a campus resource.</p>
              <Button onClick={() => setCreateViewMode(CREATE_VIEW_MODES.FORM)}>Create Booking</Button>
            </div>
          </Card>
        </div>
      );
    }

    const handleDeleteBooking = (bookingId) => {
      setBookings((current) => current.filter((booking) => booking.id !== bookingId));
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
      if (qrBooking?.id === bookingId) {
        setQrBooking(null);
      }
    };

    const getBookingMeta = (booking) => {
      const facility = mockFacilities.find((item) => item.id === booking.facilityId);
      const location = facility?.location ?? 'Campus resource hub';
      return {
        resource: booking.facilityName,
        date: formatDate(booking.date),
        time: formatTimeRange(booking.startTime, booking.endTime),
        capacity: `${booking.attendees}/${facility?.capacity ?? booking.attendees}`,
        location,
        description: facility?.description ?? booking.purpose,
        createdAt: `Created ${formatDateTime(`${booking.date}T${booking.startTime}`)}`,
      };
    };

    return (
      <div className={styles.tabContent}>
        <div className={styles.myBookingsHeader}>
          <div>
            <h2>My Bookings</h2>
            <p>Track your reservations, download confirmations, and open details any time.</p>
          </div>
          <Button onClick={() => setCreateViewMode(CREATE_VIEW_MODES.FORM)}>Create Booking</Button>
        </div>

        <div className={styles.myBookingsList}>
          {bookings.map((booking) => {
            const meta = getBookingMeta(booking);

            return (
              <Card key={booking.id} className={styles.myBookingCard}>
                <div className={styles.myBookingTop}>
                  <div className={styles.myBookingHeader}>
                    <h3>{meta.resource}</h3>
                    <StatusBadge status={booking.status} />
                  </div>

                  <div className={styles.bookingDetailGrid}>
                    <div className={styles.bookingInfoItem}>
                      <CalendarRange size={16} />
                      <span>{meta.date}</span>
                    </div>
                    <div className={styles.bookingInfoItem}>
                      <Clock3 size={16} />
                      <span>{meta.time}</span>
                    </div>
                    <div className={styles.bookingInfoItem}>
                      <Search size={16} />
                      <span>{meta.location}</span>
                    </div>
                    <div className={styles.bookingInfoItem}>
                      <Users size={16} />
                      <span>{meta.capacity}</span>
                    </div>
                  </div>

                  <div className={styles.bookingTimelineInline}>
                    <span className={joinClassNames(styles.timelineStateDot, booking.status === 'APPROVED' ? styles.timelineApproved : booking.status === 'PENDING' ? styles.timelinePending : styles.timelineRejected)} />
                    <span>
                      {booking.status === 'APPROVED' ? 'Created -> Pending -> Approved' : booking.status === 'PENDING' ? 'Created -> Pending (Awaiting approval)' : 'Created -> Pending -> Rejected'}
                    </span>
                  </div>
                </div>

                <div className={styles.bookingCardActions}>
                  {booking.status === 'APPROVED' ? (
                    <Button variant="secondary" size="sm" icon={QrCode} onClick={() => setQrBooking(booking)}>
                      QR Code
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => setSelectedBooking(booking)}>
                    Details
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleDownloadBookingPdf(booking)}>
                    Download
                  </Button>
                  <button type="button" className={styles.deleteButton} onClick={() => handleDeleteBooking(booking.id)} aria-label="Delete booking">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {loading ? (
        renderSkeletons()
      ) : (
        <>
          {renderPageNav()}
          {activeSection === PAGE_SECTIONS.OVERVIEW ? (
            <>
              {renderStats()}
              {renderOverviewPanels()}
            </>
          ) : null}
          {activeSection === PAGE_SECTIONS.BOOKINGS ? renderBookingsView() : null}
          {activeSection === PAGE_SECTIONS.CREATE ? renderCreateView() : null}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.facilityName}
        description="Booking details"
        footer={
          selectedBooking ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedBooking(null)}>Close</Button>
              {selectedBooking.status === 'APPROVED' ? <Button icon={QrCode} onClick={() => setQrBooking(selectedBooking)}>View QR Code</Button> : null}
              <Button variant="secondary">Edit Booking</Button>
              <Button variant="danger">Cancel Booking</Button>
            </>
          ) : null
        }
      >
        {selectedBooking ? (
          <div className={styles.detailModal}>
            <div className={styles.detailFields}>
              <div>
                <label>Status</label>
                <StatusBadge status={selectedBooking.status} />
              </div>
              <div>
                <label>Date</label>
                <p>{formatDate(selectedBooking.date)}</p>
              </div>
              <div>
                <label>Time</label>
                <p>{formatTimeRange(selectedBooking.startTime, selectedBooking.endTime)}</p>
              </div>
              <div>
                <label>Location</label>
                <p>{mockFacilities.find((item) => item.id === selectedBooking.facilityId)?.location ?? 'Campus resource hub'}</p>
              </div>
              <div>
                <label>Capacity</label>
                <p>{selectedBooking.attendees}/{mockFacilities.find((item) => item.id === selectedBooking.facilityId)?.capacity ?? selectedBooking.attendees}</p>
              </div>
              <div>
                <label>Description</label>
                <p>{mockFacilities.find((item) => item.id === selectedBooking.facilityId)?.description ?? selectedBooking.purpose}</p>
              </div>
            </div>
            <div className={styles.detailSummary}>
              <small>Last update: {formatDateTime(`${selectedBooking.date}T${selectedBooking.startTime}`)}</small>
            </div>
            <div className={styles.timeline}>
              {timelineSteps.map((step, index) => (
                <div key={step} className={joinClassNames(styles.timelineStep, index <= getTimelineIndex(selectedBooking.status) && styles.timelineStepActive, selectedBooking.status === 'CANCELLED' && step === 'Cancelled' && styles.timelineStepCancelled)}>
                  <span className={styles.timelineDot} />
                  <div>
                    <strong>{step}</strong>
                    <p>
                      {step === 'Created' ? 'Request captured by the student.' : null}
                      {step === 'Pending' ? 'Awaiting campus approval workflow.' : null}
                      {step === 'Approved' ? 'Reservation cleared for QR check-in.' : null}
                      {step === 'Cancelled' ? 'Shown only when the booking was later withdrawn.' : null}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={Boolean(qrBooking)} onClose={() => setQrBooking(null)} title="Booking QR Code" description="Show this code when you arrive for your approved booking.">
        {qrBooking ? (
          <div className={styles.qrModal}>
            <div className={styles.qrCard}>
              {qrCodeUrl ? <img src={qrCodeUrl} alt={`QR for booking ${qrBooking.id}`} className={styles.qrImage} /> : <div className={styles.qrLoading}>Generating QR...</div>}
            </div>
            <div className={styles.qrMeta}>
              <strong>{qrBooking.facilityName}</strong>
              <span>{formatDate(qrBooking.date)} | {formatTimeRange(qrBooking.startTime, qrBooking.endTime)}</span>
              <p>{qrBooking.purpose}</p>
              <span>Booking ID: {qrBooking.id}</span>
              <Button onClick={handleDownloadQrCode} disabled={!qrCodeUrl}>
                Download QR
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

    </div>
  );
}
