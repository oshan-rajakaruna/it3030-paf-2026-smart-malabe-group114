import styles from './Field.module.css';
import FormField from './FormField';

export default function TextAreaField({ id, label, hint, rows = 5, ...rest }) {
  return (
    <FormField id={id} label={label} hint={hint}>
      <textarea id={id} className={styles.control} rows={rows} {...rest} />
    </FormField>
  );
}
