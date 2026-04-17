import { AlertCircle, CheckCircle2, Filter, LoaderCircle, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';

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
  // Temporary local preview flag so resource admin actions stay visible during frontend testing.
  const isAdminPreviewEnabled = true;
  const isAdmin = isAdminPreviewEnabled || currentUser.role === ROLES.ADMIN;
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
    let isCancelled = false;

    async function loadResources() {
      setLoading(true);
      setError('');

      try {
        const nextResources = await getResources({
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          location: locationFilter === 'All Locations' ? undefined : locationFilter,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
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
  }, [capacityFilter, deferredQuery, locationFilter, refreshKey, statusFilter, typeFilter]);

  const filteredFacilities = resources.filter((facility) => matchesCapacityRange(facility.capacity, capacityFilter));

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

  const closeFormModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormModalOpen(false);
    setFormError('');
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

  const handleDelete = async (resource) => {
    const shouldDelete = window.confirm(
      `Delete resource "${resource.name || resource.resourceCode}"?\n\nThis action cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingId(resource.id);
    setFormError('');
    setFeedback(null);

    try {
      await deleteResource(resource.id);
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

  const isReadOnly = formMode === 'view';
  const isInitialLoading = loading && !resources.length;
  const isRefreshing = loading && resources.length > 0;
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
        description="Searchable, filterable facilities and assets ready for future API-backed availability windows, CRUD actions, and admin workflows."
        actions={isAdmin ? <Button icon={Plus} onClick={openCreateModal}>Add resource</Button> : null}
      />

      <FilterPanel
        title="Find the right resource"
        description="Use shared filters so the catalogue can scale from mock data to server-side search later."
        actions={
          <Button variant="ghost" size="sm" icon={SlidersHorizontal}>
            Filter preset placeholder
          </Button>
        }
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
          <strong>{loading ? 'Loading resources...' : `${filteredFacilities.length} resources visible`}</strong>
          <span className={styles.resultsMeta}>
            {error
              ? 'The resource catalogue could not be loaded from the backend.'
              : 'Cards and filters are now backed by the resource API while keeping the page structure familiar.'}
          </span>
          {isRefreshing ? (
            <span className={styles.inlineLoading}>
              <LoaderCircle size={16} className={styles.spinner} />
              Refreshing resources from the backend...
            </span>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" icon={Filter}>
          Save filter view
        </Button>
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
      ) : filteredFacilities.length ? (
        <section className={styles.catalogueGrid}>
          {filteredFacilities.map((facility) => (
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
                {isAdmin ? (
                  <>
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
                      onClick={() => handleDelete(facility)}
                      disabled={deletingId === facility.id}
                    >
                      {deletingId === facility.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Filter}
          title="No resources found"
          description="Try adjusting the filters or search term to explore more facilities and assets."
        />
      )}

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
    </div>
  );
}
