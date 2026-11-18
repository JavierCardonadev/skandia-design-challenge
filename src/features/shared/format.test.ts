import { describe, expect, it } from 'vitest';
import { kitCapability } from '../../test/fixtures';
import { describeFindings, formatPlanDuration, formatTypicalDuration } from './format';

describe('formatTypicalDuration', () => {
  it('shows the typical range in minutes', () => {
    expect(formatTypicalDuration(kitCapability('investigacion'))).toBe('entre 2 y 5 min');
    expect(formatTypicalDuration(kitCapability('validacion'))).toBe('entre 1 y 3 min');
  });

  it('shows a single figure when both ends round to the same minute', () => {
    const quick = {
      ...kitCapability('validacion'),
      typicalDuration: { minSeconds: 10, maxSeconds: 40 },
    };

    expect(formatTypicalDuration(quick)).toBe('unos 1 min');
  });
});

describe('formatPlanDuration', () => {
  it('adds up the steps of the plan', () => {
    const plan = ['investigacion', 'contenido', 'validacion'].map(kitCapability);

    expect(formatPlanDuration(plan)).toBe('entre 4 y 11 min');
  });
});

describe('describeFindings', () => {
  const finding = (kind: 'person-name' | 'national-id' | 'balance' | 'email' | 'phone') => ({
    kind,
    start: 0,
    end: 1,
  });

  it('names a single kind of data', () => {
    expect(describeFindings([finding('email')])).toBe('1 correo');
  });

  it('counts and joins several kinds in natural Spanish', () => {
    expect(describeFindings([finding('email'), finding('phone')])).toBe('1 correo y 1 celular');
    expect(
      describeFindings([
        finding('person-name'),
        finding('national-id'),
        finding('national-id'),
        finding('balance'),
      ]),
    ).toBe('1 nombre, 2 cédulas y 1 saldo');
  });

  it('describes nothing when there are no findings', () => {
    expect(describeFindings([])).toBe('');
  });
});
