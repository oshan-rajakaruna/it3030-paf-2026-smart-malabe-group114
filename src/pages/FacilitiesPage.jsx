import { Filter, Plus, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';

import styles from './FacilitiesPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import {
  CAPACITY_OPTIONS,
  LOCATIONS,
  ROLES,
} from '../utils/constants';
import { getResources } from '../services/resourceService';

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

const STATUS_BADGE_MAP = {
  AVAILABLE: 'ACTIVE',
  UNAVAILABLE: 'OUT_OF_SERVICE',
  MAINTENANCE: 'LIMITED',
};

const TYPE_LABELS = {
  ROOM: 'Room',
  LAB: 'Lab',
  EQUIPMENT: 'Equipment',
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

function formatAvailability(availableFrom, availableTo) {
  const start = typeof availableFrom === 'string' ? availableFrom.slice(0, 5) : '';
  const end = typeof availableTo === 'string' ? availableTo.slice(0, 5) : '';

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || 'Not provided';
}

export default function FacilitiesPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [capacityFilter, setCapacityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery.trim());

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
          setError(fetchError.message || 'Unable to load resources from the backend.');
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
  }, [capacityFilter, deferredQuery, locationFilter, statusFilter, typeFilter]);

  const filteredFacilities = resources.filter((facility) => matchesCapacityRange(facility.capacity, capacityFilter));

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Facilities & Assets"
        title="Campus resource catalogue"
        description="Searchable, filterable facilities and assets ready for future API-backed availability windows, CRUD actions, and admin workflows."
        actions={isAdmin ? <Button icon={Plus}>Add facility placeholder</Button> : null}
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

      <div className={styles.resultsHeader}>
        <div>
          <strong>{loading ? 'Loading resources...' : `${filteredFacilities.length} resources visible`}</strong>
          <span>
            {error
              ? 'The resource catalogue could not be loaded from the backend.'
              : 'Cards and filters are now backed by the resource API while keeping the page structure familiar.'}
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={Filter}>
          Save filter view
        </Button>
      </div>

      {error ? (
        <EmptyState
          icon={Filter}
          title="Unable to load resources"
          description={error}
        />
      ) : loading && !filteredFacilities.length ? (
        <EmptyState
          icon={Filter}
          title="Loading resources"
          description="Fetching the latest facilities and assets from the backend catalogue."
        />
      ) : filteredFacilities.length ? (
        <section className={styles.catalogueGrid}>
          {filteredFacilities.map((facility) => (
            <Card
              key={facility.id}
              title={facility.name || 'Unnamed resource'}
              subtitle={`${formatResourceType(facility.type)} · ${facility.resourceCode || 'No code'}`}
              action={<StatusBadge status={STATUS_BADGE_MAP[facility.status] ?? 'LIMITED'} />}
              className={styles.catalogueCard}
            >
              <p className={styles.description}>{facility.description || 'No description provided yet.'}</p>

              <div className={styles.metaGrid}>
                <div>
                  <span>Location</span>
                  <strong>{facility.location || 'Not provided'}</strong>
                </div>
                <div>
                  <span>Capacity</span>
                  <strong>{facility.capacity ?? 'Not provided'}</strong>
                </div>
                <div>
                  <span>Availability</span>
                  <strong>{formatAvailability(facility.availableFrom, facility.availableTo)}</strong>
                </div>
              </div>

              {facility.floor || typeof facility.isActive === 'boolean' ? (
                <div className={styles.featureList}>
                  {facility.floor ? <span className={styles.featureChip}>Floor: {facility.floor}</span> : null}
                  {typeof facility.isActive === 'boolean' ? (
                    <span className={styles.featureChip}>{facility.isActive ? 'Active' : 'Inactive'}</span>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.cardActions}>
                <Button variant="secondary" size="sm">
                  View details
                </Button>
                {isAdmin ? (
                  <Button variant="ghost" size="sm">
                    Edit placeholder
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Filter}
          title="No facilities match this filter set"
          description="Try a wider search or reset one of the filters. This empty state is ready to stay consistent even after server-side filtering is introduced."
        />
      )}
    </div>
  );
}
