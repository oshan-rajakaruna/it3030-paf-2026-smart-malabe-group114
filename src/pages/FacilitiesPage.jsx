import { Filter, Plus, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import styles from './FacilitiesPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import FilterPanel from '../components/ui/FilterPanel';
import PageHeader from '../components/ui/PageHeader';
import SearchBar from '../components/ui/SearchBar';
import StatusBadge from '../components/ui/StatusBadge';
import { mockFacilities } from '../data/facilities';
import { useAuth } from '../hooks/useAuth';
import {
  CAPACITY_OPTIONS,
  FACILITY_STATUS_OPTIONS,
  FACILITY_TYPES,
  LOCATIONS,
  ROLES,
} from '../utils/constants';

export default function FacilitiesPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [capacityFilter, setCapacityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery.toLowerCase());

  const filteredFacilities = mockFacilities.filter((facility) => {
    const matchesQuery =
      !deferredQuery ||
      [facility.name, facility.assetCode, facility.location, facility.description]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery);

    const matchesType = typeFilter === 'ALL' || facility.type === typeFilter;
    const matchesLocation = locationFilter === 'All Locations' || facility.location === locationFilter;
    const matchesStatus = statusFilter === 'ALL' || facility.status === statusFilter;

    const matchesCapacity =
      capacityFilter === 'ALL' ||
      (capacityFilter === '1-20' && facility.capacity <= 20) ||
      (capacityFilter === '21-50' && facility.capacity >= 21 && facility.capacity <= 50) ||
      (capacityFilter === '51-120' && facility.capacity >= 51 && facility.capacity <= 120) ||
      (capacityFilter === '120+' && facility.capacity > 120);

    return matchesQuery && matchesType && matchesLocation && matchesStatus && matchesCapacity;
  });

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
            placeholder="Search by name, code, description, or location..."
          />
          <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="ALL">All Types</option>
            {FACILITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
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
            {FACILITY_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All Statuses' : option}
              </option>
            ))}
          </select>
        </div>
      </FilterPanel>

      <div className={styles.resultsHeader}>
        <div>
          <strong>{filteredFacilities.length} resources visible</strong>
          <span>Cards and filters are modular so teammates can upgrade this page into tables or server pagination later.</span>
        </div>
        <Button variant="secondary" size="sm" icon={Filter}>
          Save filter view
        </Button>
      </div>

      {filteredFacilities.length ? (
        <section className={styles.catalogueGrid}>
          {filteredFacilities.map((facility) => (
            <Card
              key={facility.id}
              title={facility.name}
              subtitle={`${facility.type} · ${facility.assetCode}`}
              action={<StatusBadge status={facility.status} />}
              className={styles.catalogueCard}
            >
              <p className={styles.description}>{facility.description}</p>

              <div className={styles.metaGrid}>
                <div>
                  <span>Location</span>
                  <strong>{facility.location}</strong>
                </div>
                <div>
                  <span>Capacity</span>
                  <strong>{facility.capacity}</strong>
                </div>
                <div>
                  <span>Availability</span>
                  <strong>{facility.availabilityWindow}</strong>
                </div>
              </div>

              <div className={styles.featureList}>
                {facility.features.map((feature) => (
                  <span key={feature} className={styles.featureChip}>
                    {feature}
                  </span>
                ))}
              </div>

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
