import type { ContentShape } from '../../domain/capabilities/content-shape';
import styles from './shared.module.css';

/** Field names the catalog writes without accents; everything else is derived from the key. */
const LABEL_OVERRIDES: Partial<Record<string, string>> = {
  comprension: 'Comprensión',
  descripcion: 'Descripción',
  justificacion: 'Justificación',
  reaccion: 'Reacción',
  tecnico: 'Técnico',
  jerarquia: 'Jerarquía',
  criteriosDeExito: 'Criterios de éxito',
};

/** "respuestaCorta" → "Respuesta corta". */
export function fieldLabel(key: string): string {
  const words = key.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2').toLowerCase();
  return LABEL_OVERRIDES[key] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type GroupShape = Extract<ContentShape, { kind: 'group' }>;

function Fields({ shape, value }: { shape: GroupShape; value: unknown }) {
  const record = isRecord(value) ? value : {};
  return (
    <dl className={styles.fields}>
      {Object.entries(shape.fields).map(([key, fieldShape]) => (
        <div key={key} className={styles.field}>
          <dt>{fieldLabel(key)}</dt>
          <dd>
            <Value shape={fieldShape} value={record[key]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Value({ shape, value }: { shape: ContentShape; value: unknown }) {
  switch (shape.kind) {
    case 'text':
    case 'number':
    case 'choice':
      return <>{typeof value === 'string' || typeof value === 'number' ? value : ''}</>;
    case 'group':
      return <Fields shape={shape} value={value} />;
    case 'list': {
      const items: unknown[] = Array.isArray(value) ? value : [];
      if (items.length === 0) return <span className={styles.muted}>Nada por ahora</span>;
      return (
        <ul className={shape.item.kind === 'group' ? styles.records : styles.bullets}>
          {items.map((item, index) => (
            // Items have no stable identity in the contract and are never reordered.
            <li key={index}>
              <Value shape={shape.item} value={item} />
            </li>
          ))}
        </ul>
      );
    }
  }
}

export interface ContentViewProps {
  shape: ContentShape;
  content: unknown;
}

/**
 * Renders any capability's content from its shape. No capability has its own
 * component: a new one shows up correctly as soon as it is in the catalog.
 */
export function ContentView({ shape, content }: ContentViewProps) {
  return <Value shape={shape} value={content} />;
}
