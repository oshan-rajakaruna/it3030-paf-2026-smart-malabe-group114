import { Compass } from 'lucide-react';

import styles from './NotFoundPage.module.css';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ROUTE_PATHS } from '../routes/routeConfig';

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <Card title="Page not found" subtitle="The route you opened does not exist in this frontend scaffold.">
        <div className={styles.content}>
          <span className={styles.iconWrap}>
            <Compass size={24} />
          </span>
          <p>
            Try heading back to the login page or dashboard. As the project grows, this route can
            later be replaced with a branded error screen.
          </p>
          <div className={styles.actions}>
            <Button to={ROUTE_PATHS.LOGIN} variant="secondary">
              Go to login
            </Button>
            <Button to={ROUTE_PATHS.DASHBOARD}>Open dashboard</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
