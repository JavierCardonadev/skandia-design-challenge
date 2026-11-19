import { describe, expect, it } from 'vitest';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { finishedRun, FULL_PLAN } from '../test/fixtures';
import {
  addToHistory,
  createSessionStore,
  EMPTY_SNAPSHOT,
  MAX_HISTORY,
  type HistoryEntry,
  type SessionSnapshot,
} from './session-store';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
    key: () => null,
    get length() {
      return items.size;
    },
  };
}

const brief = {
  summary: 'Quieres saber si vale la pena un simulador.',
  facts: [{ label: 'Producto', value: 'Fondo Voluntario', isAssumption: false }],
  questions: [],
  steps: FULL_PLAN.map((capabilityId) => ({ capabilityId, reason: '', addedByPlatform: false })),
};

function entry(id: string): HistoryEntry {
  return {
    id,
    finishedAt: '2026-11-19T15:00:00.000Z',
    needSummary: `Encargo ${id}`,
    run: finishedRun(['validacion']),
  };
}

const snapshot: SessionSnapshot = {
  scenario: 'failure',
  brief: {
    text: 'Quiero un simulador',
    answers: {},
    brief,
    stepIds: FULL_PLAN,
    usedFallback: false,
  },
  confirmed: { brief, stepIds: FULL_PLAN, need: 'Quiero un simulador' },
  run: finishedRun(['investigacion']),
  finishedRun: finishedRun(FULL_PLAN),
  history: [entry('a')],
};

function stored(storage: Storage): Record<string, unknown> {
  return JSON.parse(storage.getItem('skandia-platform') ?? '{}') as Record<string, unknown>;
}

describe('createSessionStore', () => {
  it('gives back exactly what was saved', () => {
    const store = createSessionStore(memoryStorage());

    store.save(snapshot);

    expect(store.load(kitCatalog)).toEqual(snapshot);
  });

  it('starts empty when nothing was saved', () => {
    expect(createSessionStore(memoryStorage()).load(kitCatalog)).toEqual(EMPTY_SNAPSHOT);
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['another version of the stored shape', JSON.stringify({ ...snapshot, version: 0 })],
    ['a shape edited by hand', JSON.stringify({ version: 1, ...snapshot, scenario: 'chaos' })],
    [
      'a history entry with a date that is not one',
      JSON.stringify({ version: 1, ...snapshot, history: [{ ...entry('a'), finishedAt: 'ayer' }] }),
    ],
  ])('discards %s', (_case, raw) => {
    const store = createSessionStore(memoryStorage({ 'skandia-platform': raw }));

    expect(store.load(kitCatalog)).toEqual(EMPTY_SNAPSHOT);
  });

  it('discards a session that uses a capability the catalog no longer has', () => {
    const storage = memoryStorage();
    const store = createSessionStore(storage);
    store.save({
      ...snapshot,
      brief: { text: '', answers: {}, brief, stepIds: ['traduccion'], usedFallback: false },
    });

    expect(store.load(kitCatalog)).toEqual(EMPTY_SNAPSHOT);
  });

  it('stamps what it saves with a version', () => {
    const storage = memoryStorage();

    createSessionStore(storage).save(EMPTY_SNAPSHOT);

    expect(stored(storage)).toMatchObject({ version: 1, scenario: 'normal' });
  });

  it('works without storage: nothing is remembered and nothing breaks', () => {
    const store = createSessionStore(null);

    store.save(snapshot);

    expect(store.load(kitCatalog)).toEqual(EMPTY_SNAPSHOT);
  });

  it('never lets a failing storage break the flow', () => {
    const failing = memoryStorage();
    failing.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    failing.getItem = () => {
      throw new Error('SecurityError');
    };
    const store = createSessionStore(failing);

    expect(() => {
      store.save(snapshot);
    }).not.toThrow();
    expect(store.load(kitCatalog)).toEqual(EMPTY_SNAPSHOT);
  });

  it('uses the browser storage by default', () => {
    window.localStorage.clear();

    createSessionStore().save({ ...EMPTY_SNAPSHOT, scenario: 'delay' });

    expect(stored(window.localStorage)).toMatchObject({ scenario: 'delay' });
    window.localStorage.clear();
  });
});

describe('addToHistory', () => {
  it('puts the newest result first', () => {
    expect(addToHistory([entry('a')], entry('b')).map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('does not repeat a result that is already there', () => {
    expect(addToHistory([entry('a'), entry('b')], entry('b')).map((item) => item.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('keeps only the latest few', () => {
    const full = ['a', 'b', 'c', 'd', 'e'].map(entry);

    const history = addToHistory(full, entry('f'));

    expect(history).toHaveLength(MAX_HISTORY);
    expect(history.map((item) => item.id)).toEqual(['f', 'a', 'b', 'c', 'd']);
  });
});
