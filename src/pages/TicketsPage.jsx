import { MessageSquareText, PlusCircle, UserRoundCog, Wrench } from 'lucide-react';
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
import StatusBadge from '../components/ui/StatusBadge';
import TextAreaField from '../components/ui/TextAreaField';
import { mockFacilities } from '../data/facilities';
import { mockUsers } from '../data/users';
import { useAuth } from '../hooks/useAuth';
import {
  addComment,
  assignTechnician,
  createTicket,
  getAllTickets,
  getAttachments,
  getComments,
  updateTicketResolution,
  updateTicketStatus,
  uploadAttachment,
} from '../services/ticketService';
import { PRIORITY_OPTIONS, ROLES, TICKET_STATUS_OPTIONS } from '../utils/constants';
import { formatDateTime } from '../utils/formatters';

const initialForm = {
  title: '',
  resourceName: '',
  category: '',
  priority: 'Medium',
  preferredContact: '',
  description: '',
  attachments: [],
};

const CATEGORY_MAP = {
  electrical: 'ELECTRICAL',
  network: 'NETWORK',
  equipment: 'EQUIPMENT',
  facility: 'FACILITY',
  other: 'OTHER',
};

const PRIORITY_MAP = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

function mapTicketToUi(ticket) {
  return {
    id: ticket.id ?? ticket._id,
    title: ticket.title ?? 'Untitled ticket',
    description: ticket.description ?? 'No description provided.',
    location: ticket.location ?? 'Campus',
    priority: ticket.priority ?? 'Medium',
    status: ticket.status ?? 'OPEN',
    assigned: ticket.assignedTechnician ?? 'Unassigned',
    updated: ticket.updatedAt ?? '',
    resourceName: ticket.location ?? 'Campus',
    category: ticket.category ?? 'General',
    reporterId: ticket.createdBy ?? '',
    reporterName: ticket.createdBy ?? 'Unknown user',
    technicianId: ticket.assignedTechnician ?? '',
    technicianName: ticket.assignedTechnician ?? 'Unassigned',
    createdAt: ticket.createdAt ?? '',
    updatedAt: ticket.updatedAt ?? '',
    preferredContact: 'Not provided',
    resolution: ticket.resolutionNotes ?? 'No resolution note yet.',
    comments: [],
  };
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
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalTechnician, setModalTechnician] = useState('');
  const [modalResolution, setModalResolution] = useState('');
  const [modalActionMessage, setModalActionMessage] = useState('');
  const [modalActionError, setModalActionError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [submitMessage, setSubmitMessage] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());
  const technicianOptions = mockUsers.filter((user) => user.role === ROLES.TECHNICIAN);

  async function loadTickets() {
    setLoading(true);
    setError('');

    try {
      const response = await getAllTickets();
      console.log(response);
      const mappedTickets = response.map(mapTicketToUi);
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
    loadTickets();
  }, []);

  useEffect(() => {
    if (!selectedTicket) {
      setModalStatus('');
      setModalTechnician('');
      setModalResolution('');
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
  const inProgressCount = visibleTickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
  const closedCount = visibleTickets.filter((ticket) => ticket.status === 'CLOSED').length;

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleAttachmentChange = (event) => {
    const selectedAttachments = Array.from(event.target.files || []);

    if (selectedAttachments.length > 3) {
      alert('You can upload a maximum of 3 images.');
    }

    setForm((current) => ({
      ...current,
      attachments: selectedAttachments.slice(0, 3),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSubmitMessage('');

    const normalizedCategory = CATEGORY_MAP[form.category.trim().toLowerCase()] ?? 'OTHER';
    const normalizedPriority = PRIORITY_MAP[form.priority.trim().toLowerCase()] ?? 'MEDIUM';
    const location = (mockFacilities.find((facility) => facility.name === form.resourceName)?.location ?? form.resourceName) || 'Campus';
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
      await updateTicketStatus(selectedTicket.id, modalStatus);
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
      render: (ticket) => <StatusBadge status={ticket.status} />,
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (ticket) => (
        <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(ticket)}>
          View ticket
        </Button>
      ),
    },
  ];

  const createTicketSection = (
    <Card
      title="Create incident ticket"
      subtitle={
        isAdmin
          ? 'Admins can still raise tickets here, but the main focus of this page is queue management.'
          : 'Keep the form realistic so mapping to the API stays straightforward.'
      }
    >
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <FormField id="title" label="Incident title">
          <input
            id="title"
            type="text"
            name="title"
            className={fieldStyles.control}
            value={form.title}
            onChange={handleInputChange}
            placeholder="e.g. WiFi not working"
          />
        </FormField>
        <SelectField
          id="resourceName"
          label="Resource or location"
          name="resourceName"
          value={form.resourceName}
          onChange={handleInputChange}
          options={mockFacilities.map((facility) => facility.name)}
          placeholder="Select a resource"
        />
        <FormField id="category" label="Category">
          <input
            id="category"
            name="category"
            className={fieldStyles.control}
            value={form.category}
            onChange={handleInputChange}
            placeholder="e.g. HVAC, AV Equipment, Access Control"
          />
        </FormField>
        <SelectField
          id="priority"
          label="Priority"
          name="priority"
          value={form.priority}
          onChange={handleInputChange}
          options={PRIORITY_OPTIONS}
        />
        <FormField id="preferredContact" label="Preferred contact">
          <input
            id="preferredContact"
            name="preferredContact"
            className={fieldStyles.control}
            value={form.preferredContact}
            onChange={handleInputChange}
            placeholder="Phone or email for updates"
          />
        </FormField>
        <TextAreaField
          id="description"
          label="Incident description"
          name="description"
          value={form.description}
          onChange={handleInputChange}
          hint="Future enhancement: attach up to 3 evidence images after backend storage is ready."
        />
        <FormField id="attachments" label="Image attachments" hint="You can select up to 3 images for this incident.">
          <input
            id="attachments"
            type="file"
            accept="image/*"
            multiple
            className={fieldStyles.control}
            onChange={handleAttachmentChange}
          />
        </FormField>
        {form.attachments.length ? (
          <div className={styles.sidePanelList}>
            {form.attachments.slice(0, 3).map((file) => (
              <div key={`${file.name}-${file.lastModified}`} className={styles.sidePanelItem}>
                <strong>{file.name}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <Button type="submit" icon={Wrench}>
          Submit ticket
        </Button>
        {submitMessage ? <p className={styles.submitMessage}>{submitMessage}</p> : null}
      </form>
    </Card>
  );

  const workflowPanelSection = (
    <Card
      title={isTechnician ? 'Assigned work focus' : 'Technician assignment placeholder'}
      subtitle={
        isAdmin
          ? 'Management actions, status flow, and technician assignment stay visible beside the queue.'
          : isTechnician
            ? 'This panel keeps current technician workflow priorities visible while backend actions grow over time.'
            : 'The UI already reserves a clean space for assignment and SLA workflows.'
      }
    >
      <div className={styles.sidePanelList}>
        {isTechnician ? (
          <>
            <div className={styles.sidePanelItem}>
              <strong>Assigned tickets</strong>
              <span>{assignedCount}</span>
            </div>
            <div className={styles.sidePanelItem}>
              <strong>In progress</strong>
              <span>{inProgressCount}</span>
            </div>
            <div className={styles.sidePanelItem}>
              <strong>Closed</strong>
              <span>{closedCount}</span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.sidePanelItem}>
              <strong>{isAdmin ? 'Assignment' : 'Ticket workflow'}</strong>
              <span>
                {isAdmin
                  ? 'Admin can assign technicians based on issue type, urgency, and availability.'
                  : 'OPEN - IN_PROGRESS - RESOLVED - CLOSED. Admin may also mark a ticket as REJECTED when required.'}
              </span>
            </div>
            <div className={styles.sidePanelItem}>
              <strong>{isAdmin ? 'Status progression' : 'What happens after submission'}</strong>
              <span>
                {isAdmin
                  ? 'OPEN - IN_PROGRESS - RESOLVED - CLOSED, with REJECTED available when necessary.'
                  : 'Your ticket will be reviewed and may be assigned to a technician. You can track progress from your ticket list and ticket details.'}
              </span>
            </div>
            <div className={styles.sidePanelItem}>
              <strong>{isAdmin ? 'Queue oversight' : 'Evidence and comments'}</strong>
              <span>
                {isAdmin
                  ? 'Review ticket priority, ownership, and progress from the management queue.'
                  : 'You can upload up to 3 images when reporting an issue. Comments and attachments can be viewed from ticket details.'}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );

  const queueSection = (
    <>
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
        title={isAdmin ? 'Ticket management table' : isTechnician ? 'Assigned tickets' : 'Ticket list'}
        subtitle={
          isAdmin
            ? 'This table is the primary workspace for reviewing ticket status, technician ownership, and operational flow.'
            : isTechnician
              ? 'Your assigned incidents stay at the center of the page so progress is easier to track.'
              : 'Comments, assignment, and future evidence previews can all branch from this shared table row.'
        }
      >
        {loading ? <p>Loading tickets...</p> : null}
        {error ? <p>{error}</p> : null}
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
        actions={!isTechnician ? <Button icon={PlusCircle}>Create incident flow</Button> : null}
      />

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
              {!isUser ? <Button onClick={handleModalWorkflowUpdate}>Update workflow</Button> : null}
            </>
          ) : null
        }
      >
        {selectedTicket ? (
          <div className={styles.modalGrid}>
            <div className={styles.modalBlock}>
              <span>Title</span>
              <strong>{selectedTicket.title || 'Not provided'}</strong>
            </div>
            <div className={styles.modalBlock}>
              <span>Description</span>
              <p>{selectedTicket.description || 'Not provided'}</p>
            </div>
            <div className={styles.modalBlock}>
              <span>Location</span>
              <strong>{selectedTicket.location || 'Not provided'}</strong>
            </div>
            <div className={styles.modalBlock}>
              <span>Priority</span>
              <strong>{selectedTicket.priority || 'Not provided'}</strong>
            </div>
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
                    <option key={technician.id} value={technician.id}>
                      {technician.name}
                    </option>
                  ))}
                </select>
              )}
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
              {commentsLoading ? <p>Loading comments...</p> : null}
              {commentsError ? <p>{commentsError}</p> : null}
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
              <Button variant="secondary" onClick={handleAddComment}>
                Add Comment
              </Button>
              {!isUser ? (
                <>
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
                </>
              ) : null}
              {attachments.length ? (
                attachments.map((attachment) => (
                  <article key={attachment.id} className={styles.comment}>
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
            {modalActionMessage ? <p className={styles.submitMessage}>{modalActionMessage}</p> : null}
            {modalActionError ? <p>{modalActionError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
