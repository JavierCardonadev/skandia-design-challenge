import { useEffect, useState } from 'react';
import { requireCapability } from '../../domain/capabilities/catalog';
import type { CapabilityCatalog } from '../../domain/capabilities/types';
import type { Deliverable } from '../../domain/result/deliverable';
import {
  requestVerdict,
  toVerdictInput,
  type ModelVerdict,
  type VerdictWriter,
} from '../../domain/result/verdict';

export type ModelVerdictState =
  /** No model is available: the result opens with what the evidence rules say. */
  | { status: 'off' }
  | { status: 'writing' }
  | { status: 'ready'; verdict: ModelVerdict }
  /** The model failed or its verdict did not hold against the evidence. */
  | { status: 'unavailable' };

export interface ModelVerdictOptions {
  writer: VerdictWriter | null;
  deliverable: Deliverable | null;
  need: string;
  catalog: CapabilityCatalog;
}

/**
 * Asks the model to write the recommendation of a result, once per result. A verdict
 * that fails the checks is discarded: the view then falls back to the evidence rules.
 */
export function useModelVerdict(options: ModelVerdictOptions): ModelVerdictState {
  const { writer, deliverable, need, catalog } = options;
  const [state, setState] = useState<ModelVerdictState>({ status: 'off' });

  useEffect(() => {
    if (!writer || !deliverable) return;

    const controller = new AbortController();
    setState({ status: 'writing' });
    void requestVerdict(
      writer,
      deliverable,
      toVerdictInput(deliverable, need, (id) => requireCapability(catalog, id).name),
      controller.signal,
    ).then((outcome) => {
      if (controller.signal.aborted) return;
      if (!outcome.ok) {
        // Kept out of the interface: it is written for whoever maintains the prompt.
        console.warn('Model verdict discarded:', outcome.issues);
      }
      setState(
        outcome.ok ? { status: 'ready', verdict: outcome.verdict } : { status: 'unavailable' },
      );
    });

    return () => {
      controller.abort();
    };
  }, [writer, deliverable, need, catalog]);

  return state;
}
