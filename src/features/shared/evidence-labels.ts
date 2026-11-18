import type { EvidenceLevel, EvidenceSource, SourceKind } from '../../domain/capabilities/types';
import { isRealSource } from '../../domain/evidence/evidence';

type Tone = 'info' | 'success' | 'warning' | 'error';

/** How each evidence level is named for someone who does not work with research. */
export const EVIDENCE_LEVELS: Record<EvidenceLevel, { label: string; tone: Tone }> = {
  high: { label: 'Evidencia sólida', tone: 'success' },
  medium: { label: 'Evidencia parcial', tone: 'info' },
  low: { label: 'Evidencia débil', tone: 'warning' },
};

export const SOURCE_KINDS: Record<SourceKind, string> = {
  qualitative: 'Conversaciones o pruebas con personas',
  quantitative: 'Datos de uso o encuestas',
  benchmark: 'Revisión de otras compañías',
  guideline: 'Regla interna o regulatoria',
  synthetic: 'Clientes simulados por IA',
  generated: 'Elaborado por IA a partir de otros pasos',
};

/** The one thing a non-expert needs to know about a source: is anything real behind it? */
export function sourceOrigin(source: EvidenceSource): { label: string; tone: Tone } {
  if (isRealSource(source)) return { label: 'Fuente real', tone: 'success' };
  if (source.isSynthetic) return { label: 'Simulado', tone: 'warning' };
  return { label: 'Elaborado por IA', tone: 'info' };
}
