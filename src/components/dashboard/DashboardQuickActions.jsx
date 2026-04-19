import Button from '../ui/Button';
import Card from '../ui/Card';
import styles from './DashboardQuickActions.module.css';

export default function DashboardQuickActions({ actions = [] }) {
  return (
    <Card
      title="Quick actions"
      subtitle="Jump directly into the admin workflows that need the most attention."
    >
      <div className={styles.list}>
        {actions.map(({ label, description, to, icon: Icon, variant = 'secondary' }) => (
          <article key={label} className={styles.item}>
            <Button to={to} icon={Icon} variant={variant}>
              {label}
            </Button>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}
