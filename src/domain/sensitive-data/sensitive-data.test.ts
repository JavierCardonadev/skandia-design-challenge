import { describe, expect, it } from 'vitest';
import sampleBriefs from '../../data/kit/encargos-de-ejemplo.json';
import { scanSensitiveData } from './sensitive-data';

function kitBrief(id: string): string {
  const brief = sampleBriefs.encargos.find((candidate) => candidate.id === id);
  if (!brief) throw new Error(`Sample brief ${id} is not in the kit`);
  return brief.texto;
}

function kinds(text: string): string[] {
  return scanSensitiveData(text).findings.map((finding) => finding.kind);
}

describe('scanSensitiveData on the kit sample briefs', () => {
  it.each(['E1', 'E2', 'E5', 'E6'])(
    'finds nothing to hide in %s and keeps the text intact',
    (id) => {
      const text = kitBrief(id);

      expect(scanSensitiveData(text)).toEqual({ findings: [], redactedText: text });
    },
  );

  it('hides the name, id and balance of a client (E3)', () => {
    const scan = scanSensitiveData(kitBrief('E3'));

    expect(scan.findings.map((finding) => finding.kind)).toEqual([
      'person-name',
      'national-id',
      'balance',
    ]);
    expect(scan.redactedText).toBe(
      'Quiero un simulador de aportes. Por ejemplo, [nombre oculto], cédula [cédula oculta], ' +
        'tiene un saldo de [saldo oculto] y nos escribió porque no sabe cuánto aportar.',
    );
  });

  it('hides less obvious contact details: email and mobile number (E4)', () => {
    const scan = scanSensitiveData(kitBrief('E4'));

    expect(scan.findings.map((finding) => finding.kind)).toEqual(['email', 'phone']);
    expect(scan.redactedText).toBe(
      'Simulador de aportes para el fondo voluntario, en la app. Mi correo es [correo oculto] ' +
        'y el celular del cliente que lo pidió es [celular oculto].',
    );
  });

  it('reports offsets that point at the original value', () => {
    const text = kitBrief('E3');
    const [name] = scanSensitiveData(text).findings;

    expect(name && text.slice(name.start, name.end)).toBe('Mariana Ejemplo');
  });
});

describe('scanSensitiveData rules', () => {
  it('leaves amounts that are not a balance, such as prices and targets', () => {
    expect(kinds('Aportes de $200.000 al mes y una meta de $38.200.000 en 10 años.')).toEqual([]);
  });

  it('leaves capitalised words when no personal detail is nearby', () => {
    expect(kinds('El Product Owner de Skandia Colombia quiere un simulador.')).toEqual([]);
  });

  it('does not take product names for people, even next to a balance', () => {
    const scan = scanSensitiveData('Fondo Voluntario tiene saldo de 12 millones');

    expect(scan.redactedText).toBe('Fondo Voluntario tiene saldo de [saldo oculto]');
  });

  it('hides an id introduced by a keyword and a number with country code', () => {
    const scan = scanSensitiveData(
      'El cliente con cc 79456123 llamó. Escribir al +57 310-555-0199.',
    );

    expect(scan.redactedText).toBe(
      'El cliente con cc [cédula oculta] llamó. Escribir al [celular oculto].',
    );
  });

  it('ignores short numbers after an id keyword', () => {
    expect(kinds('Revisa el documento 2026 del área.')).toEqual([]);
  });

  it('hides a long dot-grouped number even without a keyword', () => {
    expect(kinds('Nos escribió 1.032.456.789 por el chat.')).toEqual(['national-id']);
  });

  it('hides a name that sits in the same sentence as a personal detail', () => {
    const scan = scanSensitiveData('Ana María Pérez pidió ayuda. Su correo es ana@ejemplo.com.');

    // The name is in a sentence with no other personal detail, so only the email is hidden.
    expect(scan.redactedText).toBe('Ana María Pérez pidió ayuda. Su correo es [correo oculto].');
    expect(kinds('Ana María Pérez, correo ana@ejemplo.com')).toEqual(['person-name', 'email']);
  });
});
