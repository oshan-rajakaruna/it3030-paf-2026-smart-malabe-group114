import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock3,
  MessageSquareText,
  ShieldAlert,
  Trash2,
  UserRoundCog,
  Wrench,
} from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';

import styles from './TicketsPage.module.css';
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
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import TextAreaField from '../components/ui/TextAreaField';
import { useAuth } from '../hooks/useAuth';
import {
  addComment,
  assignTechnician,
  createTicket,
  deleteTicket,
  getAllTickets,
  getAttachments,
  getComments,
  updateTicketResolution,
  updateTicketStatus,
  uploadAttachment,
} from '../services/ticketService';
import { PRIORITY_OPTIONS, ROLES, TICKET_STATUS_OPTIONS } from '../utils/constants';
import { formatDateTime } from '../utils/formatters';
import { getResources } from '../services/resourceService';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
const USERS_API_URL = `${BACKEND_URL}/api/users`;

const initialForm = {
  title: '',
  resourceName: '',
  category: '',
  priority: 'Medium',
  preferredContact: '',
  description: '',
  attachments: [],
};

const CATEGORY_OPTIONS = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'FACILITY', label: 'Facility' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITY_MAP = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function mapTicketToUi(ticket, technicianLookup = {}) {
  const assignedTechnician = ticket.assignedTechnician ?? '';
  const technicianName = technicianLookup[assignedTechnician]?.name ?? assignedTechnician ?? 'Unassigned';

  return {
    id: ticket.id ?? ticket._id,
    title: ticket.title ?? 'Untitled ticket',
    description: ticket.description ?? 'No description provided.',
    location: ticket.location ?? 'Campus',
    priority: ticket.priority ?? 'Medium',
    status: ticket.status ?? 'OPEN',
    assigned: technicianName || 'Unassigned',
    updated: ticket.updatedAt ?? '',
    resourceName: ticket.location ?? 'Campus',
    category: ticket.category ?? 'General',
    reporterId: ticket.createdBy ?? '',
    reporterName: ticket.createdBy ?? 'Unknown user',
    technicianId: assignedTechnician,
    technicianName: technicianName || 'Unassigned',
    createdAt: ticket.createdAt ?? '',
    updatedAt: ticket.updatedAt ?? '',
    preferredContact: 'Not provided',
    resolution: ticket.resolutionNotes ?? 'No resolution note yet.',
    rejectionReason: ticket.rejectionReason ?? '',
    comments: [],
  };
}

function formatStatusLabel(status) {
  return String(status || 'OPEN')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPriorityLabel(priority) {
  return String(priority || 'MEDIUM')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isWhitespaceOnly(value) {
  return !String(value || '').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^[+\d][\d\s\-()]{6,}$/.test(value);
}

function validateAttachmentFiles(files = []) {
  if (files.length > MAX_ATTACHMENTS) {
    return `You can upload up to ${MAX_ATTACHMENTS} images only.`;
  }

  for (const file of files) {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return 'Only JPG, PNG, or WEBP images are allowed.';
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return 'Each image must be smaller than 5 MB.';
    }
  }

  return '';
}

function validateCreateTicketForm(form, { isAdmin }) {
  const errors = {};
  const trimmedTitle = String(form.title || '').trim();
  const trimmedContact = String(form.preferredContact || '').trim();
  const trimmedDescription = String(form.description || '').trim();

  if (isWhitespaceOnly(form.title)) {
    errors.title = 'Please enter a ticket title.';
  } else if (trimmedTitle.length < 5) {
    errors.title = 'Title must be at least 5 characters long.';
  } else if (trimmedTitle.length > 120) {
    errors.title = 'Title must be 120 characters or fewer.';
  }

  if (!form.resourceName) {
    errors.resourceName = 'Please select a resource or location.';
  }

  if (!form.category) {
    errors.category = 'Please choose a category.';
  }

  if (!form.priority) {
    errors.priority = 'Please choose a priority.';
  }

  if (!trimmedContact && !isAdmin) {
    errors.preferredContact = 'Please enter an email address or phone number for updates.';
  } else if (trimmedContact && !isValidEmail(trimmedContact) && !isValidPhone(trimmedContact)) {
    errors.preferredContact = 'Please enter a valid email address or phone number.';
  }

  if (isWhitespaceOnly(form.description)) {
    errors.description = 'Please describe the incident.';
  } else if (trimmedDescription.length > 1500) {
    errors.description = 'Description must be 1500 characters or fewer.';
  }

  if (
    trimmedTitle
    && trimmedDescription
    && trimmedTitle.toLowerCase() === trimmedDescription.toLowerCase()
  ) {
    errors.description = 'Description should add more detail instead of repeating the title.';
  }

  const attachmentError = validateAttachmentFiles(form.attachments);
  if (attachmentError) {
    errors.attachments = attachmentError;
  }

  return errors;
}

export default function TicketsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isTechnician = currentUser.role === ROLES.TECHNICIAN;
  const isUser = currentUser.role === ROLES.USER;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalTechnician, setModalTechnician] = useState('');
  const [modalResolution, setModalResolution] = useState('');
  const [modalRejectionReason, setModalRejectionReason] = useState('');
  const [modalActionMessage, setModalActionMessage] = useState('');
  const [modalActionError, setModalActionError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deletingTicketId, setDeletingTicketId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [submitMessage, setSubmitMessage] = useState('');
  const [resources, setResources] = useState([]);
  const [resourceOptions, setResourceOptions] = useState([]);
  const [technicianOptions, setTechnicianOptions] = useState([]);
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());

  function buildTechnicianLookup(options = technicianOptions) {
    return Object.fromEntries(
      options.map((technician) => [
        technician.value,
        { name: technician.label },
      ]),
    );
  }

  async function loadTickets(technicianLookup = buildTechnicianLookup()) {
    setLoading(true);
    setError('');

    try {
      const response = await getAllTickets();
      console.log(response);
      const mappedTickets = response.map((ticket) => mapTicketToUi(ticket, technicianLookup));
      setTickets(mappedTickets);
      return mappedTickets;
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load tickets.');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadTicketPageData() {
      try {
        const [resourcesResponse, usersResponse] = await Promise.all([
          getResources(),
          fetch(USERS_API_URL),
        ]);

        if (!usersResponse.ok) {
          throw new Error(`Failed to load users (${usersResponse.status})`);
        }

        const users = await usersResponse.json();
        const approvedTechnicians = users
          .filter((user) => user.role === ROLES.TECHNICIAN)
          .filter((user) => !user.status || user.status === 'APPROVED')
          .map((user) => ({
            value: user.id,
            label: user.name || user.email || user.id,
          }));

        const technicianLookup = buildTechnicianLookup(approvedTechnicians);

        const resources = Array.isArray(resourcesResponse) ? resourcesResponse : [];
        setResources(resources);
        setResourceOptions(
          resources.map((resource) => ({
            value: resource.id,
            label: resource.name || resource.resourceCode || resource.location || 'Unnamed resource',
          })),
        );
        setTechnicianOptions(approvedTechnicians);

        await loadTickets(technicianLookup);
      } catch (loadError) {
        setError(loadError.message || 'Failed to load ticket page data.');
      }
    }

    void loadTicketPageData();
  }, []);

  useEffect(() => {
    if (!selectedTicket) {
      setModalStatus('');
      setModalTechnician('');
      setModalResolution('');
      setModalRejectionReason('');
      setModalActionMessage('');
      setModalActionError('');
      setComments([]);
      setNewComment('');
      setCommentsLoading(false);
      setCommentsError('');
      setAttachments([]);
      setSelectedFile(null);
      return;
    }

    async function loadComments() {
      setCommentsLoading(true);
      setCommentsError('');

      try {
        const response = await getComments(selectedTicket.id);
        setComments(response);
        setNewComment('');
      } catch (fetchError) {
        console.error('Failed to load comments:', fetchError);
        setCommentsError(fetchError.message || 'Failed to load comments.');
      } finally {
        setCommentsLoading(false);
      }
    }

    async function loadAttachments() {
      try {
        const response = await getAttachments(selectedTicket.id);
        setAttachments(response);
      } catch (fetchError) {
        console.error('Failed to load attachments:', fetchError);
      }
    }

    setModalStatus(selectedTicket.status || 'OPEN');
    setModalTechnician(selectedTicket.technicianId || selectedTicket.assigned || '');
    setModalResolution(selectedTicket.resolution === 'No resolution note yet.' ? '' : selectedTicket.resolution || '');
    setModalRejectionReason(selectedTicket.rejectionReason || '');
    setModalActionMessage('');
    setModalActionError('');
    loadComments();
    loadAttachments();
  }, [selectedTicket]);

  const visibleTickets = tickets.filter((ticket) => {
    const isOwnedByCurrentUser =
      ticket.reporterId === currentUser.id || ticket.reporterId === currentUser.name || ticket.reporterName === currentUser.name;

    const isAssignedToCurrentTechnician =
      ticket.technicianId === currentUser.id || ticket.technicianId === currentUser.name || ticket.technicianName === currentUser.name;

    const matchesRole =
      currentUser.role === ROLES.ADMIN ||
      (currentUser.role === ROLES.TECHNICIAN && isAssignedToCurrentTechnician) ||
      (currentUser.role === ROLES.USER && isOwnedByCurrentUser);

    const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
    const matchesQuery =
      !deferredQuery ||
      [ticket.title, ticket.resourceName, ticket.category, ticket.technicianName].join(' ').toLowerCase().includes(deferredQuery);

    return matchesRole && matchesStatus && matchesQuery;
  });

  const assignedCount = visibleTickets.length;
  const openCount = visibleTickets.filter((ticket) => ticket.status === 'OPEN').length;
  const inProgressCount = visibleTickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
  const closedCount = visibleTickets.filter((ticket) => ticket.status === 'CLOSED').length;
  const unassignedCount = visibleTickets.filter((ticket) => !ticket.technicianId && ticket.technicianName === 'Unassigned').length;
  const activeFilterLabel = statusFilter === 'ALL' ? 'All statuses' : formatStatusLabel(statusFilter);
  const roleQueueSummary = isAdmin
    ? 'Full incident queue across the campus.'
    : isTechnician
      ? 'Only incidents assigned to you are shown here.'
      : 'Only tickets you reported are shown here.';

  const stats = [
    {
      label: isAdmin ? 'Queue volume' : isTechnician ? 'Assigned queue' : 'My incidents',
      value: assignedCount,
      meta: roleQueueSummary,
      icon: ClipboardList,
      tone: 'primary',
    },
    {
      label: 'Open tickets',
      value: openCount,
      meta: 'New issues waiting for action',
      icon: ShieldAlert,
      tone: 'warning',
    },
    {
      label: 'In progress',
      value: inProgressCount,
      meta: 'Work currently moving through resolution',
      icon: Clock3,
      tone: 'secondary',
    },
    {
      label: isAdmin ? 'Unassigned' : 'Closed tickets',
      value: isAdmin ? unassignedCount : closedCount,
      meta: isAdmin ? 'Tickets that still need an owner' : 'Completed incidents in this view',
      icon: isAdmin ? CircleDashed : CheckCircle2,
      tone: isAdmin ? 'warning' : 'success',
    },
  ];

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleAttachmentChange = (event) => {
    const selectedAttachments = Array.from(event.target.files || []);
    const trimmedAttachments = selectedAttachments.slice(0, MAX_ATTACHMENTS);
    const attachmentError = validateAttachmentFiles(trimmedAttachments);

    setForm((current) => ({
      ...current,
      attachments: trimmedAttachments,
    }));
    setFormErrors((current) => {
      const nextErrors = { ...current };
      if (attachmentError) {
        nextErrors.attachments = attachmentError;
      } else {
        delete nextErrors.attachments;
      }
      return nextErrors;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSubmitMessage('');
    const nextFormErrors = validateCreateTicketForm(form, { isAdmin });
    setFormErrors(nextFormErrors);

    if (Object.keys(nextFormErrors).length) {
      return;
    }

    const normalizedCategory = form.category || 'OTHER';
    const normalizedPriority = PRIORITY_MAP[form.priority.trim().toLowerCase()] ?? 'MEDIUM';
    const selectedResource = resources.find((resource) => resource.id === form.resourceName);
    const location =
      selectedResource?.location
      || selectedResource?.name
      || selectedResource?.resourceCode
      || 'Campus';
    const payload = {
      title: form.title.trim() || 'General incident reported',
      description: form.description,
      location,
      category: normalizedCategory,
      priority: normalizedPriority,
      createdBy: currentUser?.id || currentUser?.name || 'user1',
      preferredContact: form.preferredContact.trim(),
    };

    try {
      const response = await createTicket(payload);
      console.log('Ticket created successfully:', response);

      if (form.attachments.length) {
        for (const file of form.attachments) {
          try {
            await uploadAttachment(response.id, file);
          } catch (attachmentError) {
            console.error(`Failed to upload attachment: ${file.name}`, attachmentError);
          }
        }
      }

      await loadTickets();
      setForm(initialForm);
      setFormErrors({});
      setSubmitMessage('Ticket created successfully.');
    } catch (submitError) {
      console.error('Failed to create ticket:', submitError);
      setError(submitError.message || 'Failed to create ticket.');
    }
  };

  const handleModalWorkflowUpdate = async () => {
    if (!selectedTicket) {
      return;
    }

    setModalActionMessage('');
    setModalActionError('');

    try {
      if (modalStatus === 'REJECTED' && !modalRejectionReason.trim()) {
        setModalActionError('Please provide a rejection reason before marking this ticket as rejected.');
        return;
      }

      await updateTicketStatus(
        selectedTicket.id,
        modalStatus,
        modalStatus === 'REJECTED' ? modalRejectionReason.trim() : '',
      );
      if (!isTechnician) {
        await assignTechnician(selectedTicket.id, modalTechnician);
      }
      await updateTicketResolution(selectedTicket.id, modalResolution);

      const updatedTickets = await loadTickets();
      const updatedSelectedTicket = updatedTickets.find((ticket) => ticket.id === selectedTicket.id);

      if (updatedSelectedTicket) {
        setSelectedTicket(updatedSelectedTicket);
      }

      setModalActionMessage('Ticket workflow updated successfully.');
      setSelectedTicket(null);
    } catch (workflowError) {
      console.error('Failed to update ticket workflow:', workflowError);
      setModalActionError(workflowError.message || 'Failed to update ticket workflow.');
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) {
      return;
    }

    setCommentsError('');

    try {
      await addComment(selectedTicket.id, {
        userId: currentUser?.id || currentUser?.name || 'admin1',
        commentText: newComment,
      });

      const response = await getComments(selectedTicket.id);
      setComments(response);
      setNewComment('');
    } catch (commentError) {
      console.error('Failed to add comment:', commentError);
      setCommentsError(commentError.message || 'Failed to add comment.');
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedTicket || !selectedFile) {
      return;
    }

    try {
      await uploadAttachment(selectedTicket.id, selectedFile);
      const response = await getAttachments(selectedTicket.id);
      setAttachments(response);
      setSelectedFile(null);
    } catch (attachmentError) {
      console.error('Failed to upload attachment:', attachmentError);
    }
  };

  const handleDeleteTicket = async (ticket) => {
    if (!isAdmin || !ticket?.id) {
      return;
    }

    const confirmed = window.confirm(`Delete ticket "${ticket.title || ticket.id}"? This will also remove its comments and attachments.`);
    if (!confirmed) {
      return;
    }

    setDeletingTicketId(ticket.id);
    setError('');
    setSubmitMessage('');

    try {
      await deleteTicket(ticket.id);
      await loadTickets();
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
      }
      setSubmitMessage('Ticket deleted successfully.');
    } catch (deleteError) {
      console.error('Failed to delete ticket:', deleteError);
      setError(deleteError.message || 'Failed to delete ticket.');
    } finally {
      setDeletingTicketId('');
    }
  };

  const formErrorMessages = Object.values(formErrors);

  const ticketColumns = [
    {
      key: 'title',
      header: 'Ticket',
      render: (ticket) => (
        <div className={styles.primaryCell}>
          <strong>{ticket.title}</strong>
          <span>{ticket.resourceName}</span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
    },
    {
      key: 'technician',
      header: 'Assigned',
      render: (ticket) => ticket.technicianName,
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (ticket) => formatDateTime(ticket.updatedAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ticket) => (
        <div className={styles.statusCell}>
          <StatusBadge status={ticket.status} />
          {ticket.status === 'REJECTED' && ticket.rejectionReason ? (
            <span className={styles.rejectionReasonText}>Reason: {ticket.rejectionReason}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (ticket) => (
        <div className={styles.tableActions}>
          <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(ticket)}>
            View ticket
          </Button>
          {isAdmin ? (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => void handleDeleteTicket(ticket)}
              disabled={deletingTicketId === ticket.id}
            >
              {deletingTicketId === ticket.id ? 'Deleting...' : 'Delete'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const createTicketSection = (
    <Card
      className={styles.featureCard}
      title="Create incident ticket"
      subtitle={
        isAdmin
          ? 'Admins can still raise tickets here, but the main focus of this page is queue management.'
          : 'Keep the form realistic so mapping to the API stays straightforward.'
      }
    >
      <div className={styles.cardHero}>
        <span className={styles.cardEyebrow}>Incident intake</span>
        <p className={styles.cardLead}>
          Capture the issue clearly so comments, attachments, technician updates, and status changes all stay attached to one clean ticket flow.
        </p>
      </div>
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <div className={styles.formSplit}>
          <FormField id="title" label="Incident title">
            <input
              id="title"
              type="text"
              name="title"
              className={fieldStyles.control}
              value={form.title}
              onChange={handleInputChange}
              placeholder="e.g. WiFi not working"
              aria-invalid={Boolean(formErrors.title)}
            />
          </FormField>
          <SelectField
            id="resourceName"
            label="Resource or location"
            name="resourceName"
            value={form.resourceName}
            onChange={handleInputChange}
            options={resourceOptions}
            placeholder="Select a resource"
            aria-invalid={Boolean(formErrors.resourceName)}
          />
          <SelectField
            id="category"
            label="Category"
            name="category"
            value={form.category}
            onChange={handleInputChange}
            options={CATEGORY_OPTIONS}
            placeholder="Select a category"
            aria-invalid={Boolean(formErrors.category)}
          />
          <SelectField
            id="priority"
            label="Priority"
            name="priority"
            value={form.priority}
            onChange={handleInputChange}
            options={PRIORITY_OPTIONS}
            aria-invalid={Boolean(formErrors.priority)}
          />
          <FormField id="preferredContact" label="Preferred contact">
            <input
              id="preferredContact"
              name="preferredContact"
              className={fieldStyles.control}
              value={form.preferredContact}
              onChange={handleInputChange}
              placeholder="Phone or email for updates"
              aria-invalid={Boolean(formErrors.preferredContact)}
            />
          </FormField>
          <div className={styles.formHintCard}>
            <strong>Submission checklist</strong>
            <span>Give a clear title, choose the right resource, set the urgency, and add enough detail for faster technician triage.</span>
          </div>
        </div>
        <TextAreaField
          id="description"
          label="Incident description"
          name="description"
          value={form.description}
          onChange={handleInputChange}
          hint="Future enhancement: attach up to 3 evidence images after backend storage is ready."
          aria-invalid={Boolean(formErrors.description)}
        />
        <FormField id="attachments" label="Image attachments" hint="You can select up to 3 images for this incident.">
          <input
            id="attachments"
            type="file"
            accept="image/*"
            multiple
            className={fieldStyles.control}
            onChange={handleAttachmentChange}
            aria-invalid={Boolean(formErrors.attachments)}
          />
        </FormField>
        {formErrorMessages.length ? (
          <div className={styles.validationSummary} role="alert">
            <strong>Please fix the following before submitting:</strong>
            {formErrorMessages.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}
        {form.attachments.length ? (
          <div className={styles.attachmentPreviewList}>
            {form.attachments.slice(0, 3).map((file) => (
              <div key={`${file.name}-${file.lastModified}`} className={styles.attachmentPreviewItem}>
                <strong>{file.name}</strong>
                <span>Ready to upload after ticket creation</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className={styles.formActions}>
          <Button type="submit" icon={Wrench}>
            Submit ticket
          </Button>
          {submitMessage ? (
            <div className={styles.inlineNotice} data-type="success">
              <CheckCircle2 size={18} />
              <span>{submitMessage}</span>
            </div>
          ) : null}
        </div>
      </form>
    </Card>
  );

  const workflowPanelSection = (
    <Card
      className={styles.featureCard}
      title={isTechnician ? 'Assigned work focus' : 'Workflow guide'}
      subtitle={
        isAdmin
          ? 'Admin workflow helper and queue management tools.'
          : isTechnician
            ? 'Track your assigned incidents and progress updates.'
            : 'Understanding ticket lifecycle and status progression.'
      }
    >
      <div className={styles.cardHero}>
        <span className={styles.cardEyebrow}>{isTechnician ? 'Execution view' : 'Shared workflow'}</span>
        <p className={styles.cardLead}>
          Streamlined incident management with clear status tracking and technician coordination.
        </p>
      </div>
      <div className={styles.sidePanelList}>
        <div className={styles.sidePanelItem}>
          <strong>Workflow guide</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ 
              padding: '2px 8px', 
              backgroundColor: 'var(--primary)', 
              color: 'white', 
              borderRadius: '4px', 
              fontSize: '12px',
              fontWeight: '500'
            }}>OPEN</span>
            <span style={{ fontSize: '14px' }}>→</span>
            <span style={{ 
              padding: '2px 8px', 
              backgroundColor: 'var(--warning)', 
              color: 'white', 
              borderRadius: '4px', 
              fontSize: '12px',
              fontWeight: '500'
            }}>IN_PROGRESS</span>
            <span style={{ fontSize: '14px' }}>→</span>
            <span style={{ 
              padding: '2px 8px', 
              backgroundColor: 'var(--success)', 
              color: 'white', 
              borderRadius: '4px', 
              fontSize: '12px',
              fontWeight: '500'
            }}>RESOLVED</span>
            <span style={{ fontSize: '14px' }}>→</span>
            <span style={{ 
              padding: '2px 8px', 
              backgroundColor: 'var(--text-muted)', 
              color: 'white', 
              borderRadius: '4px', 
              fontSize: '12px',
              fontWeight: '500'
            }}>CLOSED</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-soft)', marginTop: '4px' }}>
            REJECTED is available for admin-only exception handling.
          </div>
        </div>
        
        {isAdmin ? (
          <>
            <div className={styles.sidePanelItem}>
              <strong>Admin responsibilities</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Review new incidents</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Assign technician</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Monitor progress</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Confirm resolution</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Close or reject when needed</span>
              </div>
            </div>
          </>
        ) : null}
        
        <div className={styles.sidePanelItem}>
          <strong>Queue focus</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Prioritize high-priority tickets</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Review unassigned tickets first</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>• Use comments and attachments as evidence</span>
          </div>
        </div>
      </div>
    </Card>
  );

  const queueSection = (
    <>
      <section className={styles.statsGrid}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <FilterPanel
        title={isAdmin ? 'Management queue' : isTechnician ? 'Assigned ticket queue' : 'Incident queue'}
        description={
          isAdmin
            ? 'Admins can scan, filter, and manage the full incident backlog from this primary queue.'
            : isTechnician
              ? 'Filter your actionable tickets to focus on progress and next steps.'
              : 'Role-aware filtering keeps the page useful for users, technicians, and admins.'
        }
      >
        <div className={styles.filterGrid}>
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tickets..."
          />
          <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {TICKET_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      <Card
        className={styles.queueCard}
        title={isAdmin ? 'Ticket management table' : isTechnician ? 'Assigned tickets' : 'Ticket list'}
        subtitle={
          isAdmin
            ? 'This table is the primary workspace for reviewing ticket status, technician ownership, and operational flow.'
            : isTechnician
              ? 'Your assigned incidents stay at the center of the page so progress is easier to track.'
            : 'Comments, assignment, and future evidence previews can all branch from this shared table row.'
        }
      >
        <div className={styles.resultsHeader}>
          <div className={styles.resultsSummary}>
            <strong>{loading ? 'Loading incidents...' : `${visibleTickets.length} tickets visible`}</strong>
            <span>
              {loading
                ? 'Syncing the latest ticket data from the backend.'
                : `${roleQueueSummary} Active filter: ${activeFilterLabel}.`}
            </span>
          </div>
          <div className={styles.resultsChips}>
            <span className={styles.resultChip}>Open {openCount}</span>
            <span className={styles.resultChip}>In progress {inProgressCount}</span>
            <span className={styles.resultChip}>Closed {closedCount}</span>
          </div>
        </div>
        {loading ? <p className={styles.infoText}>Loading tickets...</p> : null}
        {error ? (
          <div className={styles.inlineNotice} data-type="error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}
        {!loading && !error ? (
          <DataTable
            columns={ticketColumns}
            rows={visibleTickets}
            emptyState={{
              icon: MessageSquareText,
              title: 'No tickets to show',
              description: 'Try adjusting the filter or submit a new incident from the form above.',
            }}
          />
        ) : null}
      </Card>
    </>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Maintenance & Incident Tickets"
        title={
          isAdmin
            ? 'Manage and triage campus incidents'
            : isTechnician
              ? 'Track and progress assigned maintenance work'
              : 'Report, assign, and track maintenance issues'
        }
        description={
          isAdmin
            ? 'The admin view prioritizes the full ticket queue first, while still keeping incident creation available as a secondary action.'
            : isTechnician
              ? 'The technician view keeps assigned work and workflow progress in focus without changing the shared page structure.'
              : 'The user view keeps incident reporting first, with your visible tickets listed below in the same shared workflow.'
        }
      />

      {submitMessage && !isUser ? (
        <div className={styles.feedbackBanner} data-type="success" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>{submitMessage}</span>
        </div>
      ) : null}

      {error && !loading ? (
        <div className={styles.feedbackBanner} data-type="error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      {isAdmin || isTechnician ? queueSection : null}

      <section className={styles.topGrid}>
        {isAdmin || isTechnician ? workflowPanelSection : createTicketSection}
        {!isTechnician ? (isAdmin ? createTicketSection : workflowPanelSection) : null}
      </section>

      {!isAdmin && !isTechnician ? queueSection : null}

      <Modal
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.title}
        description="Ticket details"
        footer={
          selectedTicket ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                Close
              </Button>
              {isAdmin ? (
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => void handleDeleteTicket(selectedTicket)}
                  disabled={deletingTicketId === selectedTicket.id}
                >
                  {deletingTicketId === selectedTicket.id ? 'Deleting...' : 'Delete ticket'}
                </Button>
              ) : null}
              {!isUser ? <Button onClick={handleModalWorkflowUpdate}>Update workflow</Button> : null}
            </>
          ) : null
        }
      >
        {selectedTicket ? (
          <div className={styles.modalStack}>
            <section className={styles.modalHero}>
              <div className={styles.modalHeroCopy}>
                <span className={styles.cardEyebrow}>Ticket overview</span>
                <strong>{selectedTicket.title || 'Untitled ticket'}</strong>
                <p>{selectedTicket.description || 'No description provided.'}</p>
              </div>
              <div className={styles.modalHeroMeta}>
                <StatusBadge status={selectedTicket.status || 'OPEN'} />
                <span className={styles.priorityChip}>{formatPriorityLabel(selectedTicket.priority)}</span>
              </div>
            </section>

            <div className={styles.modalFactsGrid}>
              <div className={styles.modalBlock}>
                <span>Location</span>
                <strong>{selectedTicket.location || 'Not provided'}</strong>
              </div>
              <div className={styles.modalBlock}>
                <span>Created by</span>
                <strong>{selectedTicket.reporterName || selectedTicket.reporterId || 'Not provided'}</strong>
              </div>
              <div className={styles.modalBlock}>
                <span>Created at</span>
                <strong>{selectedTicket.createdAt ? formatDateTime(selectedTicket.createdAt) : 'Not provided'}</strong>
              </div>
              <div className={styles.modalBlock}>
                <span>Updated at</span>
                <strong>{selectedTicket.updatedAt ? formatDateTime(selectedTicket.updatedAt) : 'Not provided'}</strong>
              </div>
            </div>

            <div className={styles.modalLayout}>
              <div className={styles.modalMainColumn}>
                <div className={styles.commentsPanel}>
                  <div className={styles.commentsHeader}>
                    <strong>Resolution</strong>
                    <UserRoundCog size={18} />
                  </div>
                  {isUser ? (
                    <p>{selectedTicket.resolution || 'No resolution note yet.'}</p>
                  ) : (
                    <TextAreaField
                      id="modalResolution"
                      label="Resolution note"
                      name="modalResolution"
                      rows={4}
                      value={modalResolution}
                      onChange={(event) => setModalResolution(event.target.value)}
                      hint="Add or update the current resolution note for this ticket."
                    />
                  )}
                </div>

                <div className={styles.commentsPanel}>
                  <div className={styles.commentsHeader}>
                    <strong>Comments and evidence</strong>
                    <UserRoundCog size={18} />
                  </div>
                  {commentsLoading ? <p className={styles.infoText}>Loading comments...</p> : null}
                  {commentsError ? (
                    <div className={styles.inlineNotice} data-type="error">
                      <AlertCircle size={18} />
                      <span>{commentsError}</span>
                    </div>
                  ) : null}
                  {!commentsLoading && !commentsError ? (
                    comments.length ? (
                      comments.map((comment) => (
                        <article key={comment.id} className={styles.comment}>
                          <strong>{comment.userId || 'Unknown user'}</strong>
                          <span>{comment.createdAt ? formatDateTime(comment.createdAt) : 'Not provided'}</span>
                          <p>{comment.commentText || 'Not provided'}</p>
                        </article>
                      ))
                    ) : (
                      <p className={styles.emptyComment}>No comments yet for this ticket.</p>
                    )
                  ) : null}
                  <TextAreaField
                    id="newComment"
                    label="Add comment"
                    name="newComment"
                    rows={3}
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    hint="Add a short update or note for this ticket."
                  />
                  <div className={styles.formActions}>
                    <Button variant="secondary" onClick={handleAddComment}>
                      Add Comment
                    </Button>
                  </div>
                  {!isUser ? (
                    <div className={styles.uploadPanel}>
                      <FormField id="attachmentUpload" label="Upload attachment">
                        <input
                          id="attachmentUpload"
                          type="file"
                          className={fieldStyles.control}
                          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                        />
                      </FormField>
                      <Button variant="secondary" onClick={handleUploadAttachment}>
                        Upload
                      </Button>
                    </div>
                  ) : null}
                  <div className={styles.attachmentList}>
                    {attachments.length ? (
                      attachments.map((attachment) => (
                        <article key={attachment.id} className={styles.attachmentItem}>
                          <strong>{attachment.fileName || 'Unnamed file'}</strong>
                          <a href={`http://localhost:8080/${attachment.filePath}`} target="_blank" rel="noreferrer">
                            View attachment
                          </a>
                        </article>
                      ))
                    ) : (
                      <p className={styles.emptyComment}>No attachments yet for this ticket.</p>
                    )}
                  </div>
                </div>
              </div>

              <aside className={styles.modalSideColumn}>
                <div className={styles.modalBlock}>
                  <span>Status</span>
                  {isUser ? (
                    <StatusBadge status={selectedTicket.status || 'OPEN'} />
                  ) : (
                    <select className={styles.select} value={modalStatus} onChange={(event) => setModalStatus(event.target.value)}>
                      {TICKET_STATUS_OPTIONS.filter((status) => status !== 'ALL').map((status) => (
                        <option key={status} value={status}>
                          {status.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.modalBlock}>
                  <span>Assigned technician</span>
                  {isUser || isTechnician ? (
                    <strong>{selectedTicket.technicianName || selectedTicket.assigned || 'Unassigned'}</strong>
                  ) : (
                    <select className={styles.select} value={modalTechnician} onChange={(event) => setModalTechnician(event.target.value)}>
                      <option value="">Unassigned</option>
                      {technicianOptions.map((technician) => (
                        <option key={technician.value} value={technician.value}>
                          {technician.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.modalBlock}>
                  <span>Priority</span>
                  <strong>{formatPriorityLabel(selectedTicket.priority)}</strong>
                </div>
                <div className={styles.modalBlock}>
                  <span>Category</span>
                  <strong>{selectedTicket.category || 'Not provided'}</strong>
                </div>
                {selectedTicket.status === 'REJECTED' || modalStatus === 'REJECTED' ? (
                  <div className={styles.modalBlock}>
                    <span>Rejection reason</span>
                    {isUser ? (
                      <strong>{selectedTicket.rejectionReason || 'Not provided'}</strong>
                    ) : (
                      <TextAreaField
                        id="modalRejectionReason"
                        label="Rejection reason"
                        name="modalRejectionReason"
                        rows={4}
                        value={modalRejectionReason}
                        onChange={(event) => setModalRejectionReason(event.target.value)}
                        hint="Explain clearly why this ticket is being rejected."
                      />
                    )}
                  </div>
                ) : null}
                {modalActionMessage ? (
                  <div className={styles.inlineNotice} data-type="success">
                    <CheckCircle2 size={18} />
                    <span>{modalActionMessage}</span>
                  </div>
                ) : null}
                {modalActionError ? (
                  <div className={styles.inlineNotice} data-type="error">
                    <AlertCircle size={18} />
                    <span>{modalActionError}</span>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
