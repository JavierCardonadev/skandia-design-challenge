import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../../domain/capabilities/kit-catalog';
import type { SimulatedOutcome } from '../../domain/capabilities/types';
import type { VerdictWriter } from '../../domain/result/verdict';
import { createRun, runReducer, type Run, type RunEvent } from '../../domain/run/run';
import { kitResult, timeoutFailure } from '../../test/fixtures';
import { clickSkButton } from '../../test/sk';
import { countSources, describeSourceCounts } from './result-copy';
import { ResultView } from './ResultView';

const FULL_PLAN = ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion'];

function finish(id: string, outcome: SimulatedOutcome = 'normal'): RunEvent[] {
  return [
    { type: 'step-started', capabilityId: id },
    { type: 'step-completed', capabilityId: id, result: kitResult(id, outcome) },
    { type: 'step-approved', capabilityId: id },
  ];
}

function runOf(plan: string[], events: RunEvent[]): Run {
  return events.reduce(runReducer, createRun(kitCatalog, plan));
}

function renderResult(run: Run) {
  const handlers = { onChangePlan: vi.fn(), onRestart: vi.fn(), onSave: vi.fn() };
  render(
    <ResultView
      catalog={kitCatalog}
      run={run}
      needSummary="Quieres saber si vale la pena un simulador."
      {...handlers}
    />,
  );
  return handlers;
}

describe('ResultView: a well grounded result', () => {
  const run = runOf(
    FULL_PLAN,
    FULL_PLAN.flatMap((id) => finish(id)),
  );

  it('opens with what the person can do and how far to trust it', () => {
    renderResult(run);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Tienes respaldo para dar el siguiente paso' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tu encargo: Quieres saber si vale la pena un simulador.'),
    ).toBeVisible();
    expect(
      screen.getByText(/Este resultado se apoya en 5 fuentes reales\. Las reacciones/),
    ).toBeVisible();
    expect(
      screen.getByText('Se apoya en 5 fuentes reales, 1 simulada y 3 elaboradas por IA.'),
    ).toBeInTheDocument();
  });

  it('says who produced each part and whether a person reviewed it', () => {
    renderResult(run);
    const sections = screen.getByRole('region', { name: 'Qué produjo cada paso' });

    expect(within(sections).getAllByRole('article')).toHaveLength(5);
    expect(
      within(sections).getByText(
        /Lo elaboró el agente Mike con IA\. Tú lo revisaste y aprobaste\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(sections).getByText(
        /Lo elaboró un panel de clientes simulados con IA\. No necesitó revisión de una persona\./,
      ),
    ).toBeInTheDocument();
  });

  it('traces every source to the steps that rely on it', () => {
    renderResult(run);
    const table = screen.getByRole('table');
    const row = (id: string) => within(table).getByRole('rowheader', { name: id }).closest('tr');

    expect(within(table).getAllByRole('row')).toHaveLength(10);
    expect(row('F4')).toHaveTextContent('Fuente real');
    expect(row('F4')).toHaveTextContent('Investigación, Estrategia');
    expect(row('F5')).toHaveTextContent('Simulado');
    expect(row('PRD')).toHaveTextContent('Elaborado por IA');
  });

  it('gathers the warnings with the step they come from', () => {
    renderResult(run);
    const warnings = screen.getByRole('region', { name: 'Ten en cuenta' });

    expect(within(warnings).getAllByRole('listitem')).toHaveLength(2);
    expect(warnings).toHaveTextContent('(Validación sintética)');
  });

  it('offers to save it, go back to the plan or start over', () => {
    const { onSave, onChangePlan, onRestart } = renderResult(run);

    clickSkButton('Guardar o imprimir');
    clickSkButton('Volver al plan');
    clickSkButton('Empezar otro encargo');

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onChangePlan).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('prints the page when no other way of saving is given', () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(
      <ResultView
        catalog={kitCatalog}
        run={run}
        needSummary="Un simulador"
        onChangePlan={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    clickSkButton('Guardar o imprimir');

    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('ResultView: weak evidence', () => {
  it('says plainly that the result guides but does not confirm', () => {
    renderResult(
      runOf(
        FULL_PLAN,
        FULL_PLAN.flatMap((id) => finish(id, 'weakEvidence')),
      ),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Aún falta respaldo para decidir con confianza',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hay 2 fuentes reales y la evidencia es débil\. Sirve para orientarte/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los propios resultados sugieren repetir o sumar: Prototipado, Validación sintética.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when everything comes from simulated users', () => {
    renderResult(runOf(['validacion'], finish('validacion')));

    expect(
      screen.getByText(/viene de clientes simulados o de contenido elaborado por IA/),
    ).toBeVisible();
    expect(screen.getByText('Se apoya en 1 fuente simulada.')).toBeInTheDocument();
  });
});

describe('ResultView: an incomplete run', () => {
  const failFirst: RunEvent[] = [
    { type: 'step-started', capabilityId: 'investigacion' },
    { type: 'step-failed', capabilityId: 'investigacion', failure: timeoutFailure },
    { type: 'step-skipped', capabilityId: 'investigacion' },
  ];

  it('does not pass for complete: it names what did not run', () => {
    renderResult(runOf(FULL_PLAN, [...failFirst, ...finish('validacion')]));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Tu resultado quedó incompleto' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No se ejecutaron 4 pasos del plan\./)).toBeInTheDocument();
    expect(
      screen.getByText('No se ejecutó: Investigación, Contenido, Estrategia, Prototipado.'),
    ).toBeInTheDocument();
  });

  it('uses the singular when a single step is missing', () => {
    const run = runOf(['investigacion', 'validacion'], [...failFirst, ...finish('validacion')]);
    renderResult(run);

    expect(screen.getByText(/No se ejecutó 1 paso del plan\./)).toBeInTheDocument();
  });

  it('sends the person back to the plan when nothing was completed', () => {
    const { onChangePlan } = renderResult(runOf(['investigacion'], failFirst));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Todavía no hay un resultado' }),
    ).toBeInTheDocument();
    clickSkButton('Volver al plan');
    expect(onChangePlan).toHaveBeenCalledTimes(1);
  });
});

describe('describeSourceCounts', () => {
  it('leaves out the kinds of source that are not present', () => {
    expect(describeSourceCounts({ real: 2, simulated: 0, aiMade: 0 })).toBe('2 fuentes reales');
    expect(describeSourceCounts({ real: 1, simulated: 0, aiMade: 1 })).toBe(
      '1 fuente real y 1 elaborada por IA',
    );
    expect(describeSourceCounts({ real: 0, simulated: 2, aiMade: 0 })).toBe('2 fuentes simuladas');
  });

  it('counts each source once, by what backs it', () => {
    expect(countSources([])).toEqual({ real: 0, simulated: 0, aiMade: 0 });
  });
});

describe('verdict lead without simulated sources', () => {
  it('does not mention simulated clients when there are none', () => {
    renderResult(runOf(['investigacion'], finish('investigacion')));

    expect(screen.getByText('Este resultado se apoya en 4 fuentes reales.')).toBeInTheDocument();
  });
});

describe('ResultView: recommendation written by the model', () => {
  const run = runOf(
    FULL_PLAN,
    FULL_PLAN.flatMap((id) => finish(id)),
  );
  const verdict = {
    decision: 'validate-first',
    headline: 'Hay una necesidad clara, pero falta probar el prototipo con personas.',
    reasons: [
      {
        text: 'La mayoría no sabe cuánto aportar para llegar a una meta.',
        sourceIds: ['F1', 'F2'],
      },
      {
        text: 'Un cliente simulado leyó el rango como una promesa: es una señal.',
        sourceIds: ['F5'],
      },
    ],
    nextStep: 'Puedes probar el prototipo con cinco personas antes de pedir el sprint.',
  };

  function renderWith(writer: VerdictWriter) {
    render(
      <ResultView
        catalog={kitCatalog}
        run={run}
        needSummary="Quieres saber si vale la pena un simulador."
        need="Quiero un simulador de aportes"
        verdictWriter={writer}
        onChangePlan={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
  }

  it("opens with the model's decision, its reasons and the sources behind each one", async () => {
    const write = vi.fn<VerdictWriter['write']>(() => Promise.resolve(verdict));
    renderWith({ write });

    expect(screen.getByRole('status')).toHaveTextContent('Estamos redactando la recomendación');
    expect(
      await screen.findByRole('heading', { level: 1, name: verdict.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText('Validarlo primero')).toBeInTheDocument();
    expect(screen.getByText('(Fuentes: F1, F2)')).toBeInTheDocument();
    expect(screen.getByText(verdict.nextStep)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(write.mock.calls[0]?.[0]).toMatchObject({
      need: 'Quiero un simulador de aportes',
      ruleVerdict: 'ready-to-share',
    });
  });

  it("keeps the evidence signal from the fixed rules next to the model's words", async () => {
    renderWith({ write: () => Promise.resolve(verdict) });

    await screen.findByRole('heading', { level: 1, name: verdict.headline });

    expect(
      screen.getByText('Se apoya en 5 fuentes reales, 1 simulada y 3 elaboradas por IA.'),
    ).toBeInTheDocument();
  });

  it('discards a verdict that cites sources the result does not have', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invented = { ...verdict, reasons: [{ text: 'Lo dice un estudio.', sourceIds: ['F99'] }] };
    renderWith({ write: () => Promise.resolve(invented) });

    expect(await screen.findByText(/No pudimos redactar la recomendación con IA/)).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tienes respaldo para dar el siguiente paso' }),
    ).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('Model verdict discarded:', [
      'reasons.0: cites unknown sources F99',
    ]);
    warn.mockRestore();
  });

  it('falls back to the evidence rules when the model cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderWith({ write: () => Promise.reject(new Error('offline')) });

    expect(await screen.findByText(/No pudimos redactar la recomendación con IA/)).toBeVisible();
    expect(screen.getByText(/Puedes guardarlo y llevarlo a tu equipo/)).toBeInTheDocument();
    warn.mockRestore();
  });

  it('stops listening when the view goes away before the model answers', () => {
    const signals: (AbortSignal | undefined)[] = [];
    const { unmount } = render(
      <ResultView
        catalog={kitCatalog}
        run={run}
        needSummary="Un simulador"
        verdictWriter={{
          write: (_input, signal) => {
            signals.push(signal);
            return new Promise(() => undefined);
          },
        }}
        onChangePlan={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    unmount();

    expect(signals[0]?.aborted).toBe(true);
  });
});
