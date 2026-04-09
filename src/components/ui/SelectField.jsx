import styles from './Field.module.css';
import FormField from './FormField';

export default function SelectField({ id, label, options, hint, placeholder, ...rest }) {
  return (
    <FormField id={id} label={label} hint={hint}>
      <select id={id} className={styles.control} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const displayLabel = typeof option === 'string' ? option : option.label;

          return (
            <option key={value} value={value}>
              {displayLabel}
            </option>
          );
        })}
      </select>
    </FormField>
  );
}
