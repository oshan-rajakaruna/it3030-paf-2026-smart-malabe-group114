import styles from './EmptyState.module.css';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className={styles.state}>
      {Icon ? (
        <span className={styles.iconWrap}>
          <Icon size={22} />
        </span>
      ) : null}
      <div className={styles.copy}>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
