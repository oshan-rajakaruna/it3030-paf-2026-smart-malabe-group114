import styles from './FilterPanel.module.css';

export default function FilterPanel({ title, description, actions, children }) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
