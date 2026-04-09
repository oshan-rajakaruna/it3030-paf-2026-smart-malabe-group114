import { CalendarRange, ClipboardList, Eye, PlusCircle } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import styles from './BookingsPage.module.css';
import fieldStyles from '../components/ui/Field.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import FilterPanel from '../components/ui/FilterPanel';
import FormField from '../components/ui/FormField';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import SelectField from '../components/ui/SelectField';
import StatusBadge from '../components/ui/StatusBadge';
import TextAreaField from '../components/ui/TextAreaField';
import { mockBookings } from '../data/bookings';
import { mockFacilities } from '../data/facilities';
import { useAuth } from '../hooks/useAuth';
import { BOOKING_STATUS_OPTIONS, ROLES } from '../utils/constants';
import { formatDate } from '../utils/formatters';

const initialForm = {
  facilityId: '',
  date: '',
  startTime: '',
  endTime: '',
  purpose: '',
  attendees: '',
};

export default function BookingsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const [bookings, setBookings] = useState(mockBookings);
  const [form, setForm] = useState(initialForm);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [submitMessage, setSubmitMessage] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());

  const visibleBookings = bookings.filter((booking) => {
    const isVisibleToRole = isAdmin || currentUser.role === ROLES.TECHNICIAN || booking.requesterId === currentUser.id;
    const matchesStatus = statusFilter === 'ALL' || booking.status === statusFilter;
    const matchesSearch =
      !deferredQuery ||
      [booking.facilityName, booking.requesterName, booking.purpose].join(' ').toLowerCase().includes(deferredQuery);

    return isVisibleToRole && matchesStatus && matchesSearch;
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const facility = mockFacilities.find((item) => item.id === form.facilityId);
    if (!facility) {
      return;
    }

    const nextBooking = {
      id: `bk-demo-${Date.now()}`,
      facilityId: facility.id,
      facilityName: facility.name,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      attendees: Number(form.attendees || 0),
      purpose: form.purpose,
      status: 'PENDING',
      adminNote: 'Mock request captured. Awaiting backend approval workflow.',
    };

    setBookings((current) => [nextBooking, ...current]);
    setForm(initialForm);
    setSubmitMessage('Mock booking request added to the table as a pending record.');
  };

  const bookingColumns = [
    {
      key: 'purpose',
      header: 'Booking',
      render: (booking) => (
        <div className={styles.primaryCell}>
          <strong>{booking.purpose}</strong>
          <span>{booking.requesterName}</span>
        </div>
      ),
    },
    {
      key: 'facilityName',
      header: 'Facility',
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (booking) => `${formatDate(booking.date)} · ${booking.startTime} - ${booking.endTime}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <StatusBadge status={booking.status} />,
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (booking) => (
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => setSelectedBooking(booking)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Booking Management"
        title="Request and review bookings"
        description="The form is mock-driven for now, but structured to map directly to a future booking request DTO and approval workflow."
        actions={<Button icon={PlusCircle}>New workflow placeholder</Button>}
      />

      <section className={styles.topGrid}>
        <Card title="Booking request form" subtitle="Capture realistic booking details before backend integration.">
          <form className={styles.formGrid} onSubmit={handleSubmit}>
            <SelectField
              id="facilityId"
              label="Facility or asset"
              name="facilityId"
              value={form.facilityId}
              onChange={handleInputChange}
              options={mockFacilities.map((facility) => ({ value: facility.id, label: facility.name }))}
              placeholder="Select a resource"
            />

            <FormField id="date" label="Booking date">
              <input id="date" name="date" type="date" className={fieldStyles.control} value={form.date} onChange={handleInputChange} required />
            </FormField>

            <FormField id="startTime" label="Start time">
              <input id="startTime" name="startTime" type="time" className={fieldStyles.control} value={form.startTime} onChange={handleInputChange} required />
            </FormField>

            <FormField id="endTime" label="End time">
              <input id="endTime" name="endTime" type="time" className={fieldStyles.control} value={form.endTime} onChange={handleInputChange} required />
            </FormField>

            <FormField id="attendees" label="Expected attendees">
              <input
                id="attendees"
                name="attendees"
                type="number"
                min="1"
                className={fieldStyles.control}
                value={form.attendees}
                onChange={handleInputChange}
                placeholder="e.g. 45"
              />
            </FormField>

            <TextAreaField
              id="purpose"
              label="Purpose"
              name="purpose"
              value={form.purpose}
              onChange={handleInputChange}
              hint="Explain why the resource is needed so this maps well to admin review later."
            />

            <Button type="submit" icon={CalendarRange}>
              Submit booking request
            </Button>

            {submitMessage ? <p className={styles.submitMessage}>{submitMessage}</p> : null}
          </form>
        </Card>

        <Card title="Approval flow preview" subtitle="This right-side panel helps during demos and future backend alignment.">
          <div className={styles.previewList}>
            <div className={styles.previewItem}>
              <strong>PENDING</strong>
              <span>Awaiting admin review with conflict validation and reason capture.</span>
            </div>
            <div className={styles.previewItem}>
              <strong>APPROVED / REJECTED</strong>
              <span>Admin decisions can later trigger notifications and audit logs.</span>
            </div>
            <div className={styles.previewItem}>
              <strong>CANCELLED</strong>
              <span>Approved bookings can be cancelled after approval based on updated plans.</span>
            </div>
          </div>
        </Card>
      </section>

      <FilterPanel title="Booking queue" description="Filter by status or search by facility, requester, or purpose.">
        <div className={styles.filterGrid}>
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search bookings..."
          />
          <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {BOOKING_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      <Card title="Booking list" subtitle={isAdmin ? 'Admin view shows all requests.' : 'Role-aware table shows your visible requests.'}>
        <DataTable
          columns={bookingColumns}
          rows={visibleBookings}
          emptyState={{
            icon: ClipboardList,
            title: 'No bookings to show',
            description: 'Try changing the filters or submit a mock request using the form above.',
          }}
        />
      </Card>

      <Modal
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.facilityName}
        description="Booking detail side-panel placeholder rendered as a modal for now."
        footer={
          selectedBooking ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedBooking(null)}>
                Close
              </Button>
              {isAdmin ? <Button>Approve / Reject placeholder</Button> : null}
            </>
          ) : null
        }
      >
        {selectedBooking ? (
          <div className={styles.modalGrid}>
            <div className={styles.modalBlock}>
              <span>Status</span>
              <StatusBadge status={selectedBooking.status} />
            </div>
            <div className={styles.modalBlock}>
              <span>Schedule</span>
              <strong>
                {formatDate(selectedBooking.date)} · {selectedBooking.startTime} - {selectedBooking.endTime}
              </strong>
            </div>
            <div className={styles.modalBlock}>
              <span>Requester</span>
              <strong>{selectedBooking.requesterName}</strong>
            </div>
            <div className={styles.modalBlock}>
              <span>Attendees</span>
              <strong>{selectedBooking.attendees}</strong>
            </div>
            <div className={styles.modalBlock}>
              <span>Purpose</span>
              <p>{selectedBooking.purpose}</p>
            </div>
            <div className={styles.modalBlock}>
              <span>Admin note</span>
              <p>{selectedBooking.adminNote}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
