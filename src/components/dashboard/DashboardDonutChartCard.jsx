import Card from '../ui/Card';
import styles from './DashboardDonutChartCard.module.css';

const CHART_COLOR_MAP = {
  PENDING: 'var(--warning)',
  APPROVED: 'var(--success)',
  REJECTED: 'var(--danger)',
  CANCELLED: 'var(--text-soft)',
  OPEN: 'var(--warning)',
  IN_PROGRESS: 'var(--secondary)',
  RESOLVED: 'var(--success)',
  CLOSED: 'var(--text-soft)',
  ROOM: 'var(--primary)',
  LAB: 'var(--secondary)',
  EQUIPMENT: 'var(--warning)',
};

const FALLBACK_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--success)', 'var(--warning)', 'var(--danger)'];

function getChartColor(key, index) {
  return CHART_COLOR_MAP[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function DashboardDonutChartCard({
  title,
  subtitle,
  items = [],
  centerLabel = 'Total',
  emptyMessage = 'No data available.',
}) {
  if (!items.length) {
    return (
      <Card title={title} subtitle={subtitle}>
        <p className={styles.empty}>{emptyMessage}</p>
      </Card>
    );
  }

  const normalizedItems = items.map((item, index) => ({
    ...item,
    value: Number(item.value || 0),
    color: getChartColor(item.key || item.label, index),
  }));

  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0);
  let runningPercent = 0;

  const donutGradient = total
    ? normalizedItems
        .map((item) => {
          const start = runningPercent;
          const segmentPercent = (item.value / total) * 100;
          runningPercent += segmentPercent;
          return `${item.color} ${start}% ${runningPercent}%`;
        })
        .join(', ')
    : 'var(--neutral-soft) 0 100%';

  return (
    <Card title={title} subtitle={subtitle}>
      <div className={styles.layout}>
        <div className={styles.chartWrap}>
          <div
            className={styles.chart}
            style={{
              background: `conic-gradient(${donutGradient})`,
            }}
          >
            <div className={styles.chartInner}>
              <strong>{total}</strong>
              <span>{centerLabel}</span>
            </div>
          </div>
        </div>

        <div className={styles.legend}>
          {normalizedItems.map((item) => {
            const percentage = total ? Math.round((item.value / total) * 100) : 0;

            return (
              <article key={item.key || item.label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: item.color }} />
                <div className={styles.legendCopy}>
                  <strong>{item.label}</strong>
                  <small>{percentage}% of visible total</small>
                </div>
                <strong className={styles.legendValue}>{item.value}</strong>
              </article>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
