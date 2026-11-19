import { SkButton, SkCard } from '../../design-system';
import styles from './HistoryList.module.css';

export interface HistoryItem {
  id: string;
  finishedAt: string;
  needSummary: string;
}

export interface HistoryListProps {
  entries: readonly HistoryItem[];
  onOpen: (id: string) => void;
  onClear: () => void;
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** The latest results, kept in this browser, so a finished brief can be opened again. */
export function HistoryList({ entries, onOpen, onClear }: HistoryListProps) {
  if (entries.length === 0) return null;

  return (
    <SkCard>
      <section className={styles.stack} aria-labelledby="history-title">
        <h2 id="history-title">Tus resultados anteriores</h2>
        <p className={styles.muted}>
          Se guardan solo en este navegador y sin datos de clientes. Puedes borrarlos cuando
          quieras.
        </p>
        <ul className={styles.entries}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <div>
                <p>{entry.needSummary}</p>
                <p className={styles.muted}>
                  <time dateTime={entry.finishedAt}>
                    {dateFormat.format(new Date(entry.finishedAt))}
                  </time>
                </p>
              </div>
              <SkButton
                label="Ver resultado"
                ariaLabel={`Ver resultado: ${entry.needSummary}`}
                variant="secondary"
                size="small"
                fullWidth={false}
                onClick={() => {
                  onOpen(entry.id);
                }}
              />
            </li>
          ))}
        </ul>
        <SkButton
          label="Borrar resultados guardados"
          variant="tertiary"
          size="small"
          fullWidth={false}
          onClick={onClear}
        />
      </section>
    </SkCard>
  );
}
