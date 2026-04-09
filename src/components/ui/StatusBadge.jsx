import styles from './StatusBadge.module.css';
import { formatStatusLabel, joinClassNames } from '../../utils/formatters';
import { getStatusTone } from '../../utils/status';

export default function StatusBadge({ status, className }) {
  return (
    <span className={joinClassNames(styles.badge, className)} data-tone={getStatusTone(status)}>
      {formatStatusLabel(status)}
    </span>
  );
}
