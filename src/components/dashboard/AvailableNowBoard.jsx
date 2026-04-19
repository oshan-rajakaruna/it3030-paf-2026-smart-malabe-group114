import { Clock3, Flame, RotateCcw, XCircle } from 'lucide-react';

import Card from '../ui/Card';
import Button from '../ui/Button';
import { joinClassNames } from '../../utils/formatters';
import styles from './AvailableNowBoard.module.css';

function getBadgeMeta(slot) {
  if (slot.type === 'PARTIAL_SLOT') {
    return {
      icon: RotateCcw,
      className: styles.badgeReleased,
      label: 'Released (No-show)',
    };
  }

  return {
    icon: Flame,
    className: styles.badgeNow,
    label: 'Available Again',
  };
}

export default function AvailableNowBoard({ slots = [], onBookNow, isBooking = false }) {
  return (
    <Card
      title="Available Now"
      subtitle="Live campus availability released from no-shows and open resources."
      className={styles.card}
    >
      <div className={styles.stack}>
        {slots.length ? (
          slots.map((slot) => {
            const badge = getBadgeMeta(slot);
            const BadgeIcon = badge.icon;

            return (
              <article key={`${slot.resourceId}-${slot.availableFrom}-${slot.availableTo}-${slot.type}`} className={styles.item}>
                <div className={styles.itemTop}>
                  <div>
                    <strong>{slot.resourceName}</strong>
                    <p>{slot.location}</p>
                  </div>
                  <span className={joinClassNames(styles.badge, badge.className)}>
                    <BadgeIcon size={14} />
                    {badge.label}
                  </span>
                </div>

                <div className={styles.slotRow}>
                  <span className={styles.slotTime}>
                    <Clock3 size={15} />
                    {slot.availableFrom} - {slot.availableTo}
                  </span>
                  <span className={styles.slotType}>
                    {slot.type === 'PARTIAL_SLOT' ? 'Partial slot' : 'Open resource'}
                  </span>
                </div>

                <div className={styles.actions}>
                  <Button size="sm" onClick={() => onBookNow?.(slot)} disabled={isBooking}>
                    {isBooking ? 'Booking...' : 'Book Now'}
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <XCircle size={18} />
            <div>
              <strong>No live slots right now</strong>
              <p>Once a booking becomes a no-show or a resource opens up, it will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
