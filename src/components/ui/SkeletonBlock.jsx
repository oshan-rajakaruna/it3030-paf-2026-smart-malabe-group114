import styles from './SkeletonBlock.module.css';
import { joinClassNames } from '../../utils/formatters';

export default function SkeletonBlock({ className }) {
  return <div className={joinClassNames(styles.skeleton, className)} />;
}
