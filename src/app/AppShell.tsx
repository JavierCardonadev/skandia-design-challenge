import type { ReactNode } from 'react';
import { SkLogo } from '../design-system';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children: ReactNode;
}

/** Page frame shared by the three views: brand header and a single content column. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SkLogo />
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
