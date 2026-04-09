import { Search } from 'lucide-react';

import styles from './SearchBar.module.css';

export default function SearchBar({ value, onChange, placeholder = 'Search...', label = 'Search' }) {
  return (
    <label className={styles.search}>
      <span className="visuallyHidden">{label}</span>
      <Search size={18} className={styles.icon} />
      <input type="search" value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}
