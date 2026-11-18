import type { Capability } from '../../domain/capabilities/types';
import type { SensitiveFinding, SensitiveKind } from '../../domain/sensitive-data/sensitive-data';

const SECONDS_PER_MINUTE = 60;

function toMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
}

function minutesRange(minSeconds: number, maxSeconds: number): string {
  const min = toMinutes(minSeconds);
  const max = toMinutes(maxSeconds);
  return min === max ? `unos ${max} min` : `entre ${min} y ${max} min`;
}

/** "entre 2 y 5 min": how long one capability typically takes. */
export function formatTypicalDuration(capability: Capability): string {
  const { minSeconds, maxSeconds } = capability.typicalDuration;
  return minutesRange(minSeconds, maxSeconds);
}

/** The typical duration of a whole plan, steps running one after another. */
export function formatPlanDuration(capabilities: readonly Capability[]): string {
  const total = (pick: (c: Capability) => number) =>
    capabilities.reduce((sum, capability) => sum + pick(capability), 0);
  return minutesRange(
    total((c) => c.typicalDuration.minSeconds),
    total((c) => c.typicalDuration.maxSeconds),
  );
}

const KIND_NAMES: Record<SensitiveKind, readonly [singular: string, plural: string]> = {
  'person-name': ['nombre', 'nombres'],
  'national-id': ['cédula', 'cédulas'],
  balance: ['saldo', 'saldos'],
  email: ['correo', 'correos'],
  phone: ['celular', 'celulares'],
};

function joinInSpanish(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1) ?? ''}`;
}

/** "1 nombre, 1 cédula y 1 saldo": what was hidden, without repeating the values. */
export function describeFindings(findings: readonly SensitiveFinding[]): string {
  const counts = new Map<SensitiveKind, number>();
  for (const finding of findings) counts.set(finding.kind, (counts.get(finding.kind) ?? 0) + 1);

  return joinInSpanish(
    [...counts].map(([kind, count]) => `${count} ${KIND_NAMES[kind][count === 1 ? 0 : 1]}`),
  );
}
