import { Link } from 'react-router-dom';

import styles from './Button.module.css';
import { joinClassNames } from '../../utils/formatters';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  fullWidth = false,
  href,
  to,
  type = 'button',
  ...rest
}) {
  const sharedClassName = joinClassNames(
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    className,
  );

  const content = (
    <>
      {Icon ? <Icon size={18} strokeWidth={2} /> : null}
      <span>{children}</span>
    </>
  );

  if (to) {
    return (
      <Link className={sharedClassName} to={to} {...rest}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a className={sharedClassName} href={href} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button className={sharedClassName} type={type} {...rest}>
      {content}
    </button>
  );
}
