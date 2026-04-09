import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import styles from './AppLayout.module.css';
import Sidebar from '../components/navigation/Sidebar';
import Topbar from '../components/navigation/Topbar';

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      {isSidebarOpen ? <button type="button" className={styles.backdrop} onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar" /> : null}

      <div className={styles.mainColumn}>
        <Topbar onMenuToggle={() => setIsSidebarOpen(true)} />
        <main className={styles.content}>
          <div className={styles.contentInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
