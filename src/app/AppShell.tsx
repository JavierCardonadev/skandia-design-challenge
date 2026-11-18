import type { ReactNode } from 'react';
import { SkLogo } from '../design-system';
import { StageNav, type Stage } from './StageNav';
import styles from './AppShell.module.css';

export interface AppShellProps {
  stage: Stage;
  children: ReactNode;
}

/** Page frame shared by the three views: brand, where the person is, and one content column. */
export function AppShell({ stage, children }: AppShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SkLogo />
        <StageNav current={stage} />
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
