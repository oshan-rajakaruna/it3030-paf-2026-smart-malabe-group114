import { AlertCircle, CheckCircle2, Download, Filter, LoaderCircle, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './FacilitiesPage.module.css';
import fieldStyles from '../components/ui/Field.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import FormField from '../components/ui/FormField';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import SelectField from '../components/ui/SelectField';
import TextAreaField from '../components/ui/TextAreaField';
import { useAuth } from '../hooks/useAuth';
import {
  CAPACITY_OPTIONS,
  LOCATIONS,
  ROLES,
} from '../utils/constants';
import { ROUTE_PATHS } from '../routes/routeConfig';
import {
  createResource,
  deleteResource,
  getResources,
  updateResource,
} from '../services/resourceService';

const RESOURCE_TYPE_OPTIONS = [
  { value: 'ROOM', label: 'Room' },
  { value: 'LAB', label: 'Lab' },
  { value: 'EQUIPMENT', label: 'Equipment' },
];

const RESOURCE_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const TYPE_LABELS = {
  ROOM: 'Room',
  LAB: 'Lab',
  EQUIPMENT: 'Equipment',
};

const initialForm = {
  resourceCode: '',
  name: '',
  type: 'ROOM',
  location: '',
  floor: '',
  capacity: '',
  status: 'AVAILABLE',
  isActive: true,
  description: '',
  imageUrl: '',
  availableFrom: '',
  availableTo: '',
};

function getMinimumCapacityValue(capacityFilter) {
  switch (capacityFilter) {
    case '1-20':
      return 1;
    case '21-50':
      return 21;
    case '51-120':
      return 51;
    case '120+':
      return 120;
    default:
      return undefined;
  }
}

function matchesCapacityRange(capacity, capacityFilter) {
  if (capacityFilter === 'ALL') {
    return true;
  }

  if (typeof capacity !== 'number') {
    return false;
  }

  if (capacityFilter === '1-20') {
    return capacity <= 20;
  }

  if (capacityFilter === '21-50') {
    return capacity >= 21 && capacity <= 50;
  }

  if (capacityFilter === '51-120') {
    return capacity >= 51 && capacity <= 120;
  }

  if (capacityFilter === '120+') {
    return capacity > 120;
  }

  return true;
}

function formatResourceType(type) {
  return TYPE_LABELS[type] ?? type ?? 'Unknown';
}

function formatResourceStatus(status) {
  return status
    ? status
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase())
    : 'Unknown';
}

function formatActiveState(isActive) {
  return isActive === false ? 'Inactive' : 'Active';
}

function formatTimeValue(value) {
  const formattedValue = typeof value === 'string' ? value.slice(0, 5) : '';
  return formattedValue || 'Not provided';
}

function formatAvailability(availableFrom, availableTo) {
  const start = typeof availableFrom === 'string' ? availableFrom.slice(0, 5) : '';
  const end = typeof availableTo === 'string' ? availableTo.slice(0, 5) : '';

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || 'Not provided';
}

function formatInputTime(value) {
  return typeof value === 'string' ? value.slice(0, 5) : '';
}

function getFriendlyRequestError(error, fallbackMessage) {
  const message = error instanceof Error ? error.message.trim() : '';

  if (!message) {
    return fallbackMessage;
  }

  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage === 'failed to fetch'
    || normalizedMessage.includes('networkerror')
    || normalizedMessage.includes('load failed')
    || normalizedMessage.startsWith('<!doctype html')
  ) {
    return fallbackMessage;
  }

  return message;
}

function formatReportDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

function getAppliedFilterLabels({
  typeFilter,
  locationFilter,
  capacityFilter,
  statusFilter,
  searchQuery,
}) {
  const labels = [];

  if (typeFilter !== 'ALL') {
    labels.push(`Type: ${formatResourceType(typeFilter)}`);
  }

  if (locationFilter !== 'All Locations') {
    labels.push(`Location: ${locationFilter}`);
  }

  if (capacityFilter !== 'ALL') {
    labels.push(`Capacity: ${capacityFilter}`);
  }

  if (statusFilter !== 'ALL') {
    labels.push(`Status: ${formatResourceStatus(statusFilter)}`);
  }

  if (searchQuery) {
    labels.push(`Search: ${searchQuery}`);
  }

  return labels;
}

function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  return value.length === 5 ? `${value}:00` : value;
}

function createFormState(resource) {
  if (!resource) {
    return initialForm;
  }

  return {
    resourceCode: resource.resourceCode ?? '',
    name: resource.name ?? '',
    type: resource.type ?? 'ROOM',
    location: resource.location ?? '',
    floor: resource.floor ?? '',
    capacity: resource.capacity?.toString() ?? '',
    status: resource.status ?? 'AVAILABLE',
    isActive: resource.isActive !== false,
    description: resource.description ?? '',
    imageUrl: resource.imageUrl ?? '',
    availableFrom: formatInputTime(resource.availableFrom),
    availableTo: formatInputTime(resource.availableTo),
  };
}

function buildResourcePayload(form) {
  return {
    resourceCode: form.resourceCode.trim(),
    name: form.name.trim(),
    type: form.type,
    location: form.location.trim(),
    floor: form.floor.trim(),
    capacity: Number(form.capacity),
    status: form.status,
    isActive: form.isActive,
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    availableFrom: normalizeTimeValue(form.availableFrom),
    availableTo: normalizeTimeValue(form.availableTo),
  };
}

export default function FacilitiesPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isStudentView = !isAdmin;
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [capacityFilter, setCapacityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteCountdown, setDeleteCountdown] = useState(3);
  const deferredQuery = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    if (!deleteTarget || deleteCountdown <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDeleteCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [deleteCountdown, deleteTarget]);

  useEffect(() => {
    let isCancelled = false;

    async function loadResources() {
      setLoading(true);
      setError('');

      try {
        const nextResources = await getResources({
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          location: locationFilter === 'All Locations' ? undefined : locationFilter,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          isActive: isStudentView ? true : undefined,
          minCapacity: getMinimumCapacityValue(capacityFilter),
          search: deferredQuery || undefined,
        });

        if (!isCancelled) {
          setResources(nextResources);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setResources([]);
          setError('We could not load the facilities catalogue right now. Please check the backend connection and try again.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadResources();

    return () => {
      isCancelled = true;
    };
  }, [capacityFilter, deferredQuery, isStudentView, locationFilter, refreshKey, statusFilter, typeFilter]);

  const filteredFacilities = resources.filter((facility) => matchesCapacityRange(facility.capacity, capacityFilter));
  const visibleFacilities = filteredFacilities.filter((facility) => (isStudentView ? facility.isActive !== false : true));
  const appliedFilterLabels = getAppliedFilterLabels({
    typeFilter,
    locationFilter,
    capacityFilter,
    statusFilter,
    searchQuery: deferredQuery,
  });
  const appliedFiltersSummary = appliedFilterLabels.length
    ? appliedFilterLabels.join(' | ')
    : 'All resources';

  const handleBookNow = (resource) => {
    if (!resource?.id) {
      return;
    }

    navigate(ROUTE_PATHS.BOOKINGS, {
      state: {
        bookingPrefillResourceId: String(resource.id),
      },
    });
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditingResourceId(null);
    setForm(initialForm);
    setFormError('');
    setFeedback(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (resource) => {
    setFormMode('edit');
    setEditingResourceId(resource.id);
    setForm(createFormState(resource));
    setFormError('');
    setFeedback(null);
    setIsFormModalOpen(true);
  };

  const openViewModal = (resource) => {
    setFormMode('view');
    setEditingResourceId(resource.id);
    setForm(createFormState(resource));
    setFormError('');
    setFeedback(null);
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (resource) => {
    setDeleteTarget(resource);
    setDeleteCountdown(3);
    setFeedback(null);
  };

  const closeFormModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormModalOpen(false);
    setFormError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteCountdown(3);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'isActive' ? value === 'true' : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (formMode === 'view') {
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setFeedback(null);

    try {
      const payload = buildResourcePayload(form);

      if (formMode === 'create') {
        await createResource(payload);
        setFeedback({ type: 'success', message: 'Resource created successfully.' });
      } else {
        await updateResource(editingResourceId, payload);
        setFeedback({ type: 'success', message: 'Resource updated successfully.' });
      }

      setIsFormModalOpen(false);
      setForm(initialForm);
      setEditingResourceId(null);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      const fallbackMessage =
        formMode === 'create'
          ? 'We could not create the resource right now. Please review the details and try again.'
          : 'We could not update the resource right now. Please review the details and try again.';
      setFormError(getFriendlyRequestError(submitError, fallbackMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteCountdown > 0) {
      return;
    }

    const resourceToDelete = deleteTarget;

    setDeletingId(resourceToDelete.id);
    setFormError('');
    setFeedback(null);

    try {
      await deleteResource(resourceToDelete.id);
      closeDeleteModal();
      setFeedback({ type: 'success', message: 'Resource deleted successfully.' });
      setRefreshKey((current) => current + 1);
    } catch (deleteError) {
      setFeedback({
        type: 'error',
        message: getFriendlyRequestError(
          deleteError,
          'We could not delete that resource right now. Please try again.',
        ),
      });
    } finally {
      setDeletingId('');
    }
  };

  const handleDownloadReport = async () => {
    if (!visibleFacilities.length) {
      return;
    }

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const generatedAt = new Date();
      const document = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });
      const pageWidth = document.internal.pageSize.getWidth();
      const reportTitle = 'Facilities Resource Report';
      const filterSummaryLines = document.splitTextToSize(
        `Applied filters: ${appliedFiltersSummary}`,
        pageWidth - 80,
      );

      document.setFontSize(18);
      document.setTextColor(15, 23, 42);
      document.text(reportTitle, 40, 40);

      document.setFontSize(10);
      document.setTextColor(71, 85, 105);
      document.text(`Generated: ${formatReportDateTime(generatedAt)}`, 40, 62);
      document.text(`Visible resources: ${visibleFacilities.length}`, 40, 78);
      document.text(filterSummaryLines, 40, 94);

      autoTable(document, {
        startY: 94 + (filterSummaryLines.length * 12) + 10,
        head: [[
          'Resource Code',
          'Name',
          'Type',
          'Location',
          'Floor',
          'Capacity',
          'Status',
          'Active State',
          'Available From',
          'Available To',
        ]],
        body: visibleFacilities.map((facility) => ([
          facility.resourceCode || 'Not provided',
          facility.name || 'Unnamed resource',
          formatResourceType(facility.type),
          facility.location || 'Not provided',
          facility.floor || 'Not provided',
          facility.capacity ?? 'Not provided',
          formatResourceStatus(facility.status),
          formatActiveState(facility.isActive),
          formatTimeValue(facility.availableFrom),
          formatTimeValue(facility.availableTo),
        ])),
        theme: 'grid',
        margin: { top: 40, right: 40, bottom: 40, left: 40 },
        styles: {
          fontSize: 8,
          cellPadding: 4,
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          textColor: [15, 23, 42],
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      document.save(`facilities-resource-report-${generatedAt.toISOString().slice(0, 10)}.pdf`);
      setFeedback({ type: 'success', message: 'PDF report downloaded successfully.' });
    } catch (reportError) {
      setFeedback({
        type: 'error',
        message: 'We could not generate the PDF report right now. Please try again.',
      });
    }
  };

  const isReadOnly = formMode === 'view';
  const isInitialLoading = loading && !resources.length;
  const isRefreshing = loading && resources.length > 0;
  const isDeleteModalOpen = Boolean(deleteTarget);
  const isDeletePending = deleteTarget ? deletingId === deleteTarget.id : false;
  const visibleResourcesLabel = isStudentView
    ? `${visibleFacilities.length} active resources visible`
    : `${visibleFacilities.length} resources visible`;
  const modalTitle =
    formMode === 'create'
      ? 'Create resource'
      : formMode === 'edit'
        ? 'Update resource'
        : 'Resource details';
  const modalDescription =
    formMode === 'create'
      ? 'Add a new facility or asset to the catalogue.'
      : formMode === 'edit'
        ? 'Update the selected resource details.'
        : 'Review the selected resource details.';

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Facilities & Assets"
        title="Campus resource catalogue"
        description={
          isStudentView
            ? 'Browse active campus resources, use filters to narrow the list, and jump straight into the booking form.'
            : 'Searchable, filterable facilities and assets ready for future API-backed availability windows, CRUD actions, and admin workflows.'
        }
        actions={isAdmin ? <Button icon={Plus} onClick={openCreateModal}>Add resource</Button> : null}
      />

      <FilterPanel
        title="Find the right resource"
        description="Use shared filters so the catalogue can scale from mock data to server-side search later."
        actions={isAdmin ? (
          <Button variant="ghost" size="sm" icon={SlidersHorizontal}>
            Filter preset placeholder
          </Button>
        ) : null}
      >
        <div className={styles.filterGrid}>
          <SearchBar
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or resource code..."
          />
          <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">All Types</option>
            {RESOURCE_TYPE_OPTIONS.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <select className={styles.select} value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <select className={styles.select} value={capacityFilter} onChange={(event) => setCapacityFilter(event.target.value)}>
            {CAPACITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All Capacities' : option}
              </option>
            ))}
          </select>
          <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All Statuses</option>
            {RESOURCE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      {feedback ? (
        <div
          className={styles.feedbackBanner}
          data-type={feedback.type}
          role="status"
          aria-live="polite"
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className={styles.resultsHeader}>
        <div>
          <strong>{loading ? 'Loading resources...' : visibleResourcesLabel}</strong>
          <span className={styles.resultsMeta}>
            {error
              ? 'The resource catalogue could not be loaded from the backend.'
              : isStudentView
                ? 'Student view keeps search and filtering while only showing active resources.'
                : 'Cards and filters are now backed by the resource API while keeping the page structure familiar.'}
          </span>
          {isRefreshing ? (
            <span className={styles.inlineLoading}>
              <LoaderCircle size={16} className={styles.spinner} />
              Refreshing resources from the backend...
            </span>
          ) : null}
        </div>
        {isAdmin ? (
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={handleDownloadReport}
              disabled={!visibleFacilities.length}
            >
              Download PDF Report
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <EmptyState
          icon={AlertCircle}
          title="Unable to load resources"
          description={error}
        />
      ) : isInitialLoading ? (
        <section className={styles.loadingState}>
          <div className={styles.loadingSpinnerWrap}>
            <LoaderCircle size={24} className={styles.spinner} />
          </div>
          <strong>Loading facilities and assets</strong>
          <p>Fetching the latest catalogue from the backend service.</p>
        </section>
      ) : visibleFacilities.length ? (
        <>
          {isAdmin ? (
            <section className={styles.catalogueGrid}>
              {visibleFacilities.map((facility) => (
              <Card
                key={facility.id}
                title={facility.name || 'Unnamed resource'}
                subtitle={`${formatResourceType(facility.type)} - ${facility.resourceCode || 'No code'}`}
                action={
                  <div className={styles.cardBadgeGroup}>
                    <span className={styles.statusChip} data-status={facility.status}>
                      {formatResourceStatus(facility.status)}
                    </span>
                    <span
                      className={styles.activeStateChip}
                      data-active={facility.isActive === false ? 'false' : 'true'}
                    >
                      {formatActiveState(facility.isActive)}
                    </span>
                  </div>
                }
                className={styles.catalogueCard}
              >
                <div className={styles.cardIntro}>
                  <span className={styles.resourceCodeChip}>{facility.resourceCode || 'No code'}</span>
                  <span className={styles.typeChip}>{formatResourceType(facility.type)}</span>
                </div>

                <p className={styles.description}>{facility.description || 'No description provided yet.'}</p>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span>Location</span>
                    <strong>{facility.location || 'Not provided'}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Capacity</span>
                    <strong>{facility.capacity ?? 'Not provided'}</strong>
                  </div>
                  <div className={styles.metaItem}>
                    <span>Availability</span>
                    <strong>{formatAvailability(facility.availableFrom, facility.availableTo)}</strong>
                  </div>
                </div>

                {facility.floor ? (
                  <div className={styles.featureList}>
                    {facility.floor ? <span className={styles.featureChip}>Floor: {facility.floor}</span> : null}
                  </div>
                ) : null}

                <div className={styles.cardActions}>
                  <Button variant="secondary" size="sm" onClick={() => openViewModal(facility)}>
                    View details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(facility)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => openDeleteModal(facility)}
                    disabled={Boolean(deletingId)}
                  >
                    {deletingId === facility.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </Card>
              ))}
            </section>
          ) : null}

          <section className={styles.reportSection}>
            <div className={styles.reportHeader}>
              <div className={styles.reportHeaderText}>
                <strong>{isStudentView ? 'Available resources' : 'Resource report table'}</strong>
                <span>
                  {isStudentView
                    ? 'Students can search, filter, and book active resources directly from this table.'
                    : 'Structured view of the currently visible facilities and assets for presentation and export.'}
                </span>
              </div>
              <div className={styles.reportMeta}>
                <span>{visibleFacilities.length} rows</span>
                <span>{appliedFiltersSummary}</span>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.resourceTable}>
                <thead>
                  <tr>
                    <th>Resource Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Floor</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    {isAdmin ? <th>Active State</th> : null}
                    {isAdmin ? (
                      <>
                        <th>Available From</th>
                        <th>Available To</th>
                      </>
                    ) : (
                      <>
                        <th>Available Time</th>
                        <th>Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleFacilities.map((facility) => (
                    <tr key={`report-${facility.id}`}>
                      <td>{facility.resourceCode || 'Not provided'}</td>
                      <td>{facility.name || 'Unnamed resource'}</td>
                      <td>{formatResourceType(facility.type)}</td>
                      <td>{facility.location || 'Not provided'}</td>
                      <td>{facility.floor || 'Not provided'}</td>
                      <td>{facility.capacity ?? 'Not provided'}</td>
                      <td>
                        <span className={styles.statusChip} data-status={facility.status}>
                          {formatResourceStatus(facility.status)}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td>
                          <span
                            className={styles.activeStateChip}
                            data-active={facility.isActive === false ? 'false' : 'true'}
                          >
                            {formatActiveState(facility.isActive)}
                          </span>
                        </td>
                      ) : null}
                      {isAdmin ? (
                        <>
                          <td>{formatTimeValue(facility.availableFrom)}</td>
                          <td>{formatTimeValue(facility.availableTo)}</td>
                        </>
                      ) : (
                        <>
                          <td>{formatAvailability(facility.availableFrom, facility.availableTo)}</td>
                          <td>
                            <Button
                              size="sm"
                              onClick={() => handleBookNow(facility)}
                              disabled={String(facility.status ?? '').toUpperCase() !== 'AVAILABLE'}
                            >
                              Book Now
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          icon={Filter}
          title="No resources found"
          description="Try adjusting the filters or search term to explore more facilities and assets."
        />
      )}

      {isAdmin ? (
        <>
          <Modal
            isOpen={isFormModalOpen}
            onClose={closeFormModal}
            title={modalTitle}
            description={modalDescription}
          >
            <form id="resource-form" onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.modalGrid}>
                <FormField id="resourceCode" label="Resource code" required>
                  <input
                    id="resourceCode"
                    name="resourceCode"
                    className={fieldStyles.control}
                    value={form.resourceCode}
                    onChange={handleInputChange}
                    placeholder="e.g. LAB-101"
                    required
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField id="name" label="Name" required>
                  <input
                    id="name"
                    name="name"
                    className={fieldStyles.control}
                    value={form.name}
                    onChange={handleInputChange}
                    placeholder="Enter resource name"
                    required
                    disabled={isReadOnly}
                  />
                </FormField>

                <SelectField
                  id="type"
                  label="Type"
                  name="type"
                  value={form.type}
                  onChange={handleInputChange}
                  options={RESOURCE_TYPE_OPTIONS}
                  disabled={isReadOnly}
                />

                <FormField id="location" label="Location" required>
                  <input
                    id="location"
                    name="location"
                    className={fieldStyles.control}
                    value={form.location}
                    onChange={handleInputChange}
                    placeholder="e.g. Block A"
                    required
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField id="floor" label="Floor">
                  <input
                    id="floor"
                    name="floor"
                    className={fieldStyles.control}
                    value={form.floor}
                    onChange={handleInputChange}
                    placeholder="Optional floor"
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField id="capacity" label="Capacity" required>
                  <input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min="0"
                    className={fieldStyles.control}
                    value={form.capacity}
                    onChange={handleInputChange}
                    placeholder="e.g. 40"
                    required
                    disabled={isReadOnly}
                  />
                </FormField>

                <SelectField
                  id="status"
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleInputChange}
                  options={RESOURCE_STATUS_OPTIONS}
                  disabled={isReadOnly}
                />

                <SelectField
                  id="isActive"
                  label="Active state"
                  name="isActive"
                  value={String(form.isActive)}
                  onChange={handleInputChange}
                  options={ACTIVE_OPTIONS}
                  disabled={isReadOnly}
                />

                <FormField id="imageUrl" label="Image URL">
                  <input
                    id="imageUrl"
                    name="imageUrl"
                    className={fieldStyles.control}
                    value={form.imageUrl}
                    onChange={handleInputChange}
                    placeholder="Optional image URL"
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField id="availableFrom" label="Available from" required>
                  <input
                    id="availableFrom"
                    name="availableFrom"
                    type="time"
                    className={fieldStyles.control}
                    value={form.availableFrom}
                    onChange={handleInputChange}
                    required
                    disabled={isReadOnly}
                  />
                </FormField>

                <FormField id="availableTo" label="Available to" required>
                  <input
                    id="availableTo"
                    name="availableTo"
                    type="time"
                    className={fieldStyles.control}
                    value={form.availableTo}
                    onChange={handleInputChange}
                    required
                    disabled={isReadOnly}
                  />
                </FormField>
              </div>

              <TextAreaField
                id="description"
                label="Description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                hint="Optional summary for the resource catalogue card."
                disabled={isReadOnly}
              />

              {formError ? (
                <div className={styles.formMessage} data-type="error" role="alert">
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              ) : null}

              <div className={styles.cardActions}>
                <Button type="button" variant="secondary" onClick={closeFormModal} disabled={isSubmitting}>
                  {isReadOnly ? 'Close' : 'Cancel'}
                </Button>
                {isReadOnly ? null : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <LoaderCircle size={16} className={styles.spinner} />
                        <span>{formMode === 'create' ? 'Creating...' : 'Updating...'}</span>
                      </>
                    ) : (
                      formMode === 'create' ? 'Create resource' : 'Update resource'
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Modal>

          <Modal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            title="Confirm deletion"
            description="Are you sure you want to delete this resource?"
            footer={(
              <div className={styles.deleteModalActions}>
                <Button type="button" variant="secondary" onClick={closeDeleteModal}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleteCountdown > 0 || isDeletePending}
                >
                  {isDeletePending ? (
                    <>
                      <LoaderCircle size={16} className={styles.spinner} />
                      <span>Deleting...</span>
                    </>
                  ) : deleteCountdown > 0 ? (
                    `Confirm Delete (${deleteCountdown})`
                  ) : (
                    'Confirm Delete'
                  )}
                </Button>
              </div>
            )}
          >
            {deleteTarget ? (
              <div className={styles.deleteModalContent}>
                <div className={styles.deleteResourceSummary}>
                  <strong>{deleteTarget.name || 'Unnamed resource'}</strong>
                  <span>{deleteTarget.resourceCode || 'No resource code'}</span>
                </div>
                <div
                  className={styles.deleteCountdownBadge}
                  data-ready={deleteCountdown === 0}
                  role="status"
                  aria-live="polite"
                >
                  {deleteCountdown > 0
                    ? `Deletion unlocks in ${deleteCountdown} second${deleteCountdown === 1 ? '' : 's'}`
                    : 'Countdown complete. You can now confirm deletion.'}
                </div>
              </div>
            ) : null}
          </Modal>
        </>
      ) : null}
    </div>
  );
}
