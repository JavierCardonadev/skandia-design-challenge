import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { kitCatalog } from '../../domain/capabilities/kit-catalog';
import type { SimulatedOutcome } from '../../domain/capabilities/types';
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
    expect(screen.getByText('Se apoya en 1 simulada.')).toBeInTheDocument();
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
    expect(describeSourceCounts({ real: 0, simulated: 2, aiMade: 0 })).toBe('2 simuladas');
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
