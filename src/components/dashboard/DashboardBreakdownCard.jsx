import Card from '../ui/Card';
import styles from './DashboardBreakdownCard.module.css';

export default function DashboardBreakdownCard({ title, subtitle, items = [], emptyMessage = 'No data available.' }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item.value || 0)));

  return (
    <Card title={title} subtitle={subtitle}>
      {items.length ? (
        <div className={styles.list}>
          {items.map((item) => {
            const value = Number(item.value || 0);
            const fillWidth = `${Math.max(8, Math.round((value / maxValue) * 100))}%`;

            return (
              <article key={item.label} className={styles.item}>
                <div className={styles.row}>
                  <span className={styles.label}>{item.label}</span>
                  <strong className={styles.value}>{value}</strong>
                </div>
                <div className={styles.track}>
                  <span className={styles.fill} style={{ width: fillWidth }} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}
    </Card>
  );
}
