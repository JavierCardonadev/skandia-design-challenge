import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../../domain/capabilities/kit-catalog';
import type { CompletedResult } from '../../domain/capabilities/types';
import type { CapabilityProvider, CapabilityRequest } from '../../domain/providers/provider';
import {
  createSimulatedProvider,
  type SimulationScript,
} from '../../domain/providers/simulated-provider';
import { kitCapability } from '../../test/fixtures';
import { clickSkButton, skElement, skElements, typeIntoSk } from '../../test/sk';
import { buildSimulationScript } from '../demo/scenarios';
import { RunView } from './RunView';

const FULL_PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];
const AWAITING_REVIEW = 'Espera tu revisión';

interface RenderOptions {
  stepIds?: string[];
  script?: SimulationScript;
  provider?: CapabilityProvider;
  speedFactor?: number;
}

function renderRun(options: RenderOptions = {}) {
  const { stepIds = FULL_PLAN, script, speedFactor = 1 } = options;
  const requests: CapabilityRequest[] = [];
  const simulated =
    options.provider ?? createSimulatedProvider({ script, wait: () => Promise.resolve() });
  const provider: CapabilityProvider = {
    run: (request) => {
      requests.push(request);
      return simulated.run(request);
    },
  };
  const onBack = vi.fn<() => void>();
  const onFinish = vi.fn<(results: CompletedResult[]) => void>();
  const view = render(
    <RunView
      catalog={kitCatalog}
      stepIds={stepIds}
      provider={provider}
      speedFactor={speedFactor}
      onBack={onBack}
      onFinish={onFinish}
    />,
  );
  return { ...view, requests, onBack, onFinish };
}

/** A provider whose answers are released by the test. */
function manualProvider() {
  const pending: ((answer: unknown) => void)[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const provider: CapabilityProvider = {
    run: ({ signal }) => {
      signals.push(signal);
      return new Promise((resolve) => {
        pending.push(resolve);
      });
    },
  };
  const answer = async (response: unknown) => {
    await act(async () => {
      pending.shift()?.(response);
      await Promise.resolve();
    });
  };
  return { provider, signals, answer };
}

function statusLines(): string[] {
  return screen
    .getAllByRole('listitem')
    .filter((item) => item.hasAttribute('data-status'))
    .map((item) => item.getAttribute('data-status') ?? '');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RunView: progress', () => {
  it('starts the first step at once and tells how long it usually takes', () => {
    const { provider } = manualProvider();
    renderRun({ provider });

    expect(screen.getByRole('heading', { level: 1, name: 'Tu plan está en marcha' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Paso 1 de 5 en curso.');
    expect(screen.getByText('En curso. Suele tardar entre 2 y 5 min.')).toBeInTheDocument();
    expect(statusLines()).toEqual(['running', 'pending', 'pending', 'pending', 'pending']);
  });

  it('walks the plan to the end, stopping only where a review is required', async () => {
    const { onFinish, requests } = renderRun();

    for (let review = 0; review < 3; review += 1) {
      await screen.findByText(AWAITING_REVIEW);
      clickSkButton('Aprobar y seguir');
    }

    expect(await screen.findByRole('heading', { name: 'Tu plan terminó' })).toBeInTheDocument();
    expect(statusLines()).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(screen.getAllByText('Listo. Lo aprobaste.')).toHaveLength(3);
    expect(screen.getAllByText('Listo')).toHaveLength(2);
    expect(requests.map((request) => request.capability.id)).toEqual(FULL_PLAN);

    clickSkButton('Ver el resultado');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toHaveLength(5);
  });

  it('hands the approved outputs to the next capability', async () => {
    const { requests } = renderRun({ stepIds: ['investigacion', 'contenido'] });

    await screen.findByText(AWAITING_REVIEW);
    expect(requests[0]?.upstream).toEqual([]);
    clickSkButton('Aprobar y seguir');
    await screen.findByText(AWAITING_REVIEW);

    expect(requests[1]?.upstream.map((result) => result.capabilityId)).toEqual(['investigacion']);
  });

  it('lets the person leave the run to change the plan', () => {
    const { provider } = manualProvider();
    const { onBack } = renderRun({ provider });

    clickSkButton('Cambiar el plan');

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('cancels the step in flight when the view goes away', () => {
    const { provider, signals } = manualProvider();
    const { unmount } = renderRun({ provider });

    unmount();

    expect(signals.at(-1)?.aborted).toBe(true);
  });
});

describe('RunView: the review checkpoint', () => {
  it('shows what the step delivered, how reliable it is and where it comes from', async () => {
    renderRun();

    await screen.findByText(AWAITING_REVIEW);

    expect(screen.getByRole('status')).toHaveTextContent('Hay un resultado esperando tu revisión.');
    expect(screen.getByText('Evidencia sólida')).toBeInTheDocument();
    expect(
      screen.getByText('Tres fuentes independientes apuntan en la misma dirección.'),
    ).toBeVisible();
    expect(screen.getAllByText('Fuente real')).toHaveLength(4);
    expect(screen.getByText('Respuesta corta')).toBeInTheDocument();
    expect(screen.getByText(/Sí hay una necesidad clara \(H1\)/)).toBeInTheDocument();
    expect(statusLines()).toEqual(['awaiting-review', 'pending', 'pending', 'pending', 'pending']);
  });

  it('redoes the step with the change the person asks for', async () => {
    const { requests } = renderRun();
    await screen.findByText(AWAITING_REVIEW);

    clickSkButton('Pedir un ajuste');
    clickSkButton('Enviar ajuste');
    expect(skElement('sk-textarea')).toHaveAttribute(
      'error-message',
      'Cuéntanos qué cambiar para rehacerlo.',
    );

    typeIntoSk('¿Qué quieres que cambie?', '  Incluye el canal web  ');
    expect(skElement('sk-textarea')).toHaveAttribute('error-message', '');
    clickSkButton('Enviar ajuste');

    expect(await screen.findByText('Tu indicación: «Incluye el canal web»')).toBeInTheDocument();
    expect(requests.at(-1)).toMatchObject({ attempt: 2, adjustmentNote: 'Incluye el canal web' });
    expect(await screen.findByText(AWAITING_REVIEW)).toBeInTheDocument();
  });

  it('lets the person back out of an adjustment', async () => {
    renderRun();
    await screen.findByText(AWAITING_REVIEW);

    clickSkButton('Pedir un ajuste');
    clickSkButton('Cancelar');

    expect(skElements('sk-textarea')).toHaveLength(0);
    expect(skElements('sk-button[label="Aprobar y seguir"]')).toHaveLength(1);
  });

  it('redoes the step from scratch without a note', async () => {
    const { requests } = renderRun();
    await screen.findByText(AWAITING_REVIEW);

    clickSkButton('Rehacer desde cero');
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });

    expect(requests[1]).toMatchObject({ attempt: 2, adjustmentNote: null });
    expect(screen.queryByText(/Tu indicación/)).not.toBeInTheDocument();
  });

  it('keeps what a finished step delivered one click away', async () => {
    renderRun({ stepIds: ['validacion'] });

    await screen.findByRole('heading', { name: 'Tu plan terminó' });

    expect(screen.getByText('Ver lo que entregó')).toBeInTheDocument();
    expect(screen.getByText('Evidencia débil')).toBeInTheDocument();
    expect(screen.getByText('Simulado')).toBeInTheDocument();
    expect(screen.getByText('Ten en cuenta')).toBeInTheDocument();
  });
});

describe('RunView: weak evidence', () => {
  it('says plainly when an output rests on simulated users', async () => {
    renderRun({ script: buildSimulationScript('weak-evidence', FULL_PLAN) });

    await screen.findByText(AWAITING_REVIEW);

    expect(screen.getByText('Evidencia débil')).toBeInTheDocument();
    expect(screen.getByText('Simulado')).toBeInTheDocument();
    expect(
      screen.getByText('H1 viene solo de usuarios simulados: orienta, no confirma.'),
    ).toBeInTheDocument();
  });
});

describe('RunView: failures and delays', () => {
  it('explains a failure in plain words and recovers on retry', async () => {
    renderRun({ script: buildSimulationScript('failure', FULL_PLAN) });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos consultar una de las fuentes');
    expect(alert).toHaveTextContent(
      'Si sigues sin este paso, tampoco se ejecutan: Contenido, Estrategia, Prototipado.',
    );
    expect(alert).not.toHaveTextContent('survey_db');
    expect(screen.getByRole('status')).toHaveTextContent('Un paso necesita tu atención.');

    clickSkButton('Intentar de nuevo');

    expect(await screen.findByText(AWAITING_REVIEW)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('carries on without a failed step and whatever depended on it', async () => {
    const { onFinish } = renderRun({ script: buildSimulationScript('failure', FULL_PLAN) });
    await screen.findByRole('alert');

    clickSkButton('Seguir sin este paso');

    await screen.findByRole('heading', { name: 'Tu plan terminó' });
    expect(statusLines()).toEqual(['skipped', 'skipped', 'skipped', 'skipped', 'done']);
    expect(screen.getAllByText('No se ejecutó')).toHaveLength(4);

    clickSkButton('Ver el resultado');
    expect(onFinish.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('does not offer a retry when trying again cannot help', async () => {
    const content = kitCapability('contenido');
    const provider: CapabilityProvider = {
      run: () => Promise.resolve(content.simulatedResponses.error),
    };
    renderRun({ stepIds: ['contenido'], provider });

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('A este paso le faltó información');
    expect(skElements('sk-button[label="Intentar de nuevo"]')).toHaveLength(0);
    expect(skElements('sk-button[label="Seguir sin este paso"]')).toHaveLength(1);
  });

  it('says so when a step takes longer than usual, and moves on when it answers', async () => {
    vi.useFakeTimers();
    const research = kitCapability('investigacion');
    const { provider, answer } = manualProvider();
    renderRun({ provider, speedFactor: 0.001 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(research.typicalDuration.maxSeconds);
    });
    expect(screen.getByText(/Está tardando más de lo habitual/)).toBeInTheDocument();
    expect(statusLines()[0]).toBe('running');

    await answer(research.simulatedResponses.normal);
    expect(screen.getByText(AWAITING_REVIEW)).toBeInTheDocument();
    expect(screen.queryByText(/Está tardando más de lo habitual/)).not.toBeInTheDocument();
  });
});
