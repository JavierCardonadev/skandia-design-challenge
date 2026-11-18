import { useEffect, useRef, type ReactNode } from 'react';
import { SkLogo } from '../design-system';
import { StageNav, type Stage } from './StageNav';
import styles from './AppShell.module.css';

export interface AppShellProps {
  stage: Stage;
  children: ReactNode;
}

/** Page frame shared by the three views: brand, where the person is, and one content column. */
export function AppShell({ stage, children }: AppShellProps) {
  const main = useRef<HTMLElement>(null);
  const previousStage = useRef(stage);

  // A new stage replaces the whole view: start reading it from the top, with focus on it.
  useEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;
    main.current?.focus({ preventScroll: true });
    main.current?.scrollIntoView?.({ block: 'start' });
  }, [stage]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SkLogo />
        <StageNav current={stage} />
      </header>
      <main ref={main} tabIndex={-1} className={styles.content}>
        {children}
      </main>
    </div>
  );
}
