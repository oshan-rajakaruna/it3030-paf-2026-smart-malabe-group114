import styles from './StatCard.module.css';

export default function StatCard({ icon: Icon, label, value, meta, trend, tone = 'primary', variant = 'default' }) {
  return (
    <article className={styles.card} data-tone={tone} data-variant={variant}>
      <div className={styles.topRow}>
        <span className={styles.iconWrap}>{Icon ? <Icon size={20} /> : null}</span>
        {trend ? <span className={styles.trend}>{trend}</span> : null}
      </div>
      <div className={styles.body}>
        <span className={styles.label}>{label}</span>
        <strong className={styles.value}>{value}</strong>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
    </article>
  );
}
