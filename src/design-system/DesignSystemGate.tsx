import { useEffect, useState, type ReactNode } from 'react';
import styles from './DesignSystemGate.module.css';

/** Element used to detect that the sk-* bundle has registered its components. */
const PROBE_ELEMENT = 'sk-button';
const DEFAULT_TIMEOUT_MS = 8000;

type DesignSystemStatus = 'loading' | 'ready' | 'unavailable';

function useDesignSystemStatus(timeoutMs: number): DesignSystemStatus {
  const [status, setStatus] = useState<DesignSystemStatus>(() =>
    customElements.get(PROBE_ELEMENT) ? 'ready' : 'loading',
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setStatus((current) => (current === 'loading' ? 'unavailable' : current));
    }, timeoutMs);

    // A slow bundle still wins after the timeout: the app recovers on its own.
    void customElements.whenDefined(PROBE_ELEMENT).then(() => {
      if (!active) return;
      clearTimeout(timer);
      setStatus('ready');
    });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [timeoutMs]);

  return status;
}

export interface DesignSystemGateProps {
  children: ReactNode;
  timeoutMs?: number;
  onRetry?: () => void;
}

/**
 * Mounts the app only once the sk-* custom elements are defined. Rendering them
 * earlier leaves their children outside the component (see the kit's usage rules).
 * The bundle is remote and unversioned, so a calm fallback covers the failure case.
 */
export function DesignSystemGate({
  children,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onRetry = () => {
    window.location.reload();
  },
}: DesignSystemGateProps) {
  const status = useDesignSystemStatus(timeoutMs);

  if (status === 'ready') return <>{children}</>;

  if (status === 'loading') {
    return (
      <p role="status" className={styles.message}>
        Estamos preparando todo. Tarda solo un momento.
      </p>
    );
  }

  return (
    <div role="alert" className={styles.message}>
      <p>Parece que algo no salió bien al cargar la página. Puedes intentarlo de nuevo.</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Intentar de nuevo
      </button>
    </div>
  );
}
