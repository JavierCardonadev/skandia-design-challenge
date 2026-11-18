export type SensitiveKind = 'national-id' | 'phone' | 'email' | 'balance' | 'person-name';

export interface SensitiveFinding {
  kind: SensitiveKind;
  /** Offsets in the original text. The value itself is never copied out of it. */
  start: number;
  end: number;
}

export interface SensitiveScan {
  findings: SensitiveFinding[];
  /** The text with every finding replaced by a placeholder; the only version that may leave the browser. */
  redactedText: string;
}

/** Placeholders are read by the person and by the model, so they are written in Spanish. */
export const REDACTION_LABELS: Record<SensitiveKind, string> = {
  'national-id': '[cédula oculta]',
  phone: '[celular oculto]',
  email: '[correo oculto]',
  balance: '[saldo oculto]',
  'person-name': '[nombre oculto]',
};

interface Detector {
  kind: SensitiveKind;
  /** Must be global, expose indices (`d`) and capture the sensitive part as `value`. */
  pattern: RegExp;
  accepts?: (value: string) => boolean;
}

const MIN_ID_DIGITS = 6;
const hasIdLength = (value: string) => value.replace(/\D/g, '').length >= MIN_ID_DIGITS;

/*
 * Deterministic on purpose: the text cannot be sent to a model to find out whether
 * it is safe to send. Ordered by priority; an earlier detector wins an overlap.
 */
const DETECTORS: readonly Detector[] = [
  { kind: 'email', pattern: /(?<value>[\p{L}\d._%+-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+)/dgu },
  {
    // An amount is personal only as someone's balance; prices and targets are left alone.
    kind: 'balance',
    pattern: /saldo[^\d$]{0,40}(?<value>(?:\$\s?)?\d+(?:[.,]\d+)*(?:\s?(?:millones|pesos))?)/dgiu,
  },
  {
    kind: 'national-id',
    pattern:
      /(?<!\p{L})(?:c[ée]dula|c\.\s?c\.|cc|documento|identificaci[óo]n)\D{0,20}(?<value>\d+(?:\.\d+)*)/dgiu,
    accepts: hasIdLength,
  },
  {
    // Colombian mobile numbers: ten digits starting with 3, optionally with the country code.
    kind: 'phone',
    pattern: /(?<![\d.])(?<value>(?:\+?57[\s-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4})(?!\d)/dgu,
  },
  {
    // A long dot-grouped number that is not money is treated as an id: hiding too much is the safe error.
    kind: 'national-id',
    pattern: /(?<![\d.$])(?<!\$\s)(?<value>\d{1,3}(?:\.\d{3}){2,3})(?!\.?\d)/dgu,
  },
];

const PERSON_NAME: Detector = {
  kind: 'person-name',
  pattern: /(?<!\p{L})(?<value>\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){1,3})(?!\p{L})/dgu,
  accepts: (value) => !value.split(/\s+/).every((word) => PRODUCT_WORDS.has(word.toLowerCase())),
};

/** Capitalised product vocabulary that reads like a name but is not one. */
const PRODUCT_WORDS = new Set(['fondo', 'voluntario', 'obligatorio', 'pensiones', 'skandia']);

function findMatches(detector: Detector, text: string, offset = 0): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const match of text.matchAll(detector.pattern)) {
    const value = match.groups?.value;
    const range = match.indices?.groups?.value;
    if (value === undefined || range === undefined) continue;
    if (detector.accepts && !detector.accepts(value)) continue;
    findings.push({ kind: detector.kind, start: offset + range[0], end: offset + range[1] });
  }
  return findings;
}

function overlapsAny(finding: SensitiveFinding, accepted: readonly SensitiveFinding[]): boolean {
  return accepted.some((other) => finding.start < other.end && other.start < finding.end);
}

function sentenceRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?]+(?=\s|$)/g)) {
    const end = match.index + match[0].length;
    ranges.push([start, end]);
    start = end;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges;
}

/**
 * A name alone is not sensitive ("Skandia", "Product Owner"); a name next to an id,
 * a balance or a contact detail is. Names are searched only in such sentences.
 */
function findPersonNames(
  text: string,
  identifiers: readonly SensitiveFinding[],
): SensitiveFinding[] {
  return sentenceRanges(text)
    .filter(([start, end]) => identifiers.some((f) => f.start >= start && f.end <= end))
    .flatMap(([start, end]) => findMatches(PERSON_NAME, text.slice(start, end), start));
}

function redact(text: string, findings: readonly SensitiveFinding[]): string {
  let redacted = '';
  let cursor = 0;
  for (const finding of findings) {
    redacted += text.slice(cursor, finding.start) + REDACTION_LABELS[finding.kind];
    cursor = finding.end;
  }
  return redacted + text.slice(cursor);
}

/** Finds client data in a brief and returns a version that is safe to send to a model. */
export function scanSensitiveData(text: string): SensitiveScan {
  const accepted: SensitiveFinding[] = [];
  const accept = (candidates: SensitiveFinding[]) => {
    for (const candidate of candidates) {
      if (!overlapsAny(candidate, accepted)) accepted.push(candidate);
    }
  };

  for (const detector of DETECTORS) accept(findMatches(detector, text));
  accept(findPersonNames(text, accepted));

  const findings = [...accepted].sort((a, b) => a.start - b.start);
  return { findings, redactedText: redact(text, findings) };
}
