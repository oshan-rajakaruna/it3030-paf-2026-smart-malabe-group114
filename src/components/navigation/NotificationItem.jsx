import { Link } from 'react-router-dom';
import { ArrowRight, Trash2 } from 'lucide-react';

import styles from './NotificationItem.module.css';
import StatusBadge from '../ui/StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export default function NotificationItem({ notification, onClick, onDelete }) {
  const badgeValue = notification.moduleTag || notification.module || notification.type || 'SYSTEM';
  const secondaryBadgeValue = notification.priorityTag || notification.priority || '';
  const hasActionLink = notification.actionPath && notification.actionLabel;

  return (
    <article
      className={styles.item}
      data-unread={!notification.read}
      data-clickable={Boolean(onClick)}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.main}>
        <div className={styles.header}>
          <div className={styles.badges}>
            <StatusBadge status={badgeValue} />
            {secondaryBadgeValue ? <StatusBadge status={secondaryBadgeValue} /> : null}
          </div>
          <div className={styles.headerActions}>
            {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
            {onDelete ? (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(notification.id);
                }}
                aria-label="Delete notification"
                title="Delete notification"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </div>
        <div className={styles.copy}>
          <h3>{notification.title || 'Notification'}</h3>
          <p>{notification.message}</p>
        </div>
      </div>
      <div className={styles.meta}>
        <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
        {hasActionLink ? (
          <Link className={styles.link} to={notification.actionPath}>
            {notification.actionLabel}
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
