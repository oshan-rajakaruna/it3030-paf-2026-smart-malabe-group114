import styles from './Card.module.css';
import { joinClassNames } from '../../utils/formatters';

export default function Card({ title, subtitle, action, className, children }) {
  return (
    <section className={joinClassNames(styles.card, className)}>
      {title || subtitle || action ? (
        <header className={styles.header}>
          <div>
            {title ? <h3 className={styles.title}>{title}</h3> : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {action ? <div className={styles.action}>{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
