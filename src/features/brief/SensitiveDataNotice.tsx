import { SkAlert } from '../../design-system';
import type { SensitiveScan } from '../../domain/sensitive-data/sensitive-data';
import { describeFindings } from '../shared/format';
import styles from './BriefView.module.css';

export interface SensitiveDataNoticeProps {
  scan: SensitiveScan;
}

/** Tells the person what was hidden and shows the exact text the platform works with. */
export function SensitiveDataNotice({ scan }: SensitiveDataNoticeProps) {
  if (scan.findings.length === 0) return null;

  return (
    <section className={styles.stack} aria-label="Datos de clientes ocultos">
      <SkAlert
        title="Ocultamos datos de clientes"
        message={`Encontramos ${describeFindings(scan.findings)}. Los cambiamos por una etiqueta antes de continuar, así no salen de tu navegador.`}
      />
      <figure className={styles.redacted}>
        <figcaption>Seguimos con esta versión de tu texto</figcaption>
        <blockquote>{scan.redactedText}</blockquote>
      </figure>
    </section>
  );
}
