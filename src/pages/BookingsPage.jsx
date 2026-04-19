import {
  AlertTriangle,
  BellRing,
  Package,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  PencilLine,
  QrCode,
  Search,
  GraduationCap,
  Sparkles,
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
import QRScannerPage from './QRScannerPage';
import SearchBar from '../components/ui/SearchBar';
import SkeletonBlock from '../components/ui/SkeletonBlock';
import StatusBadge from '../components/ui/StatusBadge';
import { mockFacilities } from '../data/facilities';
import { mockUsers } from '../data/users';
import { useAuth } from '../hooks/useAuth';
import {
  getNotificationContext,
  getRoleNotifications,
  getUserNotifications,
  mapNotificationToUi,
  markNotificationAsRead as markNotificationAsReadApi,
} from '../services/notificationApi';
import { ROLES } from '../utils/constants';
import { formatDate, formatDateTime, joinClassNames } from '../utils/formatters';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const BOOKINGS_API_URL = `${BACKEND_URL}/api/bookings`;
const RESOURCES_API_URL = `${BACKEND_URL}/api/resources`;
const USERS_API_URL = `${BACKEND_URL}/api/users`;
const CALENDAR_MODES = ['Weekly', 'Monthly'];
const PAGE_SECTIONS = {
  OVERVIEW: 'OVERVIEW',
  BOOKINGS: 'BOOKINGS',
  CREATE: 'CREATE',
  SUGGESTIONS: 'SUGGESTIONS',
};
const CREATE_VIEW_MODES = {
  LIST: 'LIST',
  FORM: 'FORM',
};
const ADMIN_TABS = {
  ALL: 'ALL',
  PENDING: 'PENDING',
  ANALYTICS: 'ANALYTICS',
  QR: 'QR',
  CHECKED_IN: 'CHECKED_IN',
};
const DATE_CHANGE_DISMISS_KEY = 'bookings.dismissedApprovedDateChanges';
const DATE_CHANGE_SLOT_MINUTES = 120;
const EARLY_TEST_BOOKING_START_SLOT = '07:20';
const SECOND_EARLY_TEST_BOOKING_START_SLOT = '07:28';
const THIRD_EARLY_TEST_BOOKING_START_SLOT = '07:35';
const EVENING_TEST_BOOKING_START_SLOT = '19:35';
const TEST_BOOKING_START_SLOT = '03:18';
const TODAY_EXTRA_TEST_SLOT = '15:20';
const LIVE_BOOKING_SYNC_INTERVAL_MS = 5000;
const DAY_MINUTES_START = 8 * 60;
const DAY_MINUTES_END = 19 * 60;
const weeklyTimeSlots = Array.from({ length: 12 }, (_, index) => `${(8 + index).toString().padStart(2, '0')}:00`);
const bookingStartTimeSlots = Array.from({ length: 6 }, (_, index) => `${String(8 + index * 2).padStart(2, '0')}:00`);

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
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  return toDateKey(new Date());
}

function isStartSlotStillBookable(date, startTime) {
  if (!date || !startTime) {
    return true;
  }

  if (date !== getTodayDateKey()) {
    return true;
  }

  const now = new Date();
  const slotCutoff = new Date(`${date}T${startTime}`);
  slotCutoff.setMinutes(slotCutoff.getMinutes() + 15);

  return now.getTime() <= slotCutoff.getTime();
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function isInactiveBookingStatus(status) {
  return ['REJECTED', 'CANCELLED', 'NO_SHOW'].includes(status);
}

function formatTimeRange(startTime, endTime) {
  return `${startTime} - ${endTime}`;
}

function getTimelineIndex(status) {
  if (status === 'CANCELLED') return 3;
  if (status === 'APPROVED') return 2;
  return 1;
}

function getBookingDragState(booking) {
  if (booking.status === 'PENDING') {
    return { canDrag: true, message: '' };
  }

  if (booking.status === 'APPROVED') {
    return {
      canDrag: Boolean(booking.dateChangeApproved),
      message: booking.dateChangeApproved
        ? ''
        : 'Approved bookings need admin permission before their date can be changed.',
    };
  }

  if (booking.status === 'REJECTED') {
    return { canDrag: false, message: 'Rejected bookings cannot be dragged on the calendar.' };
  }

  if (booking.status === 'CANCELLED') {
    return { canDrag: false, message: 'Cancelled bookings cannot be dragged on the calendar.' };
  }

  return { canDrag: false, message: 'This booking cannot be moved on the calendar.' };
}

function buildAvailability(bookings, facilityId, date) {
  const dayBookings = bookings
    .filter(
      (booking) =>
        booking.facilityId === facilityId &&
        booking.date === date &&
        !isInactiveBookingStatus(booking.status),
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

function getFittingAvailabilityWindows(bookings, booking, targetDate) {
  const durationMinutes = toMinutes(booking.endTime) - toMinutes(booking.startTime);

  return buildAvailability(bookings, booking.facilityId, targetDate).filter(
    (window) => toMinutes(window.endTime) - toMinutes(window.startTime) >= durationMinutes,
  );
}

function buildDateChangeSlots(bookings, booking, targetDate) {
  const freeWindows = buildAvailability(bookings, booking.facilityId, targetDate);
  const discreteSlots = [];

  freeWindows.forEach((window) => {
    let cursor = toMinutes(window.startTime);
    const windowEnd = toMinutes(window.endTime);

    while (cursor + DATE_CHANGE_SLOT_MINUTES <= windowEnd) {
      discreteSlots.push({
        startTime: fromMinutes(cursor),
        endTime: fromMinutes(cursor + DATE_CHANGE_SLOT_MINUTES),
      });
      cursor += DATE_CHANGE_SLOT_MINUTES;
    }
  });

  return discreteSlots;
}

function getTimeWindowValue(window) {
  return `${window.startTime}|${window.endTime}`;
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

function buildBookingFilterQuery(filters, query) {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set('query', query.trim());
  }
  if (filters.status && filters.status !== 'ALL') {
    params.set('status', filters.status);
  }
  if (filters.type && filters.type !== 'ALL') {
    params.set('type', filters.type);
  }
  if (filters.capacity && filters.capacity !== 'ALL') {
    params.set('capacity', filters.capacity);
  }
  if (filters.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.set('endDate', filters.endDate);
  }

  return params.toString();
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

function getBookingEndTimestamp(booking) {
  return new Date(`${booking.date}T${booking.endTime}`).getTime();
}

function formatRemainingDuration(milliseconds) {
  if (milliseconds <= 0) {
    return 'Ended';
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function isEquipmentResource(resource) {
  return String(resource?.type ?? '').trim().toUpperCase() === 'EQUIPMENT';
}

function getCapacityValidationMessage(facility, attendees) {
  const attendeeCount = Number(attendees);
  const capacity = Number(facility?.capacity);

  if (!facility || !Number.isFinite(attendeeCount) || attendeeCount <= 0 || !Number.isFinite(capacity) || capacity <= 0) {
    return '';
  }

  if (attendeeCount > capacity) {
    return `Only ${capacity} attendees allowed for ${facility.name}.`;
  }

  return '';
}

function getOverlappingBookedQuantity(bookings, facilityId, date, startTime, endTime, excludedBookingId = '') {
  return bookings
    .filter((booking) => booking.id !== excludedBookingId)
    .filter((booking) => booking.facilityId === facilityId && booking.date === date)
    .filter((booking) => !isInactiveBookingStatus(booking.status))
    .filter((booking) =>
      overlaps(toMinutes(startTime), toMinutes(endTime), toMinutes(booking.startTime), toMinutes(booking.endTime)),
    )
    .reduce((sum, booking) => sum + Number(booking.attendees ?? 0), 0);
}

function getBookingWindowValidationMessage(bookings, facility, draft, excludedBookingId = '') {
  if (!facility || !draft?.date || !draft?.startTime || !draft?.endTime) {
    return '';
  }

  if (isEquipmentResource(facility)) {
    const capacity = Number(facility.capacity ?? 0);
    const requestedUnits = Number(draft.attendees ?? 0);
    const reservedUnits = getOverlappingBookedQuantity(
      bookings,
      String(facility.id),
      draft.date,
      draft.startTime,
      draft.endTime,
      excludedBookingId,
    );
    const availableUnits = Math.max(0, capacity - reservedUnits);

    if (requestedUnits > availableUnits) {
      return `Only ${availableUnits} units are still available for ${facility.name} in that time window.`;
    }

    return '';
  }

  const hasConflict = bookings.some((booking) => {
    if (booking.id === excludedBookingId) return false;
    if (booking.facilityId !== String(facility.id) || booking.date !== draft.date || isInactiveBookingStatus(booking.status)) {
      return false;
    }

    return overlaps(toMinutes(draft.startTime), toMinutes(draft.endTime), toMinutes(booking.startTime), toMinutes(booking.endTime));
  });

  return hasConflict ? 'Please choose one of the suggested free slots before sending the request.' : '';
}

function getAvailableStartTimeSlots(bookings, facility, date, attendees, excludedBookingId = '') {
  if (!facility || !date) {
    return bookingStartTimeSlots;
  }

  return bookingStartTimeSlots.filter((startTime) => {
    if (!isStartSlotStillBookable(date, startTime)) {
      return false;
    }

    const draft = {
      date,
      startTime,
      endTime: fromMinutes(Math.min(toMinutes(startTime) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END)),
      attendees,
    };

    return !getBookingWindowValidationMessage(bookings, facility, draft, excludedBookingId);
  });
}

function getCreateBookingStartTimeSlots(bookings, facility, date, attendees) {
  const regularSlots = getAvailableStartTimeSlots(bookings, facility, date, attendees);
  const specialSlots = [];

  if (!facility || !date) {
    return [
      EARLY_TEST_BOOKING_START_SLOT,
      SECOND_EARLY_TEST_BOOKING_START_SLOT,
      THIRD_EARLY_TEST_BOOKING_START_SLOT,
      EVENING_TEST_BOOKING_START_SLOT,
      TEST_BOOKING_START_SLOT,
      ...specialSlots,
      ...regularSlots,
    ];
  }

  [
    EARLY_TEST_BOOKING_START_SLOT,
    SECOND_EARLY_TEST_BOOKING_START_SLOT,
    THIRD_EARLY_TEST_BOOKING_START_SLOT,
    EVENING_TEST_BOOKING_START_SLOT,
    TEST_BOOKING_START_SLOT,
    ...(date === getTodayDateKey() ? [TODAY_EXTRA_TEST_SLOT] : []),
  ].forEach((slot) => {
    if (
      ![
        EARLY_TEST_BOOKING_START_SLOT,
        SECOND_EARLY_TEST_BOOKING_START_SLOT,
        THIRD_EARLY_TEST_BOOKING_START_SLOT,
        EVENING_TEST_BOOKING_START_SLOT,
      ].includes(slot) &&
      !isStartSlotStillBookable(date, slot)
    ) {
      return;
    }

    const testDraft = {
      date,
      startTime: slot,
      endTime: fromMinutes(toMinutes(slot) + DATE_CHANGE_SLOT_MINUTES),
      attendees,
    };

    const hasTestConflict = getBookingWindowValidationMessage(bookings, facility, testDraft);
    if (!hasTestConflict && !specialSlots.includes(slot)) {
      specialSlots.push(slot);
    }
  });

  return [...specialSlots, ...regularSlots];
}

function getResourceAvailabilityValidationMessage(facility) {
  if (facility && facility.isActive === false) {
    return `${facility.name} is currently inactive and cannot be booked.`;
  }

  const resourceStatus = String(facility?.status ?? '').trim().toUpperCase();
  if (!facility || !resourceStatus || resourceStatus === 'AVAILABLE') {
    return '';
  }

  if (resourceStatus === 'MAINTENANCE') {
    return `${facility.name} is currently under maintenance and cannot be booked.`;
  }

  if (resourceStatus === 'UNAVAILABLE') {
    return `${facility.name} is currently unavailable and cannot be booked.`;
  }

  return `${facility.name} is not available for booking right now.`;
}

function isUserVisibleResource(resource) {
  return resource?.isActive !== false;
}

function mapBackendResource(resource) {
  return {
    id: String(resource.id),
    name: resource.name,
    type: resource.type ?? 'Resource',
    location: resource.location ?? 'Campus resource hub',
    capacity: resource.capacity ?? 0,
    status: resource.status ?? 'AVAILABLE',
    isActive: resource.isActive ?? true,
    description: resource.description ?? '',
  };
}

function findUserDisplayName(userId, users, currentUser) {
  const normalizedUserId = String(userId ?? '');
  const matchedUser = users.find((user) =>
    [user.id, user.idNumber, user.userId, user.email]
      .filter(Boolean)
      .some((value) => String(value) === normalizedUserId),
  );

  if (matchedUser?.name) {
    return matchedUser.name;
  }

  if (String(currentUser.id) === normalizedUserId) {
    return currentUser.name;
  }

  return normalizedUserId ? `User ${normalizedUserId}` : 'Unknown student';
}

function mapBackendBooking(booking, resources, users, currentUser, isAdminView) {
  const facility = resources.find(
    (resource) => resource.id === String(booking.resourceId)
  );

  const requesterId = booking.userId ?? currentUser.id;
  const requesterName = findUserDisplayName(requesterId, users, currentUser);

  return {
    backendId: booking.id ? String(booking.id) : '',
    id: booking.id ? `bk-${booking.id}` : `bk-${Date.now()}`,

    facilityId: String(booking.resourceId),
    facilityName: facility?.name ?? `Resource ${booking.resourceId}`,

    requesterId,
    requesterName,

    // 🔥 FIXED MAPPING
    date: booking.date ?? booking.bookingDate,
    startTime: booking.startTime?.slice(0, 5),
    endTime: booking.endTime?.slice(0, 5),

    purpose: booking.purpose ?? booking.description ?? 'Booking request',
    attendees: Number(booking.attendees ?? booking.attendeesCount ?? 0),

    status: booking.status ?? 'PENDING',
    adminNote: booking.rejectionReason ?? '',
    dateChangeApproved: Boolean(booking.dateChangeApproved),
    dateChangeRequested: Boolean(booking.dateChangeRequested),
    requestedDate: booking.requestedDate ?? '',
    requestedStartTime: booking.requestedStartTime?.slice(0, 5) ?? '',
    requestedEndTime: booking.requestedEndTime?.slice(0, 5) ?? '',
    previousDate: booking.previousDate ?? '',
    previousStartTime: booking.previousStartTime?.slice(0, 5) ?? '',
    previousEndTime: booking.previousEndTime?.slice(0, 5) ?? '',
    urgentApproval: Boolean(booking.urgentApproval),
    checkedIn: Boolean(booking.checkedIn),
    checkedInAt: booking.checkedInAt ?? '',
  };
}

function getVisibleBookingsForUser(mappedBookings, student, isAdmin) {
  if (isAdmin) {
    return mappedBookings;
  }

  const exactUserBookings = mappedBookings.filter((booking) => String(booking.requesterId) === String(student.id));

  if (exactUserBookings.length || !mappedBookings.length) {
    return exactUserBookings;
  }

  console.warn(
    'Bookings were loaded from the backend, but none matched the current frontend user id. Showing all backend bookings instead.',
    {
      currentUserId: student.id,
      backendUserIds: [...new Set(mappedBookings.map((booking) => booking.requesterId))],
    },
  );

  return mappedBookings;
}

function extractNumericId(value, fallback = 1) {
  const digits = String(value ?? '').match(/\d+/)?.[0];
  return digits ? Number(digits) : fallback;
}

function inferFloor(location) {
  if (location.includes('Block A')) return 'Floor 1';
  if (location.includes('Block B')) return 'Floor 2';
  if (location.includes('Innovation Centre')) return 'Floor 3';
  if (location.includes('Media Hub')) return 'Floor 1';
  if (location.includes('Library')) return 'Floor 2';
  return 'Campus Level';
}

function getFacilityDetails(booking, backendResources) {
  return (
    backendResources.find((resource) => resource.id === booking.facilityId) ??
    mockFacilities.find((resource) => resource.id === booking.facilityId) ??
    null
  );
}

function getBookingCountMeta(booking, backendResources) {
  const facility = getFacilityDetails(booking, backendResources);
  const total = facility?.capacity ?? booking.attendees;
  const isEquipment = isEquipmentResource(facility);

  return {
    icon: isEquipment ? Package : Users,
    label: `${booking.attendees}/${total}`,
  };
}

function isFutureOrTodayBooking(booking) {
  return new Date(`${booking.date}T${booking.startTime}`).getTime() >= new Date().getTime();
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
  const isAdmin = student.role === ROLES.ADMIN;
  const dismissedStorageKey = `${DATE_CHANGE_DISMISS_KEY}.${student.id}`;

  const [bookings, setBookings] = useState([]);
  const [activeSection, setActiveSection] = useState(PAGE_SECTIONS.OVERVIEW);
  const [calendarMode, setCalendarMode] = useState('Weekly');
  const [calendarAnchor, setCalendarAnchor] = useState(new Date(2026, 3, 15));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', type: 'ALL', capacity: 'ALL', startDate: '', endDate: '' });
  const [form, setForm] = useState(initialForm);
  const [conflictMessage, setConflictMessage] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [createViewMode, setCreateViewMode] = useState(CREATE_VIEW_MODES.LIST);
  const [backendResources, setBackendResources] = useState([]);
  const [backendUsers, setBackendUsers] = useState([]);
  const [availableNowSlots, setAvailableNowSlots] = useState([]);
  const [isBookingAvailableNowSlot, setIsBookingAvailableNowSlot] = useState(false);
  const [releasedSlotPrefill, setReleasedSlotPrefill] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [dateChangeRequestBooking, setDateChangeRequestBooking] = useState(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTimeWindow, setRequestedTimeWindow] = useState('');
  const [isSubmittingDateRequest, setIsSubmittingDateRequest] = useState(false);
  const [dismissedApprovedChanges, setDismissedApprovedChanges] = useState(() => {
    if (typeof window === 'undefined') return [];

    try {
      const rawValue = window.localStorage.getItem(`${DATE_CHANGE_DISMISS_KEY}.${student.id}`);
      const parsedValue = rawValue ? JSON.parse(rawValue) : [];
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch {
      return [];
    }
  });
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.ALL);
  const [checkedInAdminRows, setCheckedInAdminRows] = useState([]);
  const [checkedInRowsLoading, setCheckedInRowsLoading] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState(null);
  const [processingAction, setProcessingAction] = useState('');
  const [reviewMode, setReviewMode] = useState('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const fetchCheckedInAdminRows = async () => {
    if (!isAdmin) {
      setCheckedInAdminRows([]);
      return;
    }

    setCheckedInRowsLoading(true);

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/checked-in`);
      if (!response.ok) {
        throw new Error('Failed to load checked-in bookings');
      }

      const data = await response.json();
      setCheckedInAdminRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load checked-in admin rows:', error);
      setCheckedInAdminRows([]);
    } finally {
      setCheckedInRowsLoading(false);
    }
  };

  const fetchAvailableNowSlots = async () => {
    try {
      const response = await fetch(`${RESOURCES_API_URL}/available-now`);
      if (!response.ok) {
        throw new Error('Failed to load available-now slots');
      }

      const data = await response.json();
      setAvailableNowSlots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load available-now slots:', error);
      setAvailableNowSlots([]);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(BOOKINGS_API_URL);
      if (!response.ok) {
        throw new Error('Failed to load bookings');
      }

      const data = await response.json();
      const resourcesForMapping = backendResources.length ? backendResources : mockFacilities;
      const usersForMapping = [...mockUsers, ...backendUsers];
      const mappedBookings = data.map((booking) =>
        mapBackendBooking(booking, resourcesForMapping, usersForMapping, student, isAdmin),
      );
      const visibleBookings = getVisibleBookingsForUser(mappedBookings, student, isAdmin);

      setBookings(visibleBookings);
    } catch (error) {
      console.error('Failed to load backend bookings:', error);
      setBookings([]);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setLoading(false), 950);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(dismissedStorageKey, JSON.stringify(dismissedApprovedChanges));
    } catch {
      // Ignore storage write issues and keep the in-memory dismissal state.
    }
  }, [dismissedApprovedChanges, dismissedStorageKey]);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const response = await fetch(RESOURCES_API_URL);
        if (!response.ok) {
          throw new Error('Failed to load resources');
        }

        const resources = await response.json();
        setBackendResources(resources.map(mapBackendResource));
      } catch (error) {
        console.error('Failed to load backend resources:', error);
        setBackendResources([]);
      }
    };

    loadResources();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch(USERS_API_URL);
        if (!response.ok) {
          throw new Error('Failed to load users');
        }

        const users = await response.json();
        setBackendUsers(Array.isArray(users) ? users : []);
      } catch (error) {
        console.error('Failed to load backend users:', error);
        setBackendUsers([]);
      }
    };

    loadUsers();
  }, []);

  useEffect(() => {
    fetchAvailableNowSlots();

    const intervalId = window.setInterval(() => {
      fetchAvailableNowSlots();
    }, LIVE_BOOKING_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchCheckedInAdminRows();
  }, [isAdmin]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchBookings();

    const intervalId = window.setInterval(() => {
      fetchBookings();
    }, LIVE_BOOKING_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [backendResources, backendUsers, isAdmin, student.id, student.name]);

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

    const facility =
      backendResources.find((item) => item.id === form.facilityId) ??
      mockFacilities.find((item) => item.id === form.facilityId);
    const bookingWindowValidationMessage = getBookingWindowValidationMessage(bookings, facility, form);

    const slots = buildAvailability(bookings, form.facilityId, form.date).slice(0, 3);

    if (bookingWindowValidationMessage) {
      setConflictMessage(
        isEquipmentResource(facility)
          ? bookingWindowValidationMessage
          : slots.length
            ? `Time slot already booked. Available: ${slots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(', ')}`
            : 'Time slot already booked. No 1-hour availability remains for this date.',
      );
      return;
    }

    if (isEquipmentResource(facility) && facility?.capacity) {
      const reservedUnits = getOverlappingBookedQuantity(bookings, form.facilityId, form.date, form.startTime, form.endTime);
      const availableUnits = Math.max(0, Number(facility.capacity) - reservedUnits);
      setConflictMessage(`${availableUnits} of ${facility.capacity} units are available in this time window.`);
      return;
    }

    if (slots.length) {
      setConflictMessage(`Available: ${slots.map((slot) => `${slot.startTime}-${slot.endTime}`).join(', ')}`);
      return;
    }

    setConflictMessage('Selected resource is available within the current operating window.');
  }, [backendResources, bookings, form]);

  useEffect(() => {
    const facility =
      backendResources.find((item) => item.id === form.facilityId) ??
      mockFacilities.find((item) => item.id === form.facilityId);

    if (
      releasedSlotPrefill &&
      form.facilityId === releasedSlotPrefill.facilityId &&
      form.date === releasedSlotPrefill.date
    ) {
      if (form.startTime !== releasedSlotPrefill.startTime || form.endTime !== releasedSlotPrefill.endTime) {
        setForm((current) => ({
          ...current,
          startTime: releasedSlotPrefill.startTime,
          endTime: releasedSlotPrefill.endTime,
        }));
      }
      return;
    }

    const availableSlots = getCreateBookingStartTimeSlots(bookings, facility, form.date, form.attendees);
    if (!availableSlots.length || availableSlots.includes(form.startTime)) {
      return;
    }

    const nextStartTime = availableSlots[0];
    setForm((current) => ({
      ...current,
      startTime: nextStartTime,
      endTime: fromMinutes(Math.min(toMinutes(nextStartTime) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END)),
    }));
  }, [backendResources, bookings, form.attendees, form.date, form.endTime, form.facilityId, form.startTime, releasedSlotPrefill]);

  useEffect(() => {
    if (!editingBooking) return;

    const facility =
      backendResources.find((item) => item.id === editForm.facilityId) ??
      mockFacilities.find((item) => item.id === editForm.facilityId);

    const availableSlots = getAvailableStartTimeSlots(
      bookings,
      facility,
      editForm.date,
      editForm.attendees,
      editingBooking.id,
    );

    if (!availableSlots.length || availableSlots.includes(editForm.startTime)) {
      return;
    }

    const nextStartTime = availableSlots[0];
    setEditForm((current) => ({
      ...current,
      startTime: nextStartTime,
      endTime: fromMinutes(Math.min(toMinutes(nextStartTime) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END)),
    }));
  }, [backendResources, bookings, editForm.attendees, editForm.date, editForm.facilityId, editForm.startTime, editingBooking]);

  useEffect(() => {
    let isMounted = true;

    const loadRoleBasedNotifications = async () => {
      try {
        const context = getNotificationContext();
        const role = context.role || String(student.role || '').toUpperCase();
        const userId = context.userId || student.id;

        let payload = [];
        if (role === 'ADMIN') {
          payload = await getRoleNotifications('ADMIN');
        } else if (userId) {
          payload = await getUserNotifications(userId);
        }

        const mapped = (Array.isArray(payload) ? payload : [])
          .map((notification) => mapNotificationToUi(notification, { role }))
          .filter((notification) => {
            if (role === 'ADMIN') {
              return true;
            }

            if (!userId) {
              return !notification.userId;
            }

            return !notification.userId || String(notification.userId) === String(userId);
          })
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

        if (isMounted) {
          setNotifications(mapped);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load booking notifications preview:', error);
        }
      }
    };

    void loadRoleBasedNotifications();
    const timer = window.setInterval(() => {
      void loadRoleBasedNotifications();
    }, LIVE_BOOKING_SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [student.id, student.role]);

  const filteredBookings = bookings.filter((booking) => {
    const facility =
      backendResources.find((item) => item.id === booking.facilityId) ??
      mockFacilities.find((item) => item.id === booking.facilityId);
    const searchHaystack = [
      booking.facilityName,
      booking.purpose,
      booking.status,
      booking.date,
      booking.requesterName,
      booking.requesterId,
      facility?.type,
      facility?.location,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !deferredQuery || searchHaystack.includes(deferredQuery);
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
  const bookingNotificationsPreview = notifications
    .filter((notification) => String(notification.module || '').toUpperCase() === 'BOOKING')
    .slice(0, 3);
  const suggestionResources = backendResources.length ? backendResources : mockFacilities;
  const nextUpcomingBooking = [...bookings]
    .filter(isFutureOrTodayBooking)
    .sort((left, right) => new Date(`${left.date}T${left.startTime}`).getTime() - new Date(`${right.date}T${right.startTime}`).getTime())[0];
  const availableSuggestionResources = suggestionResources.filter((resource) => {
    const status = String(resource.status ?? '').toUpperCase();
    return isUserVisibleResource(resource) && (!status || status === 'AVAILABLE');
  });
  const resourceTypeOptions = [...new Set((backendResources.length ? backendResources : mockFacilities).map((facility) => facility.type).filter(Boolean))];
  const leastBusyResource = [...availableSuggestionResources]
    .map((resource) => ({
      resource,
      count: bookings.filter(
        (booking) =>
          booking.facilityId === String(resource.id) &&
          booking.status !== 'REJECTED' &&
          booking.status !== 'CANCELLED' &&
          isFutureOrTodayBooking(booking),
      ).length,
    }))
    .sort((left, right) => left.count - right.count)[0];
  const soonestSmartSlot = (() => {
    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const targetDate = toDateKey(addDays(new Date(), dayOffset));

      for (const resource of availableSuggestionResources) {
        const slots = getAvailableStartTimeSlots(bookings, resource, targetDate, 1);
        if (slots.length) {
          return {
            resource,
            date: targetDate,
            startTime: slots[0],
            endTime: fromMinutes(Math.min(toMinutes(slots[0]) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END)),
          };
        }
      }
    }

    return null;
  })();
  const busiestTimeSlot = bookingStartTimeSlots
    .map((slot) => ({
      slot,
      count: bookings.filter(
        (booking) =>
          booking.status !== 'REJECTED' &&
          booking.status !== 'CANCELLED' &&
          booking.startTime === slot &&
          isFutureOrTodayBooking(booking),
      ).length,
    }))
    .sort((left, right) => right.count - left.count)[0];
  const releasedNoShowSlot = availableNowSlots.find((slot) => slot.type === 'PARTIAL_SLOT') ?? null;
  const smartSuggestions = [
    releasedNoShowSlot
      ? {
          id: 'released-no-show-slot',
          icon: Sparkles,
          eyebrow: 'Newly Open Spot',
          title: `${releasedNoShowSlot.resourceName} reopened after a no-show`,
          description: `${formatDate(availableNowSlots[0].bookingDate)} · ${formatTimeRange(
            releasedNoShowSlot.availableFrom,
            releasedNoShowSlot.availableTo,
          )}`,
          actionLabel: 'Book Now',
          theme: 'teal',
          availableSlot: releasedNoShowSlot,
        }
      : null,
    soonestSmartSlot
      ? {
          id: 'free-slot',
          icon: Clock3,
          eyebrow: 'Best Next Slot',
          title: `${soonestSmartSlot.resource.name} is open soon`,
          description: `${formatDate(soonestSmartSlot.date)} · ${formatTimeRange(soonestSmartSlot.startTime, soonestSmartSlot.endTime)}`,
          actionLabel: 'Book Now',
          theme: 'blue',
          facilityId: String(soonestSmartSlot.resource.id),
          date: soonestSmartSlot.date,
          startTime: soonestSmartSlot.startTime,
          endTime: soonestSmartSlot.endTime,
        }
      : null,
    leastBusyResource
      ? {
          id: 'resource',
          icon: GraduationCap,
          eyebrow: 'Resource Suggestion',
          title: `${leastBusyResource.resource.name} is lightly booked`,
          description:
            leastBusyResource.count === 0
              ? 'No upcoming bookings are using it yet'
              : `${leastBusyResource.count} upcoming booking${leastBusyResource.count === 1 ? '' : 's'} scheduled`,
          actionLabel: 'Book Resource',
          theme: 'teal',
          facilityId: String(leastBusyResource.resource.id),
        }
      : null,
    busiestTimeSlot && busiestTimeSlot.count > 0
      ? {
          id: 'peak-warning',
          icon: AlertTriangle,
          eyebrow: 'Peak Warning',
          title: `${busiestTimeSlot.slot} is in high demand`,
          description: `${busiestTimeSlot.count} booking${busiestTimeSlot.count === 1 ? '' : 's'} already start in this slot`,
          metaLabel: 'Busy slot',
          theme: 'amber',
        }
      : null,
    nextUpcomingBooking
      ? {
          id: 'reminder',
          icon: BellRing,
          eyebrow: 'Reminder',
          title: `${nextUpcomingBooking.facilityName} is coming up`,
          description: `${formatDate(nextUpcomingBooking.date)} · ${formatTimeRange(nextUpcomingBooking.startTime, nextUpcomingBooking.endTime)}`,
          actionLabel: 'View Booking',
          theme: 'violet',
          bookingId: nextUpcomingBooking.id,
        }
      : null,
  ].filter(Boolean);
  const liveSmartSuggestions = smartSuggestions.map((suggestion) =>
    suggestion.id === 'released-no-show-slot' && releasedNoShowSlot
      ? {
          ...suggestion,
          description: `${formatDate(releasedNoShowSlot.bookingDate)} · ${formatTimeRange(
            releasedNoShowSlot.availableFrom,
            releasedNoShowSlot.availableTo,
          )}`,
        }
      : suggestion,
  );
  const pendingFriendlySuggestion =
    pendingCount > 0
      ? {
          id: 'pending-followup',
          icon: BellRing,
          eyebrow: 'Approval Queue',
          title: `${pendingCount} request${pendingCount === 1 ? '' : 's'} still waiting`,
          description: 'Keep an eye on your latest requests while planning the next one.',
          actionLabel: 'Open Bookings',
          theme: 'violet',
        }
      : null;
  const lowDemandDaySuggestion = soonestSmartSlot
    ? {
        id: 'low-demand-day',
        icon: CalendarRange,
        eyebrow: 'Low Demand Day',
        title: `${formatDate(soonestSmartSlot.date)} has cleaner availability`,
        description: `${soonestSmartSlot.resource.name} still has a free 2-hour window ready to book.`,
        actionLabel: 'Use This Day',
        theme: 'blue',
        facilityId: String(soonestSmartSlot.resource.id),
        date: soonestSmartSlot.date,
        startTime: soonestSmartSlot.startTime,
        endTime: soonestSmartSlot.endTime,
      }
    : null;
  const extendedSmartSuggestions = [
    ...liveSmartSuggestions,
    pendingFriendlySuggestion,
    lowDemandDaySuggestion,
  ].filter(Boolean);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    if (
      releasedSlotPrefill &&
      ((name === 'facilityId' && value !== releasedSlotPrefill.facilityId) ||
        (name === 'date' && value !== releasedSlotPrefill.date))
    ) {
      setReleasedSlotPrefill(null);
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleStartTimeSlotChange = (nextStartTime) => {
    if (releasedSlotPrefill && nextStartTime !== releasedSlotPrefill.startTime) {
      return;
    }

    const nextEndMinutes = Math.min(toMinutes(nextStartTime) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END);

    setForm((current) => ({
      ...current,
      startTime: nextStartTime,
      endTime: releasedSlotPrefill?.endTime ?? fromMinutes(nextEndMinutes),
    }));
  };

  const handleEditStartTimeSlotChange = (nextStartTime) => {
    const nextEndMinutes = Math.min(toMinutes(nextStartTime) + DATE_CHANGE_SLOT_MINUTES, DAY_MINUTES_END);

    setEditForm((current) => ({
      ...current,
      startTime: nextStartTime,
      endTime: fromMinutes(nextEndMinutes),
    }));
  };

  const handleSuggestionAction = (suggestion) => {
    if (suggestion.id === 'released-no-show-slot' && suggestion.availableSlot) {
      const nextReleasedSlotPrefill = {
        facilityId: String(suggestion.availableSlot.resourceId ?? ''),
        date: suggestion.availableSlot.bookingDate ?? '',
        startTime: suggestion.availableSlot.availableFrom ?? '',
        endTime: suggestion.availableSlot.availableTo ?? '',
      };
      setReleasedSlotPrefill(nextReleasedSlotPrefill);
      setForm((current) => ({
        ...current,
        facilityId: nextReleasedSlotPrefill.facilityId || current.facilityId,
        date: nextReleasedSlotPrefill.date || current.date,
        startTime: nextReleasedSlotPrefill.startTime || current.startTime,
        endTime: nextReleasedSlotPrefill.endTime || current.endTime,
      }));
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.FORM);
      return;
    }

    if (suggestion.id === 'free-slot' || suggestion.id === 'low-demand-day') {
      setReleasedSlotPrefill(null);
      setForm((current) => ({
        ...current,
        facilityId: suggestion.facilityId ?? current.facilityId,
        date: suggestion.date ?? current.date,
        startTime: suggestion.startTime ?? current.startTime,
        endTime: suggestion.endTime ?? current.endTime,
      }));
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.FORM);
      return;
    }

    if (suggestion.id === 'resource') {
      setReleasedSlotPrefill(null);
      setForm((current) => ({ ...current, facilityId: suggestion.facilityId ?? current.facilityId }));
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.FORM);
      return;
    }

    if (suggestion.id === 'reminder') {
      const matchedBooking = bookings.find((booking) => booking.id === suggestion.bookingId);
      if (matchedBooking) {
        setSelectedBooking(matchedBooking);
      }
      setActiveSection(PAGE_SECTIONS.OVERVIEW);
      return;
    }

    if (suggestion.id === 'pending-followup') {
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.LIST);
      return;
    }

    setActiveSection(PAGE_SECTIONS.BOOKINGS);
  };

  const handleAvailableNowBooking = async (slot) => {
    if (!slot || isBookingAvailableNowSlot) {
      return;
    }

    setIsBookingAvailableNowSlot(true);
    setSubmitMessage('');

    const bookingPayload = {
      userId: String(extractNumericId(student.id, 1)),
      resourceId: String(slot.resourceId),
      bookingDate: slot.bookingDate,
      startTime: slot.availableFrom,
      endTime: slot.availableTo,
      description: slot.type === 'PARTIAL_SLOT' ? 'Quick booking from released no-show slot' : 'Quick booking from available-now board',
      attendeesCount: 1,
      status: 'APPROVED',
    };

    try {
      const response = await fetch(BOOKINGS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Quick booking failed'}`,
        );
      }

      const savedBooking = await response.json();
      const resource =
        backendResources.find((item) => String(item.id) === String(slot.resourceId)) ??
        mockFacilities.find((item) => String(item.id) === String(slot.resourceId));

      setBookings((current) => [
        {
          backendId: savedBooking.id ? String(savedBooking.id) : '',
          id: savedBooking.id ? `bk-${savedBooking.id}` : `bk-${Date.now()}`,
          facilityId: String(slot.resourceId),
          facilityName: resource?.name ?? slot.resourceName,
          requesterId: student.id,
          requesterName: student.name,
          date: savedBooking.bookingDate ?? slot.bookingDate,
          startTime: savedBooking.startTime?.slice?.(0, 5) ?? slot.availableFrom,
          endTime: savedBooking.endTime?.slice?.(0, 5) ?? slot.availableTo,
          purpose: savedBooking.description ?? bookingPayload.description,
          attendees: Number(savedBooking.attendeesCount ?? 1),
          status: savedBooking.status ?? 'PENDING',
          adminNote: '',
          checkedIn: false,
          checkedInAt: '',
        },
        ...current,
      ]);
      setSubmitMessage('Live slot booked successfully and reserved immediately.');
      setActiveSection(PAGE_SECTIONS.CREATE);
      setCreateViewMode(CREATE_VIEW_MODES.LIST);
      setAvailableNowSlots((current) =>
        current.filter(
          (item) =>
            !(
              item.resourceId === slot.resourceId &&
              item.availableFrom === slot.availableFrom &&
              item.availableTo === slot.availableTo
            ),
        ),
      );
    } catch (error) {
      console.error('Available-now booking failed:', error);
      setSubmitMessage(error.message || 'Could not book the available slot.');
    } finally {
      setIsBookingAvailableNowSlot(false);
      fetchAvailableNowSlots();
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const bookingToDelete = bookings.find((booking) => booking.id === bookingId);
    if (!bookingToDelete) return;

    const backendId = bookingToDelete.backendId || bookingToDelete.id.replace(/^bk-/, '');

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/${backendId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Delete failed'}`,
        );
      }

      setBookings((current) => current.filter((booking) => booking.id !== bookingId));
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
      if (qrBooking?.id === bookingId) {
        setQrBooking(null);
      }
      setSubmitMessage('Booking cancelled and removed successfully.');
    } catch (error) {
      console.error('Booking deletion failed:', error);
      setSubmitMessage(error.message || 'Booking cancellation failed due to an unexpected backend error.');
    }
  };

  const handleCreateBooking = async (event) => {
    event.preventDefault();

    const facility =
      backendResources.find((item) => item.id === form.facilityId) ??
      mockFacilities.find((item) => item.id === form.facilityId);
    if (!facility) return;

    const resourceAvailabilityMessage = getResourceAvailabilityValidationMessage(facility);
    if (resourceAvailabilityMessage) {
      setSubmitMessage(resourceAvailabilityMessage);
      return;
    }

    const capacityValidationMessage = getCapacityValidationMessage(facility, form.attendees);
    if (capacityValidationMessage) {
      setSubmitMessage(capacityValidationMessage);
      return;
    }

    const bookingWindowValidationMessage = getBookingWindowValidationMessage(bookings, facility, form);
    if (bookingWindowValidationMessage) {
      setSubmitMessage(bookingWindowValidationMessage);
      return;
    }

    const bookingPayload = {
      userId: student.id,
      resourceId: String(facility.id),

  bookingDate: form.date,        // ✅ FIX
  startTime: form.startTime,
  endTime: form.endTime,

  description: form.purpose,     // ✅ FIX
  attendeesCount: Number(form.attendees), // ✅ FIX
};
    bookingPayload.urgentApproval = Boolean(releasedSlotPrefill);

    try {
      const response = await fetch(BOOKINGS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Request failed'}`,
        );
      }

      const savedBooking = await response.json();

      const nextBooking = {
        backendId: savedBooking.id ? String(savedBooking.id) : '',
        id: savedBooking.id ? `bk-${savedBooking.id}` : `bk-${Date.now()}`,
        facilityId: facility.id,
        facilityName: facility.name,
        requesterId: student.id,
        requesterName: student.name,
        date: savedBooking.bookingDate ?? form.date,
startTime: savedBooking.startTime?.slice(0, 5) ?? form.startTime,
endTime: savedBooking.endTime?.slice(0, 5) ?? form.endTime,
purpose: savedBooking.description ?? form.purpose,
attendees: Number(savedBooking.attendeesCount ?? form.attendees ?? 0),
        status: savedBooking.status ?? 'PENDING',
        urgentApproval: Boolean(savedBooking.urgentApproval ?? releasedSlotPrefill),
        adminNote: 'Student request captured and queued for approval.',
        dateChangeApproved: false,
        dateChangeRequested: false,
        requestedDate: '',
        previousDate: '',
        previousStartTime: '',
        previousEndTime: '',
      };

      setBookings((current) => [nextBooking, ...current]);
      if (releasedSlotPrefill) {
        setAvailableNowSlots((current) =>
          current.filter(
            (slot) =>
              !(
                String(slot.resourceId) === String(releasedSlotPrefill.facilityId) &&
                slot.bookingDate === releasedSlotPrefill.date &&
                slot.availableFrom === releasedSlotPrefill.startTime &&
                slot.availableTo === releasedSlotPrefill.endTime
              ),
          ),
        );
        setReleasedSlotPrefill(null);
      }
      setSubmitMessage(
        releasedSlotPrefill
          ? 'Urgent approval request sent for the reopened slot. The admin queue will highlight it.'
          : 'Booking created and synced with the backend successfully.',
      );
      setCreateViewMode(CREATE_VIEW_MODES.LIST);
      setForm(initialForm);
      setActiveSection(PAGE_SECTIONS.CREATE);
    } catch (error) {
      console.error('Booking creation failed:', error);
      if (error instanceof TypeError) {
        setSubmitMessage(`Could not reach the backend at ${BACKEND_URL}. Check whether the server is running and accessible.`);
        return;
      }

      setSubmitMessage(error.message || 'Booking creation failed due to an unexpected backend error.');
    }
  };

  const handleBookingDrop = async (event, nextDate) => {
    const bookingId = event.dataTransfer.getData('bookingId');
    if (!bookingId) return;
    const bookingToMove = bookings.find((booking) => booking.id === bookingId);
    if (!bookingToMove) return;

    const dragState = getBookingDragState(bookingToMove);
    if (!dragState.canDrag) {
      setSubmitMessage(dragState.message);
      return;
    }

    if (bookingToMove.date === nextDate) {
      return;
    }

    const backendId = bookingToMove.backendId || bookingToMove.id.replace(/^bk-/, '');
    const payload = {
      userId: bookingToMove.requesterId,
      resourceId: String(bookingToMove.facilityId),
      bookingDate: nextDate,
      startTime: bookingToMove.startTime,
      endTime: bookingToMove.endTime,
      description: bookingToMove.purpose,
      attendeesCount: Number(bookingToMove.attendees),
      status: bookingToMove.status,
      rejectionReason: bookingToMove.adminNote || '',
      dateChangeRequested: false,
      dateChangeApproved: false,
      requestedDate: null,
    };

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/${backendId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Date update failed'}`,
        );
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                date: nextDate,
                dateChangeRequested: false,
                dateChangeApproved: false,
                requestedDate: '',
              }
            : booking,
        ),
      );

      setSelectedBooking((current) =>
        current?.id === bookingId
          ? {
              ...current,
              date: nextDate,
              dateChangeRequested: false,
              dateChangeApproved: false,
              requestedDate: '',
            }
          : current,
      );

      setSubmitMessage('Booking date updated successfully.');
    } catch (error) {
      console.error('Booking date change failed:', error);
      setSubmitMessage(error.message || 'Could not update the booking date.');
    }
  };

  const handleBookingDragStart = (event, booking) => {
    const dragState = getBookingDragState(booking);

    if (!dragState.canDrag) {
      event.preventDefault();
      setSubmitMessage(dragState.message);
      return;
    }

    event.dataTransfer.setData('bookingId', booking.id);
  };

  const openDateChangeRequestModal = (booking) => {
    setRequestedDate(booking.requestedDate || booking.date);
    setRequestedTimeWindow(
      booking.requestedStartTime && booking.requestedEndTime
        ? `${booking.requestedStartTime}|${booking.requestedEndTime}`
        : '',
    );
    setDateChangeRequestBooking(booking);
  };

  const handleSubmitDateChangeRequest = async () => {
    if (!dateChangeRequestBooking || !requestedDate || !requestedTimeWindow) return;

    const availableWindows = buildDateChangeSlots(
      bookings.filter((booking) => booking.id !== dateChangeRequestBooking.id),
      dateChangeRequestBooking,
      requestedDate,
    );

    if (!availableWindows.length) {
      setSubmitMessage('That day has no free time for this resource. Please choose a different date.');
      return;
    }

    const selectedWindow = availableWindows.find((window) => getTimeWindowValue(window) === requestedTimeWindow);
    if (!selectedWindow) {
      setSubmitMessage('Please choose one of the available free time windows for the requested day.');
      return;
    }

    const backendId = dateChangeRequestBooking.backendId || dateChangeRequestBooking.id.replace(/^bk-/, '');
    setIsSubmittingDateRequest(true);

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/${backendId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: dateChangeRequestBooking.requesterId,
          resourceId: String(dateChangeRequestBooking.facilityId),
          bookingDate: dateChangeRequestBooking.date,
          startTime: dateChangeRequestBooking.startTime,
          endTime: dateChangeRequestBooking.endTime,
          description: dateChangeRequestBooking.purpose,
          attendeesCount: Number(dateChangeRequestBooking.attendees),
          status: dateChangeRequestBooking.status,
          rejectionReason: dateChangeRequestBooking.adminNote || '',
          dateChangeRequested: true,
          dateChangeApproved: false,
          requestedDate,
          requestedStartTime: selectedWindow.startTime,
          requestedEndTime: selectedWindow.endTime,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Date request failed'}`,
        );
      }

      const savedBooking = await response.json();

      setBookings((current) =>
        current.map((booking) =>
          booking.id === dateChangeRequestBooking.id
            ? {
                ...booking,
                dateChangeRequested: true,
                dateChangeApproved: false,
                requestedDate: savedBooking.requestedDate ?? requestedDate,
                requestedStartTime: savedBooking.requestedStartTime?.slice(0, 5) ?? selectedWindow.startTime,
                requestedEndTime: savedBooking.requestedEndTime?.slice(0, 5) ?? selectedWindow.endTime,
              }
            : booking,
        ),
      );

      setSelectedBooking((current) =>
        current?.id === dateChangeRequestBooking.id
          ? {
              ...current,
              dateChangeRequested: true,
              dateChangeApproved: false,
              requestedDate: savedBooking.requestedDate ?? requestedDate,
              requestedStartTime: savedBooking.requestedStartTime?.slice(0, 5) ?? selectedWindow.startTime,
              requestedEndTime: savedBooking.requestedEndTime?.slice(0, 5) ?? selectedWindow.endTime,
            }
          : current,
      );

      setDateChangeRequestBooking(null);
      setRequestedDate('');
      setRequestedTimeWindow('');
      setSubmitMessage('Date change request sent. Admin can now review the requested day and available windows.');
    } catch (error) {
      console.error('Date change request failed:', error);
      setSubmitMessage(error.message || 'Could not submit the date change request.');
    } finally {
      setIsSubmittingDateRequest(false);
    }
  };

  const handleApproveDateChangePermission = async (booking) => {
    const backendId = booking.backendId || booking.id.replace(/^bk-/, '');
    const requestedTargetDate = booking.requestedDate || booking.date;
    const availableWindows = buildDateChangeSlots(
      bookings.filter((item) => item.id !== booking.id),
      booking,
      requestedTargetDate,
    );
    const requestedStartTime = booking.requestedStartTime || booking.startTime;
    const requestedEndTime = booking.requestedEndTime || booking.endTime;
    const requestedWindowStillFree = availableWindows.some(
      (window) => window.startTime === requestedStartTime && window.endTime === requestedEndTime,
    );

    if (!availableWindows.length || !requestedWindowStillFree) {
      setSubmitMessage('That requested day and time are no longer free, so permission cannot be granted.');
      return;
    }
    const nextStartTime = requestedStartTime;
    const nextEndTime = requestedEndTime;

    setProcessingBookingId(booking.id);
    setProcessingAction('date-change');

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/${backendId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: booking.requesterId,
          resourceId: String(booking.facilityId),
          bookingDate: requestedTargetDate,
          startTime: nextStartTime,
          endTime: nextEndTime,
          description: booking.purpose,
          attendeesCount: Number(booking.attendees),
          status: booking.status,
          rejectionReason: booking.adminNote || '',
          dateChangeRequested: false,
          dateChangeApproved: true,
          requestedDate: requestedTargetDate,
          requestedStartTime: requestedStartTime,
          requestedEndTime: requestedEndTime,
          previousDate: booking.date,
          previousStartTime: booking.startTime,
          previousEndTime: booking.endTime,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Permission update failed'}`,
        );
      }

      const savedBooking = await response.json();

      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                date: requestedTargetDate,
                startTime: savedBooking.startTime?.slice(0, 5) ?? nextStartTime,
                endTime: savedBooking.endTime?.slice(0, 5) ?? nextEndTime,
                dateChangeRequested: false,
                dateChangeApproved: true,
                requestedDate: '',
                requestedStartTime: '',
                requestedEndTime: '',
                previousDate: savedBooking.previousDate ?? booking.date,
                previousStartTime: savedBooking.previousStartTime?.slice(0, 5) ?? booking.startTime,
                previousEndTime: savedBooking.previousEndTime?.slice(0, 5) ?? booking.endTime,
              }
            : item,
        ),
      );

      setSelectedBooking((current) =>
        current?.id === booking.id
          ? {
              ...current,
              date: requestedTargetDate,
              startTime: savedBooking.startTime?.slice(0, 5) ?? nextStartTime,
              endTime: savedBooking.endTime?.slice(0, 5) ?? nextEndTime,
              dateChangeRequested: false,
              dateChangeApproved: true,
              requestedDate: '',
              requestedStartTime: '',
              requestedEndTime: '',
              previousDate: savedBooking.previousDate ?? booking.date,
              previousStartTime: savedBooking.previousStartTime?.slice(0, 5) ?? booking.startTime,
              previousEndTime: savedBooking.previousEndTime?.slice(0, 5) ?? booking.endTime,
            }
          : current,
      );

      setSubmitMessage(`Date change approved. The booking was moved to ${formatDate(requestedTargetDate)} at ${formatTimeRange(nextStartTime, nextEndTime)}.`);
    } catch (error) {
      console.error('Date change permission update failed:', error);
      setSubmitMessage(error.message || 'Could not grant date change permission.');
    } finally {
      setProcessingBookingId(null);
      setProcessingAction('');
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true, status: 'READ' } : notification,
      ),
    );

    try {
      await markNotificationAsReadApi(notificationId);
    } catch (error) {
      console.error('Failed to mark booking preview notification as read:', error);
    }
  };

  const openEditBooking = (booking) => {
    setSelectedBooking(null);
    setSubmitMessage('');
    setEditingBooking(booking);
    setEditForm({
      facilityId: booking.facilityId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      purpose: booking.purpose ?? '',
      attendees: String(booking.attendees ?? ''),
    });
  };

  const handleSaveBookingEdit = async () => {
    if (!editingBooking) return;

    const facility =
      backendResources.find((item) => item.id === editForm.facilityId) ??
      mockFacilities.find((item) => item.id === editForm.facilityId);

    if (!facility) {
      setSubmitMessage('Please select a valid resource before saving your changes.');
      return;
    }

    const resourceAvailabilityMessage = getResourceAvailabilityValidationMessage(facility);
    if (resourceAvailabilityMessage) {
      setSubmitMessage(resourceAvailabilityMessage);
      return;
    }

    const capacityValidationMessage = getCapacityValidationMessage(facility, editForm.attendees);
    if (capacityValidationMessage) {
      setSubmitMessage(capacityValidationMessage);
      return;
    }

    const bookingWindowValidationMessage = getBookingWindowValidationMessage(bookings, facility, editForm, editingBooking.id);
    if (bookingWindowValidationMessage) {
      setSubmitMessage(
        isEquipmentResource(facility)
          ? bookingWindowValidationMessage
          : 'That update clashes with another booking for the same resource. Choose a different time slot.',
      );
      return;
    }

    const backendId = editingBooking.backendId || editingBooking.id.replace(/^bk-/, '');
    const nextStatus = editingBooking.status === 'REJECTED' ? 'PENDING' : editingBooking.status;
    const payload = {
      userId: editingBooking.requesterId,
      resourceId: String(facility.id),
      bookingDate: editForm.date,
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      description: editForm.purpose,
      attendeesCount: Number(editForm.attendees),
      status: nextStatus,
      urgentApproval: Boolean(editingBooking.urgentApproval && nextStatus === 'PENDING'),
      rejectionReason: nextStatus === 'REJECTED' ? editingBooking.adminNote || '' : '',
    };

    setIsSavingEdit(true);

    try {
      const response = await fetch(`${BOOKINGS_API_URL}/${backendId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText?.trim()
            ? `Backend error ${response.status}: ${errorText}`
            : `Backend error ${response.status}: ${response.statusText || 'Update failed'}`,
        );
      }

      const savedBooking = await response.json();
      const updatedBooking = {
        ...editingBooking,
        backendId: savedBooking.id ? String(savedBooking.id) : backendId,
        facilityId: String(savedBooking.resourceId ?? facility.id),
        facilityName: facility.name,
        date: savedBooking.bookingDate ?? editForm.date,
        startTime: savedBooking.startTime?.slice(0, 5) ?? editForm.startTime,
        endTime: savedBooking.endTime?.slice(0, 5) ?? editForm.endTime,
        purpose: savedBooking.description ?? editForm.purpose,
        attendees: Number(savedBooking.attendeesCount ?? editForm.attendees ?? 0),
        status: savedBooking.status ?? nextStatus,
        urgentApproval: Boolean(savedBooking.urgentApproval ?? (editingBooking.urgentApproval && nextStatus === 'PENDING')),
        adminNote: savedBooking.rejectionReason ?? '',
        dateChangeRequested: false,
        dateChangeApproved: savedBooking.dateChangeApproved ?? editingBooking.dateChangeApproved,
        requestedDate: savedBooking.requestedDate ?? '',
        previousDate: savedBooking.previousDate ?? editingBooking.previousDate ?? '',
        previousStartTime: savedBooking.previousStartTime?.slice(0, 5) ?? editingBooking.previousStartTime ?? '',
        previousEndTime: savedBooking.previousEndTime?.slice(0, 5) ?? editingBooking.previousEndTime ?? '',
      };

      setBookings((current) => current.map((booking) => (booking.id === editingBooking.id ? updatedBooking : booking)));
      setEditingBooking(null);
      setEditForm(initialForm);
      setSubmitMessage(
        nextStatus === 'PENDING'
          ? 'Booking updated and resubmitted for admin review.'
          : 'Booking updated successfully and synced with the backend.',
      );
    } catch (error) {
      console.error('Booking update failed:', error);
      setSubmitMessage(error.message || 'Booking update failed due to an unexpected backend error.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const applyPersistedBookingStatus = (bookingId, savedBooking, fallbackAdminNote = '') => {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              status: savedBooking.status ?? booking.status,
              urgentApproval: Boolean(savedBooking.urgentApproval ?? booking.urgentApproval),
              adminNote: savedBooking.rejectionReason ?? fallbackAdminNote,
            }
          : booking,
      ),
    );
  };

  const persistAdminStatusChange = async (booking, action, reason = '') => {
    const backendId = booking.backendId || booking.id.replace(/^bk-/, '');
    let url = '';
    let options = { method: 'PUT' };
    let fallbackAdminNote = '';

    if (action === 'approve') {
      fallbackAdminNote = 'Approved by admin after booking review.';
      url = `${BOOKINGS_API_URL}/${backendId}/approve`;
    } else if (action === 'reject') {
      fallbackAdminNote = reason.trim() || 'Rejected by admin after booking review.';
      url = `${BOOKINGS_API_URL}/${backendId}/reject`;
      options = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: fallbackAdminNote }),
      };
    } else if (action === 'cancel') {
      fallbackAdminNote = 'Cancelled by admin after manual review.';
      url = `${BOOKINGS_API_URL}/${backendId}/cancel`;
    } else {
      return;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText?.trim()
          ? `Backend error ${response.status}: ${errorText}`
          : `Backend error ${response.status}: ${response.statusText || 'Status update failed'}`,
      );
    }

    const savedBooking = await response.json();
    applyPersistedBookingStatus(booking.id, savedBooking, fallbackAdminNote);
  };

  const handleAdminAction = async (booking, action) => {
    setProcessingBookingId(booking.id);
    setProcessingAction(action);

    try {
      await persistAdminStatusChange(booking, action);
      setSubmitMessage(
        action === 'approve'
          ? 'Booking approved successfully.'
          : 'Booking cancelled successfully.',
      );
    } catch (error) {
      console.error('Admin booking status update failed:', error);
      setSubmitMessage(error.message || 'Could not update the booking status.');
    } finally {
      setProcessingBookingId(null);
      setProcessingAction('');
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedBooking) return;

    setProcessingBookingId(selectedBooking.id);
    setProcessingAction('reject');

    try {
      await persistAdminStatusChange(
        selectedBooking,
        'reject',
        rejectReason.trim() || 'Rejected by admin after booking review.',
      );
      setSelectedBooking(null);
      setRejectReason('');
      setSubmitMessage('Booking rejected successfully.');
    } catch (error) {
      console.error('Booking rejection failed:', error);
      setSubmitMessage(error.message || 'Could not reject the booking.');
    } finally {
      setProcessingBookingId(null);
      setProcessingAction('');
    }
  };

  const handleApproveSubmit = async () => {
    if (!selectedBooking) return;

    setProcessingBookingId(selectedBooking.id);
    setProcessingAction('approve');

    try {
      await persistAdminStatusChange(selectedBooking, 'approve');
      setSelectedBooking(null);
      setRejectReason('');
      setSubmitMessage('Booking approved successfully.');
    } catch (error) {
      console.error('Booking approval failed:', error);
      setSubmitMessage(error.message || 'Could not approve the booking.');
    } finally {
      setProcessingBookingId(null);
      setProcessingAction('');
    }
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
  const adminStats = [
    { label: 'Total requests', value: bookings.length, tone: 'primary' },
    { label: 'Pending approvals', value: pendingCount, tone: 'warning' },
    { label: 'Approved today', value: approvedCount, tone: 'success' },
    { label: 'Rejected or cancelled', value: rejectedCount + bookings.filter((booking) => booking.status === 'CANCELLED').length, tone: 'danger' },
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
        <button type="button" className={joinClassNames(styles.pageNavLink, activeSection === PAGE_SECTIONS.SUGGESTIONS && styles.pageNavActive)} onClick={() => setActiveSection(PAGE_SECTIONS.SUGGESTIONS)}>
          Suggestions
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

  const renderAdminView = () => {
    const allRows = [...filteredBookings].sort(
      (left, right) => Number(Boolean(right.urgentApproval)) - Number(Boolean(left.urgentApproval)),
    );
    const pendingRows = filteredBookings.filter((booking) => booking.status === 'PENDING');
    pendingRows.sort((left, right) => Number(Boolean(right.urgentApproval)) - Number(Boolean(left.urgentApproval)));
    const checkedInRows = checkedInAdminRows;
    const dateChangeRequests = bookings.filter((booking) => booking.dateChangeRequested && booking.requestedDate);
    const tableRows = adminTab === ADMIN_TABS.PENDING ? pendingRows : allRows;
    const resourceCounts = filteredBookings.reduce((accumulator, booking) => {
      accumulator[booking.facilityName] = (accumulator[booking.facilityName] ?? 0) + 1;
      return accumulator;
    }, {});
    const topResources = Object.entries(resourceCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
    const peakHours = Array.from({ length: 8 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`).map((hour) => ({
      hour,
      count: filteredBookings.filter((booking) => booking.startTime.startsWith(hour.slice(0, 2))).length,
    }));
    const statusDistribution = ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'].map((status) => ({
      status,
      value: filteredBookings.filter((booking) => booking.status === status).length,
      tone:
        status === 'APPROVED'
          ? '#22c55e'
          : status === 'PENDING'
            ? '#f59e0b'
            : status === 'REJECTED'
              ? '#f87171'
              : '#64748b',
    }));
    const totalStatusValue = Math.max(1, statusDistribution.reduce((sum, item) => sum + item.value, 0));
    let currentPieOffset = 0;
    const pieStops = statusDistribution
      .map((item) => {
        const start = currentPieOffset;
        currentPieOffset += (item.value / totalStatusValue) * 100;
        return `${item.tone} ${start}% ${currentPieOffset}%`;
      })
      .join(', ');
    const linePoints = peakHours
      .map((point, index) => {
        const x = 24 + index * 44;
        const y = 120 - (point.count / Math.max(1, ...peakHours.map((item) => item.count), 1)) * 72;
        return `${x},${y}`;
      })
      .join(' ');

    const renderAdminStatusPill = (status) => (
      <span
        className={joinClassNames(
          styles.adminStatusPill,
          status === 'APPROVED'
            ? styles.adminStatusApproved
            : status === 'PENDING'
              ? styles.adminStatusPending
              : styles.adminStatusRejected,
        )}
      >
        {status === 'APPROVED' ? <CheckCircle2 size={15} /> : status === 'PENDING' ? <Clock3 size={15} /> : <XCircle size={15} />}
        {status === 'NO_SHOW' ? 'No Show' : status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );

    const renderActionButtons = (booking) => {
      return (
        <div className={styles.adminRowActions}>
          {booking.status === 'PENDING' ? (
            <button
              type="button"
              className={styles.adminReviewButton}
              onClick={() => {
                setSelectedBooking(booking);
                setReviewMode('approve');
                setRejectReason('');
              }}
            >
              Review
            </button>
          ) : (
            <span className={styles.adminActionState}>
              {booking.status === 'APPROVED'
                ? 'Approved'
                : booking.status === 'REJECTED'
                  ? 'Rejected'
                  : booking.status === 'NO_SHOW'
                    ? 'No Show'
                  : 'Cancelled'}
            </span>
          )}
        </div>
      );
    };

    const renderAdminTable = (rows, pendingOnly = false) => (
      <div className={styles.adminTableWrap}>
        <table className={styles.adminTable}>
          <thead>
            <tr>
              <th>Booking Details</th>
              <th>Date &amp; Time</th>
              <th>Student Name</th>
              <th>Attendees</th>
              <th>Status</th>
              <th className={styles.adminTableActionsHead}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, index) => (
                  <tr key={`admin-skeleton-${index}`}>
                    {Array.from({ length: 6 }, (_, cell) => (
                      <td key={cell}>
                        <SkeletonBlock className={styles.adminTableSkeleton} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((booking) => (
                  <tr
                    key={booking.id}
                    className={joinClassNames(
                      pendingOnly && styles.adminTableRowPending,
                      processingBookingId === booking.id && styles.adminTableRowProcessing,
                    )}
                  >
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{booking.purpose}</strong>
                        <span>{booking.facilityName}</span>
                        {booking.status === 'PENDING' && booking.urgentApproval ? (
                          <span className={styles.adminUrgentFlag}>Urgent re-opened slot</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{formatDate(booking.date)}</strong>
                        <span>{formatTimeRange(booking.startTime, booking.endTime)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{booking.requesterName}</strong>
                        <span>{booking.requesterId.toUpperCase()}</span>
                      </div>
                    </td>
                    <td>{booking.attendees}</td>
                    <td>
                      {renderAdminStatusPill(booking.status)}
                    </td>
                    <td>{renderActionButtons(booking)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && !rows.length ? (
          <div className={styles.adminEmptyState}>
            <strong>No bookings found</strong>
            <span>Try adjusting the filters or search terms to widen the result set.</span>
          </div>
        ) : null}
      </div>
    );

    const renderCheckedInTable = () => (
      <div className={styles.adminTableWrap}>
        <table className={styles.adminTable}>
          <thead>
            <tr>
              <th>User</th>
              <th>Resource</th>
              <th>Booking Time</th>
              <th>Checked In Time</th>
              <th>Status</th>
              <th>Late</th>
            </tr>
          </thead>
          <tbody>
            {checkedInRowsLoading
              ? Array.from({ length: 4 }, (_, index) => (
                  <tr key={`checked-in-skeleton-${index}`}>
                    {Array.from({ length: 6 }, (_, cell) => (
                      <td key={cell}>
                        <SkeletonBlock className={styles.adminTableSkeleton} />
                      </td>
                    ))}
                  </tr>
                ))
              : checkedInRows.map((row) => (
                  <tr key={`checked-in-${row.id}`}>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{row.user}</strong>
                        <span>{row.id}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{row.resource}</strong>
                        <span>{formatDate(row.bookingDate)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{formatTimeRange(row.startTime, row.endTime)}</strong>
                        <span>Fixed booking window</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.adminPrimaryCell}>
                        <strong>{formatDateTime(row.checkedInAt)}</strong>
                        <span>Actual scan time</span>
                      </div>
                    </td>
                    <td>
                      <span className={joinClassNames(styles.adminStatusPill, styles.adminStatusApproved)}>
                        <CheckCircle2 size={15} />
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={joinClassNames(
                          styles.checkedInLatePill,
                          row.late ? styles.checkedInLateYes : styles.checkedInLateNo,
                        )}
                      >
                        {row.late ? 'YES' : 'NO'}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!checkedInRowsLoading && !checkedInRows.length ? (
          <div className={styles.adminEmptyState}>
            <strong>No checked-in bookings yet</strong>
            <span>Scanned bookings will appear here with their actual check-in time and late status.</span>
          </div>
        ) : null}
      </div>
    );

    return (
      <>
        <section className={styles.pageNav}>
          <div className={styles.pageNavBrand}>
            <span className={styles.pageNavEyebrow}>Admin Booking Management</span>
            <strong>Approve requests, monitor trends, and validate check-ins</strong>
          </div>
          <div className={styles.adminRolePill}>
            <StatusBadge status={student.role} />
          </div>
        </section>

        <section className={styles.statsGrid}>
          {adminStats.map((stat) => (
            <Card key={stat.label} className={styles.statCard}>
              <span className={styles.statLabel}>{stat.label}</span>
              <strong className={styles.statValue}>{stat.value}</strong>
              <span className={joinClassNames(styles.statGlow, styles[`statGlow${stat.tone}`])} />
            </Card>
          ))}
        </section>

        <Card
          title="Filters"
          subtitle="Refine by date range, status, resource type, capacity, or live search."
          className={styles.filterCard}
        >
          <div className={styles.filterGrid}>
            <SearchBar
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search student or resource"
            />
            <select className={styles.select} value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="NO_SHOW">No Show</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select className={styles.select} value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
              <option value="ALL">All resources</option>
              {resourceTypeOptions.map((type) => (
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

        {dateChangeRequests.length ? (
          <Card
            title="Date Change Requests"
            subtitle="Approved bookings asking to move to a new day. Free windows are checked before admins can unlock the move."
            className={joinClassNames(styles.panelCard, styles.dateChangeRequestCard)}
          >
            <div className={styles.dateChangeRequestList}>
              {dateChangeRequests.map((booking) => {
                const freeWindows = buildDateChangeSlots(
                  bookings.filter((item) => item.id !== booking.id),
                  booking,
                  booking.requestedDate,
                );

                return (
                  <article key={`request-${booking.id}`} className={styles.dateChangeRequestItem}>
                    <div className={styles.dateChangeRequestContent}>
                      <span className={styles.dateChangeRequestEyebrow}>Schedule Move Request</span>
                      <strong>{booking.requesterName} wants to move {booking.facilityName}</strong>
                      <p>
                          {formatDate(booking.date)} {'->'} {formatDate(booking.requestedDate)} | {formatTimeRange(
                            booking.requestedStartTime || booking.startTime,
                            booking.requestedEndTime || booking.endTime,
                          )}
                        </p>
                      <div className={styles.dateChangeWindowList}>
                        {freeWindows.length ? (
                          freeWindows.slice(0, 3).map((window) => (
                            <span key={`${booking.id}-${window.startTime}-${window.endTime}`} className={styles.dateChangeWindowPill}>
                              Free {formatTimeRange(window.startTime, window.endTime)}
                            </span>
                          ))
                        ) : (
                          <span className={styles.dateChangeWindowPillMuted}>No free time on the requested day</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.dateChangeRequestActions}>
                      <Button
                        variant="secondary"
                        onClick={() => handleApproveDateChangePermission(booking)}
                        disabled={!freeWindows.length || (processingBookingId === booking.id && processingAction === 'date-change')}
                      >
                        {processingBookingId === booking.id && processingAction === 'date-change'
                          ? 'Granting...'
                          : 'Allow Date Change'}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        ) : null}

        <div className={styles.adminTabBar}>
          <button
            type="button"
            className={joinClassNames(styles.adminTabButton, adminTab === ADMIN_TABS.ALL && styles.adminTabButtonActive)}
            onClick={() => setAdminTab(ADMIN_TABS.ALL)}
          >
            All Bookings
          </button>
          <button
            type="button"
            className={joinClassNames(styles.adminTabButton, adminTab === ADMIN_TABS.PENDING && styles.adminTabButtonActive)}
            onClick={() => setAdminTab(ADMIN_TABS.PENDING)}
          >
            Pending Requests
          </button>
          <button
            type="button"
            className={joinClassNames(styles.adminTabButton, adminTab === ADMIN_TABS.ANALYTICS && styles.adminTabButtonActive)}
            onClick={() => setAdminTab(ADMIN_TABS.ANALYTICS)}
          >
            Analytics
          </button>
          <button
            type="button"
            className={joinClassNames(styles.adminTabButton, adminTab === ADMIN_TABS.QR && styles.adminTabButtonActive)}
            onClick={() => setAdminTab(ADMIN_TABS.QR)}
          >
            QR Scanner
          </button>
          <button
            type="button"
            className={joinClassNames(styles.adminTabButton, adminTab === ADMIN_TABS.CHECKED_IN && styles.adminTabButtonActive)}
            onClick={() => setAdminTab(ADMIN_TABS.CHECKED_IN)}
          >
            Checked-In
          </button>
        </div>

        {adminTab === ADMIN_TABS.ALL ? (
          <Card
            title="All bookings"
            subtitle="Every request across the campus in one premium management table."
            className={styles.panelCard}
          >
            {renderAdminTable(tableRows)}
          </Card>
        ) : null}

        {adminTab === ADMIN_TABS.PENDING ? (
          <Card
            title="Pending requests"
            subtitle="Highlight active requests and clear the review queue faster."
            className={styles.panelCard}
          >
            {renderAdminTable(tableRows, true)}
          </Card>
        ) : null}

        {adminTab === ADMIN_TABS.ANALYTICS ? (
          <section className={styles.adminAnalyticsGrid}>
            <Card title="Top Resources" subtitle="Most requested resources in the current dataset." className={styles.panelCard}>
              <div className={styles.chartStack}>
                {topResources.map(([resource, count]) => (
                  <div key={resource} className={styles.barRow}>
                    <div className={styles.barLabelRow}>
                      <span>{resource}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${(count / Math.max(1, topResources[0]?.[1] ?? 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Peak Booking Hours" subtitle="Booking request concentration across the day." className={styles.panelCard}>
              <div className={styles.lineChartWrap}>
                <svg viewBox="0 0 360 150" className={styles.lineChart}>
                  <polyline
                    fill="none"
                    stroke="url(#bookingLineGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={linePoints}
                  />
                  <defs>
                    <linearGradient id="bookingLineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#7c8cff" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className={styles.lineChartLabels}>
                  {peakHours.map((point) => (
                    <span key={point.hour}>{point.hour}</span>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Booking Status Distribution" subtitle="Current request mix across the filtered dataset." className={styles.panelCard}>
              <div className={styles.pieChartLayout}>
                <div className={styles.pieChart} style={{ background: `conic-gradient(${pieStops})` }} />
                <div className={styles.pieLegend}>
                  {statusDistribution.map((item) => (
                    <div key={item.status} className={styles.pieLegendItem}>
                      <span className={styles.pieLegendDot} style={{ background: item.tone }} />
                      <div>
                        <strong>{item.status}</strong>
                        <span>{item.value} bookings</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        ) : null}

        {adminTab === ADMIN_TABS.QR ? (
          <Card
            title="QR Scanner"
            subtitle="Validate campus bookings through camera scan, upload, or manual booking ID entry."
            className={styles.panelCard}
          >
            <QRScannerPage onCheckinSuccess={fetchCheckedInAdminRows} />
          </Card>
        ) : null}

        {adminTab === ADMIN_TABS.CHECKED_IN ? (
          <Card
            title="Checked-In Bookings"
            subtitle="See who arrived, when they scanned in, and whether they were late without changing the original booking window."
            className={styles.panelCard}
          >
            {renderCheckedInTable()}
          </Card>
        ) : null}

      </>
    );
  };

  const renderOverviewPanels = () => {
    const approvedDateChanges = upcomingBookings.filter(
      (booking) => booking.dateChangeApproved && !dismissedApprovedChanges.includes(booking.id),
    );

    return (
      <section className={styles.overviewGrid}>
        <Card title="Upcoming bookings" subtitle="Your next campus reservations in a compact card view." className={joinClassNames(styles.panelCard, styles.overviewWideCard)}>
        {approvedDateChanges.length ? (
          <div className={styles.dateChangeSuccessStack}>
            {approvedDateChanges.map((booking) => (
              <div key={`approved-change-${booking.id}`} className={styles.dateChangeSuccessBanner}>
                <div className={styles.dateChangeSuccessContent}>
                  <span className={styles.dateChangeSuccessEyebrow}>Schedule Update Confirmed</span>
                  <strong>Date Change Approved</strong>
                  <p>
                    {booking.facilityName} moved from{' '}
                    {booking.previousDate
                      ? `${formatDate(booking.previousDate)} at ${formatTimeRange(
                          booking.previousStartTime || booking.startTime,
                          booking.previousEndTime || booking.endTime,
                        )}`
                      : 'the previous slot'}{' '}
                    to {formatDate(booking.date)} at {formatTimeRange(booking.startTime, booking.endTime)}.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDismissedApprovedChanges((current) => [...current, booking.id])
                  }
                >
                  OK
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <div className={styles.upcomingCards}>
          {upcomingBookings.map((booking) => (
            <button key={booking.id} type="button" className={styles.upcomingBookingCard} onClick={() => setSelectedBooking(booking)}>
              {(() => {
                const bookingCountMeta = getBookingCountMeta(booking, backendResources);
                const BookingCountIcon = bookingCountMeta.icon;
                const remainingTime = formatRemainingDuration(getBookingEndTimestamp(booking) - currentTime);

                return (
                  <>
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
                  <BookingCountIcon size={15} />
                  {bookingCountMeta.label}
                </span>
              </div>

              {booking.dateChangeApproved ? (
                <div className={styles.upcomingApprovalRow}>
                  <span className={styles.dateChangeApprovedPill}>Date Change Approved</span>
                </div>
              ) : null}
              {booking.checkedIn ? (
                <div className={styles.checkedInTimerCard}>
                  <span className={styles.checkedInTimerEyebrow}>Checked In</span>
                  <strong>Time left: {remainingTime}</strong>
                  <p>
                    Checked in at {formatDateTime(booking.checkedInAt)}. Booking still ends at {booking.endTime}.
                  </p>
                </div>
              ) : null}
                  </>
                );
              })()}
            </button>
          ))}
        </div>
      </Card>

      <SmartSuggestionsCard
        suggestions={liveSmartSuggestions}
        onAction={handleSuggestionAction}
        onViewAll={() => setActiveSection(PAGE_SECTIONS.SUGGESTIONS)}
      />

      <Card title="Notification preview" subtitle="Approvals, rejections, and reminders without leaving the page." className={styles.panelCard}>
        <div className={styles.notificationPreview}>
          {bookingNotificationsPreview.length ? (
            bookingNotificationsPreview.map((notification) => (
              <article key={notification.id} className={styles.notificationRow}>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{formatDateTime(notification.createdAt)}</small>
                </div>
                {!notification.read ? (
                  <button type="button" className={styles.markRead} onClick={() => void markNotificationAsRead(notification.id)}>
                    Mark as read
                  </button>
                ) : (
                  <span className={styles.readState}>Read</span>
                )}
              </article>
            ))
          ) : (
            <span className={styles.readState}>No booking notifications yet.</span>
          )}
        </div>
      </Card>
    </section>
    );
  };

  const renderFilters = () => (
    <Card title="Advanced filters" subtitle="Refine by date range, status, resource type, capacity, and live search." className={styles.filterCard}>
      <div className={styles.filterGrid}>
        <SearchBar value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by resource, purpose, date, or status" />
        <select className={styles.select} value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="NO_SHOW">No Show</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className={styles.select} value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
          <option value="ALL">All resources</option>
          {resourceTypeOptions.map((type) => (
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

  const renderSuggestionsView = () => {
    const spotlightSuggestion = liveSmartSuggestions[0] ?? null;
    const SpotlightIcon = spotlightSuggestion?.icon;
    const suggestionSummary = [
      { label: 'Live suggestions', value: liveSmartSuggestions.length },
      { label: 'Available resources', value: availableSuggestionResources.length },
      { label: 'Upcoming reminders', value: nextUpcomingBooking ? 1 : 0 },
    ];

    return (
      <div className={styles.tabContent}>
        <section className={styles.suggestionsHero}>
          <div className={styles.suggestionsHeroCopy}>
            <span className={styles.pageNavEyebrow}>Smart Suggestions Studio</span>
            <h2>Real-time booking guidance shaped by live campus activity.</h2>
            <p>See the best next slot, discover quieter resources, and spot busy windows before you open the booking form.</p>
          </div>
          <div className={styles.suggestionsHeroStats}>
            {suggestionSummary.map((item) => (
              <div key={item.label} className={styles.suggestionsHeroStat}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        {spotlightSuggestion ? (
          <Card className={styles.suggestionsSpotlightCard}>
            <div className={styles.suggestionsSpotlightShell}>
              <div className={styles.suggestionsSpotlightBadge}>
                {SpotlightIcon ? <SpotlightIcon size={20} /> : null}
              </div>
              <div className={styles.suggestionsSpotlightCopy}>
                <span className={styles.suggestionModalEyebrow}>Top Recommendation</span>
                <h3>{spotlightSuggestion.title}</h3>
                <p>{spotlightSuggestion.description}</p>
              </div>
              <div className={styles.suggestionsSpotlightAction}>
                    {spotlightSuggestion.actionLabel ? (
                      <Button onClick={() => handleSuggestionAction(spotlightSuggestion)}>
                        {spotlightSuggestion.actionLabel}
                  </Button>
                ) : (
                  <span className={styles.suggestionModalMeta}>{spotlightSuggestion.metaLabel}</span>
                )}
              </div>
            </div>
          </Card>
        ) : null}

        <section className={styles.suggestionsSectionGrid}>
          <div className={styles.suggestionsCatalog}>
            {liveSmartSuggestions.map((suggestion) => {
              const SuggestionIcon = suggestion.icon;

              return (
                <article key={suggestion.id} className={joinClassNames(styles.suggestionModalCard, styles[`suggestionModal${suggestion.theme}`], styles.suggestionsSectionCard)}>
                  <div className={styles.suggestionModalTop}>
                    <div className={styles.suggestionModalIcon}>
                      <SuggestionIcon size={18} />
                    </div>
                    <div className={styles.suggestionModalCopy}>
                      <span className={styles.suggestionModalEyebrow}>{suggestion.eyebrow}</span>
                      <strong>{suggestion.title}</strong>
                      <p>{suggestion.description}</p>
                    </div>
                  </div>

                  <div className={styles.suggestionModalActionRow}>
                    {suggestion.actionLabel ? (
                      <Button size="sm" onClick={() => handleSuggestionAction(suggestion)}>
                        {suggestion.actionLabel}
                      </Button>
                    ) : (
                      <span className={styles.suggestionModalMeta}>{suggestion.metaLabel}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className={styles.suggestionsInsightColumn}>
            {extendedSmartSuggestions.slice(liveSmartSuggestions.length).map((suggestion) => {
              const SuggestionIcon = suggestion.icon;

              return (
                <article key={suggestion.id} className={joinClassNames(styles.suggestionModalCard, styles[`suggestionModal${suggestion.theme}`], styles.suggestionsSectionCard)}>
                  <div className={styles.suggestionModalTop}>
                    <div className={styles.suggestionModalIcon}>
                      <SuggestionIcon size={18} />
                    </div>
                    <div className={styles.suggestionModalCopy}>
                      <span className={styles.suggestionModalEyebrow}>{suggestion.eyebrow}</span>
                      <strong>{suggestion.title}</strong>
                      <p>{suggestion.description}</p>
                    </div>
                  </div>

                  <div className={styles.suggestionModalActionRow}>
                    {suggestion.actionLabel ? (
                      <Button size="sm" onClick={() => handleSuggestionAction(suggestion)}>
                        {suggestion.actionLabel}
                      </Button>
                    ) : (
                      <span className={styles.suggestionModalMeta}>{suggestion.metaLabel}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </aside>
        </section>
      </div>
    );
  };

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
                          <div
                            key={booking.id}
                            draggable={!['REJECTED', 'CANCELLED'].includes(booking.status)}
                            onDragStart={(event) => handleBookingDragStart(event, booking)}
                            className={joinClassNames(
                              getBookingBlockStyle(booking),
                              styles.monthBookingBlock,
                              !getBookingDragState(booking).canDrag && styles.bookingBlockLocked,
                            )}
                            onClick={() => setSelectedBooking(booking)}
                            title={getBookingDragState(booking).message || 'Drag to change date'}
                          >
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
                          <div
                            key={booking.id}
                            draggable={!['REJECTED', 'CANCELLED'].includes(booking.status)}
                            onDragStart={(event) => handleBookingDragStart(event, booking)}
                            className={joinClassNames(
                              getBookingBlockStyle(booking),
                              styles.weeklyBookingBlock,
                              !getBookingDragState(booking).canDrag && styles.bookingBlockLocked,
                            )}
                            onClick={() => setSelectedBooking(booking)}
                            title={getBookingDragState(booking).message || 'Drag to change date'}
                          >
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
    const createResources = (backendResources.length ? backendResources : []).filter(isUserVisibleResource);
    const minimumBookingDate = getTodayDateKey();
    const selectedFacility =
      createResources.find((facility) => facility.id === form.facilityId) ??
      mockFacilities.find((facility) => facility.id === form.facilityId);
    const selectedFacilityIsEquipment = isEquipmentResource(selectedFacility);
    const selectedFacilityReservedUnits = selectedFacilityIsEquipment
      ? getOverlappingBookedQuantity(bookings, form.facilityId, form.date, form.startTime, form.endTime)
      : 0;
    const selectedFacilityAvailableUnits = selectedFacilityIsEquipment
      ? Math.max(0, Number(selectedFacility?.capacity ?? 0) - selectedFacilityReservedUnits)
      : null;
    const isReleasedSlotLocked =
      Boolean(releasedSlotPrefill) &&
      form.facilityId === releasedSlotPrefill?.facilityId &&
      form.date === releasedSlotPrefill?.date;
    const availableStartTimeSlots = isReleasedSlotLocked
      ? [releasedSlotPrefill.startTime]
      : getCreateBookingStartTimeSlots(
          bookings,
          selectedFacility,
          form.date,
          form.attendees,
        );
    const createDurationLabel = isReleasedSlotLocked
      ? `${getDurationHours(form.startTime, form.endTime)} hours`
      : '2 hours';
    const submitMessageIsError = /could not|backend error|failed|unexpected/i.test(submitMessage);

    const renderCreateBookingForm = () => (
      <div className={styles.createBookingView}>
        <div className={styles.createBookingHeader}>
          <div>
            <h2>Create New Booking</h2>
            <p>
              {isReleasedSlotLocked
                ? 'This reopened no-show slot is locked to the exact released time window.'
                : 'Reserve campus resources for your needs.'}
            </p>
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
                  {createResources
                    .map((facility) => (
                      <option
                        key={facility.id}
                        value={facility.id}
                        disabled={String(facility.status ?? '').toUpperCase() !== 'AVAILABLE'}
                      >
                        {facility.name} {facility.status ? `(${facility.status})` : ''}
                      </option>
                    ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span>Date</span>
                <input
                  type="date"
                  name="date"
                  min={minimumBookingDate}
                  className={styles.createInput}
                  value={form.date}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <div className={styles.createBookingSplit}>
                <label className={styles.formField}>
                  <span>Start Time</span>
                  <div className={styles.startTimeSlotGroup}>
                    {availableStartTimeSlots.length ? (
                      availableStartTimeSlots.map((timeSlot) => (
                        <button
                          key={timeSlot}
                          type="button"
                          className={joinClassNames(
                            styles.startTimeSlotButton,
                            form.startTime === timeSlot && styles.startTimeSlotButtonActive,
                          )}
                          onClick={() => handleStartTimeSlotChange(timeSlot)}
                        >
                          {timeSlot}
                        </button>
                      ))
                    ) : (
                      <span className={styles.dateChangeWindowPillMuted}>No 2-hour slots available on this day</span>
                    )}
                  </div>
                  <small className={styles.fieldHint}>
                    {isReleasedSlotLocked
                      ? `Released slot locked: ${formatTimeRange(form.startTime, form.endTime)}`
                      : 'Test slots enabled: use `03:18` or today-only `15:20` if you need to verify the QR check-in flow right now.'}
                  </small>
                </label>

                <label className={styles.formField}>
                  <span>Duration</span>
                  <input type="text" className={styles.createInput} value={createDurationLabel} readOnly />
                </label>
              </div>

              <div className={styles.createBookingSplit}>
                <label className={styles.formField}>
                  <span>{selectedFacilityIsEquipment ? 'Quantity' : 'Attendees'}</span>
                  <input
                    type="number"
                    name="attendees"
                    min="1"
                    max={selectedFacility?.capacity ?? undefined}
                    className={styles.createInput}
                    value={form.attendees}
                    onChange={handleFormChange}
                    placeholder={selectedFacilityIsEquipment ? 'Enter quantity needed' : 'Enter attendee count'}
                    required
                  />
                  {selectedFacility?.capacity ? (
                    <small className={styles.fieldHint}>
                      {selectedFacilityIsEquipment
                        ? `Available quantity: ${selectedFacilityAvailableUnits} of ${selectedFacility.capacity} units`
                        : `Capacity limit: ${selectedFacility.capacity} attendees`}
                    </small>
                  ) : null}
                  {selectedFacility && getResourceAvailabilityValidationMessage(selectedFacility) ? (
                    <small className={styles.fieldHint}>{getResourceAvailabilityValidationMessage(selectedFacility)}</small>
                  ) : null}
                </label>

                <label className={styles.formField}>
                  <span>Place</span>
                  <input
                    type="text"
                    className={styles.createInput}
                    value={selectedFacility?.location ?? ''}
                    placeholder="Select a resource to see the location"
                    readOnly
                  />
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

              {submitMessage ? (
                <p
                  className={joinClassNames(
                    styles.submitMessage,
                    submitMessageIsError ? styles.submitMessageError : styles.submitMessageSuccess,
                  )}
                >
                  {submitMessage}
                </p>
              ) : null}

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
                    <li>{selectedFacilityIsEquipment ? 'Add the exact quantity you need before submitting.' : 'Match the attendee count to the room capacity.'}</li>
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

    const getBookingMeta = (booking) => {
      const facility = getFacilityDetails(booking, backendResources);
      const bookingCountMeta = getBookingCountMeta(booking, backendResources);
      const location = facility?.location ?? 'Campus resource hub';
      return {
        resource: booking.facilityName,
        date: formatDate(booking.date),
        time: formatTimeRange(booking.startTime, booking.endTime),
        countLabel: bookingCountMeta.label,
        countIcon: bookingCountMeta.icon,
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
            const BookingMetaIcon = meta.countIcon;
            const remainingTime = formatRemainingDuration(getBookingEndTimestamp(booking) - currentTime);

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
                      <BookingMetaIcon size={16} />
                      <span>{meta.countLabel}</span>
                    </div>
                  </div>

                  <div className={styles.bookingTimelineInline}>
                    <span className={joinClassNames(styles.timelineStateDot, booking.status === 'APPROVED' ? styles.timelineApproved : booking.status === 'PENDING' ? styles.timelinePending : styles.timelineRejected)} />
                    <span>
                      {booking.status === 'APPROVED' ? 'Created -> Pending -> Approved' : booking.status === 'PENDING' ? 'Created -> Pending (Awaiting approval)' : 'Created -> Pending -> Rejected'}
                    </span>
                  </div>

                  {booking.checkedIn ? (
                    <div className={styles.checkedInTimerCard}>
                      <span className={styles.checkedInTimerEyebrow}>Checked In</span>
                      <strong>Time left: {remainingTime}</strong>
                      <p>
                        Checked in at {formatDateTime(booking.checkedInAt)}. Booking ends at {booking.endTime}.
                      </p>
                    </div>
                  ) : null}
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
                  {['PENDING', 'APPROVED', 'REJECTED'].includes(booking.status) ? (
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => handleCancelBooking(booking.id)}
                      aria-label={booking.status === 'REJECTED' ? 'Delete booking' : 'Cancel booking'}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
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
      ) : isAdmin ? (
        renderAdminView()
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
          {activeSection === PAGE_SECTIONS.SUGGESTIONS ? renderSuggestionsView() : null}
        </>
      )}

      <Modal
        isOpen={Boolean(isAdmin && selectedBooking?.status === 'PENDING')}
        onClose={() => {
          setSelectedBooking(null);
          setRejectReason('');
          setReviewMode('approve');
        }}
        title={reviewMode === 'approve' ? 'Approve Booking' : 'Reject Booking'}
        description={selectedBooking ? `Booking: ${selectedBooking.purpose}` : ''}
        footer={
          isAdmin && selectedBooking?.status === 'PENDING' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedBooking(null);
                  setRejectReason('');
                  setReviewMode('approve');
                }}
              >
                Cancel
              </Button>
              <Button
                variant={reviewMode === 'approve' ? 'success' : 'danger'}
                onClick={reviewMode === 'approve' ? handleApproveSubmit : handleRejectSubmit}
                disabled={
                  processingBookingId === selectedBooking.id &&
                  processingAction === (reviewMode === 'approve' ? 'approve' : 'reject')
                    ? true
                    : reviewMode === 'reject' && !rejectReason.trim()
                }
              >
                {processingBookingId === selectedBooking.id &&
                processingAction === (reviewMode === 'approve' ? 'approve' : 'reject')
                  ? reviewMode === 'approve'
                    ? 'Confirming...'
                    : 'Rejecting...'
                  : reviewMode === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </Button>
            </>
          ) : null
        }
      >
        {isAdmin && selectedBooking?.status === 'PENDING' ? (
          <div className={styles.reviewModalBody}>
            <div className={styles.reviewModeSwitch}>
              <button
                type="button"
                className={joinClassNames(styles.reviewModeButton, reviewMode === 'approve' && styles.reviewModeApproveActive)}
                onClick={() => setReviewMode('approve')}
              >
                <CheckCircle2 size={18} />
                Approve
              </button>
              <button
                type="button"
                className={joinClassNames(styles.reviewModeButton, reviewMode === 'reject' && styles.reviewModeRejectActive)}
                onClick={() => setReviewMode('reject')}
              >
                <XCircle size={18} />
                Reject
              </button>
            </div>

            {reviewMode === 'reject' ? (
              <textarea
                className={styles.reviewReasonInput}
                rows="5"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Enter reason for rejection (e.g., time conflict, facility unavailable)..."
                required
              />
            ) : null}

            <div
              className={joinClassNames(
                styles.reviewNotice,
                reviewMode === 'approve' ? styles.reviewNoticeApprove : styles.reviewNoticeReject,
              )}
            >
              {reviewMode === 'approve'
                ? 'This booking will be approved and the student will be notified.'
                : 'The student will receive the rejection reason via email.'}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(selectedBooking && (!isAdmin || selectedBooking.status !== 'PENDING'))}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.facilityName}
        description="Booking details"
        footer={
          selectedBooking ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedBooking(null)}>Close</Button>
              {selectedBooking.status === 'APPROVED' ? <Button icon={QrCode} onClick={() => setQrBooking(selectedBooking)}>View QR Code</Button> : null}
              {selectedBooking.status === 'APPROVED' ? (
                <Button
                  variant="secondary"
                  onClick={() => openDateChangeRequestModal(selectedBooking)}
                  disabled={selectedBooking.dateChangeRequested || selectedBooking.dateChangeApproved}
                >
                  {selectedBooking.dateChangeApproved
                    ? 'Date Change Approved'
                    : selectedBooking.dateChangeRequested
                      ? 'Permission Requested'
                      : 'Request Date Change'}
                </Button>
              ) : null}
              <Button variant="secondary" icon={PencilLine} onClick={() => openEditBooking(selectedBooking)}>Edit Booking</Button>
              {['PENDING', 'APPROVED', 'REJECTED'].includes(selectedBooking.status) ? (
                <Button variant="danger" onClick={() => handleCancelBooking(selectedBooking.id)}>
                  {selectedBooking.status === 'REJECTED' ? 'Delete Booking' : 'Cancel Booking'}
                </Button>
              ) : null}
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
                <p>{getBookingCountMeta(selectedBooking, backendResources).label}</p>
              </div>
              <div>
                <label>Description</label>
                <p>{mockFacilities.find((item) => item.id === selectedBooking.facilityId)?.description ?? selectedBooking.purpose}</p>
              </div>
            </div>
            <div className={styles.detailSummary}>
              <small>Last update: {formatDateTime(`${selectedBooking.date}T${selectedBooking.startTime}`)}</small>
              {selectedBooking.status === 'APPROVED' && !selectedBooking.dateChangeApproved ? (
                <small className={styles.dateChangeHint}>
                  {selectedBooking.dateChangeRequested
                    ? 'Date change permission is waiting for admin approval.'
                    : 'Approved bookings need admin permission before the calendar date can be changed.'}
                </small>
              ) : null}
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

      <Modal
        isOpen={Boolean(editingBooking)}
        onClose={() => {
          setEditingBooking(null);
          setEditForm(initialForm);
        }}
        title={editingBooking ? `Refine ${editingBooking.facilityName}` : 'Edit Booking'}
        description="Update the key booking details in a cleaner, faster editing workspace."
        footer={
          editingBooking ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingBooking(null);
                  setEditForm(initialForm);
                }}
              >
                Close
              </Button>
              <Button onClick={handleSaveBookingEdit} disabled={isSavingEdit} icon={Sparkles}>
                {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </>
          ) : null
        }
      >
        {editingBooking ? (
          <div className={styles.editBookingModal}>
            {(() => {
              const editFacility =
                backendResources.find((resource) => resource.id === editForm.facilityId) ??
                mockFacilities.find((resource) => resource.id === editForm.facilityId);
              const editFacilityIsEquipment = isEquipmentResource(editFacility);
              const minimumEditBookingDate = getTodayDateKey();
              const editFacilityReservedUnits = editFacilityIsEquipment
                ? getOverlappingBookedQuantity(
                    bookings,
                    editForm.facilityId,
                    editForm.date,
                    editForm.startTime,
                    editForm.endTime,
                    editingBooking.id,
                  )
                : 0;
              const editFacilityAvailableUnits = editFacilityIsEquipment
                ? Math.max(0, Number(editFacility?.capacity ?? 0) - editFacilityReservedUnits)
                : null;
              const availableEditStartTimeSlots = getAvailableStartTimeSlots(
                bookings,
                editFacility,
                editForm.date,
                editForm.attendees,
                editingBooking.id,
              );

              return (
                <>
                  <div className={styles.editBookingHero}>
                    <div>
                      <span className={styles.editBookingEyebrow}>Booking Refresh</span>
                      <h3>{editingBooking.facilityName}</h3>
                      <p>Polish the request before it moves through the next step of the campus workflow.</p>
                    </div>
                    <div className={styles.editBookingHighlights}>
                      <span>{editingBooking.status}</span>
                      <span>{formatDate(editingBooking.date)}</span>
                      <span>{formatTimeRange(editingBooking.startTime, editingBooking.endTime)}</span>
                    </div>
                  </div>

                  <div className={styles.editBookingLayout}>
                    <div className={styles.editBookingPanel}>
                      <label className={styles.formField}>
                        <span>Resource</span>
                        <select
                          name="facilityId"
                          className={styles.createSelect}
                          value={editForm.facilityId}
                          onChange={handleEditFormChange}
                          required
                        >
                          <option value="">Choose a resource...</option>
                          {backendResources.filter(isUserVisibleResource).map((facility) => (
                            <option
                              key={facility.id}
                              value={facility.id}
                              disabled={String(facility.status ?? '').toUpperCase() !== 'AVAILABLE'}
                            >
                              {facility.name} {facility.status ? `(${facility.status})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className={styles.createBookingSplit}>
                        <label className={styles.formField}>
                          <span>Date</span>
                          <input
                            type="date"
                            name="date"
                            min={minimumEditBookingDate}
                            className={styles.createInput}
                            value={editForm.date}
                            onChange={handleEditFormChange}
                            required
                          />
                        </label>

                        <label className={styles.formField}>
                          <span>{editFacilityIsEquipment ? 'Quantity' : 'Attendees'}</span>
                          <input
                            type="number"
                            min="1"
                            max={editFacility?.capacity ?? undefined}
                            name="attendees"
                            className={styles.createInput}
                            value={editForm.attendees}
                            onChange={handleEditFormChange}
                            placeholder={editFacilityIsEquipment ? 'Enter quantity needed' : 'Enter attendee count'}
                            required
                          />
                          {editFacility?.capacity ? (
                            <small className={styles.fieldHint}>
                              {editFacilityIsEquipment
                                ? `Available quantity: ${editFacilityAvailableUnits} of ${editFacility?.capacity} units`
                                : `Capacity limit: ${editFacility?.capacity} attendees`}
                            </small>
                          ) : null}
                          {editFacility && getResourceAvailabilityValidationMessage(editFacility) ? (
                            <small className={styles.fieldHint}>
                              {getResourceAvailabilityValidationMessage(editFacility)}
                            </small>
                          ) : null}
                        </label>
                      </div>

                      <div className={styles.createBookingSplit}>
                        <label className={styles.formField}>
                          <span>Start Time</span>
                          <div className={styles.startTimeSlotGroup}>
                            {availableEditStartTimeSlots.length ? (
                              availableEditStartTimeSlots.map((timeSlot) => (
                                <button
                                  key={timeSlot}
                                  type="button"
                                  className={joinClassNames(
                                    styles.startTimeSlotButton,
                                    editForm.startTime === timeSlot && styles.startTimeSlotButtonActive,
                                  )}
                                  onClick={() => handleEditStartTimeSlotChange(timeSlot)}
                                >
                                  {timeSlot}
                                </button>
                              ))
                            ) : (
                              <span className={styles.dateChangeWindowPillMuted}>No 2-hour slots available on this day</span>
                            )}
                          </div>
                        </label>

                        <label className={styles.formField}>
                          <span>Duration</span>
                          <input type="text" className={styles.createInput} value="2 hours" readOnly />
                        </label>
                      </div>

                      <label className={styles.formField}>
                        <span>Purpose</span>
                        <textarea
                          name="purpose"
                          className={styles.createTextarea}
                          value={editForm.purpose}
                          onChange={handleEditFormChange}
                          placeholder="Refine your request, special setup needs, or session context..."
                        />
                      </label>
                    </div>

                    <aside className={styles.editBookingSidebar}>
                      <Card className={styles.editBookingSidebarCard}>
                        <span className={styles.editBookingSidebarLabel}>Sharp Edit Tips</span>
                        <ul className={styles.editBookingTips}>
                          <li>Keep the purpose short and specific for faster review.</li>
                          <li>{editFacilityIsEquipment ? 'Request only the quantity you actually need.' : 'Match the attendee count to the actual room need.'}</li>
                          <li>Update timings realistically to avoid approval delays.</li>
                        </ul>
                      </Card>

                      <Card className={styles.editBookingSidebarCard}>
                        <span className={styles.editBookingSidebarLabel}>Live Preview</span>
                        <div className={styles.editBookingPreview}>
                          <strong>{editFacility?.name ?? 'Select a resource'}</strong>
                          <span>{formatDate(editForm.date)}</span>
                          <span>{formatTimeRange(editForm.startTime, editForm.endTime)}</span>
                          <span>{editForm.attendees || '0'} {editFacilityIsEquipment ? 'units' : 'attendees'}</span>
                        </div>
                      </Card>
                    </aside>
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(dateChangeRequestBooking)}
        onClose={() => {
          setDateChangeRequestBooking(null);
          setRequestedDate('');
          setRequestedTimeWindow('');
        }}
        title={dateChangeRequestBooking ? `Request Date Change for ${dateChangeRequestBooking.facilityName}` : 'Request Date Change'}
        description="Pick a preferred new day and one of the open time windows. Already-booked times are not shown."
        footer={
          dateChangeRequestBooking ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDateChangeRequestBooking(null);
                  setRequestedDate('');
                  setRequestedTimeWindow('');
                }}
              >
                Close
              </Button>
              <Button onClick={handleSubmitDateChangeRequest} disabled={!requestedDate || !requestedTimeWindow || isSubmittingDateRequest}>
                {isSubmittingDateRequest ? 'Sending Request...' : 'Send Request'}
              </Button>
            </>
          ) : null
        }
      >
        {dateChangeRequestBooking ? (
          <div className={styles.dateChangeRequestModal}>
            <div className={styles.dateChangeRequestHero}>
              <div>
                <span className={styles.dateChangeRequestEyebrow}>Admin Approval Required</span>
                <h3>{dateChangeRequestBooking.facilityName}</h3>
                <p>
                  Current booking: {formatDate(dateChangeRequestBooking.date)} | {formatTimeRange(dateChangeRequestBooking.startTime, dateChangeRequestBooking.endTime)}
                </p>
              </div>
            </div>

            <label className={styles.formField}>
              <span>Requested New Date</span>
              <input
                type="date"
                className={styles.createInput}
                value={requestedDate}
                min={dateChangeRequestBooking.date}
                onChange={(event) => {
                  setRequestedDate(event.target.value);
                  setRequestedTimeWindow('');
                }}
              />
            </label>

            {requestedDate ? (
              <div className={styles.dateChangeAvailability}>
                <strong>Free time on {formatDate(requestedDate)}</strong>
                <div className={styles.dateChangeWindowList}>
                  {buildDateChangeSlots(
                    bookings.filter((booking) => booking.id !== dateChangeRequestBooking.id),
                    dateChangeRequestBooking,
                    requestedDate,
                  ).length ? (
                    buildDateChangeSlots(
                      bookings.filter((booking) => booking.id !== dateChangeRequestBooking.id),
                      dateChangeRequestBooking,
                      requestedDate,
                    )
                      .slice(0, 4)
                      .map((window) => (
                        <button
                          key={`${requestedDate}-${window.startTime}-${window.endTime}`}
                          type="button"
                          className={joinClassNames(
                            styles.dateChangeWindowButton,
                            requestedTimeWindow === getTimeWindowValue(window) && styles.dateChangeWindowButtonActive,
                          )}
                          onClick={() => setRequestedTimeWindow(getTimeWindowValue(window))}
                        >
                          {formatTimeRange(window.startTime, window.endTime)}
                        </button>
                      ))
                  ) : (
                    <span className={styles.dateChangeWindowPillMuted}>No free time available on this day</span>
                  )}
                </div>
              </div>
            ) : null}
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
