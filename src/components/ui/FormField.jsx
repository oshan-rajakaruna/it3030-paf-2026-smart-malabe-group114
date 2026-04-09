import styles from './Field.module.css';
import { joinClassNames } from '../../utils/formatters';

export default function FormField({ id, label, hint, required = false, className, children }) {
  return (
    <label className={joinClassNames(styles.field, className)} htmlFor={id}>
      <span className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {required ? <span className={styles.required}>Required</span> : null}
      </span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
