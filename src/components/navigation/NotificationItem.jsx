import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import styles from './NotificationItem.module.css';
import StatusBadge from '../ui/StatusBadge';
import { formatDateTime } from '../../utils/formatters';

export default function NotificationItem({ notification, onClick }) {
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
          <StatusBadge status={notification.type} />
          {!notification.read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
        </div>
        <div className={styles.copy}>
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
        </div>
      </div>
      <div className={styles.meta}>
        <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
        <Link className={styles.link} to={notification.actionPath}>
          {notification.actionLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
