import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import sampleBriefs from '../../data/kit/encargos-de-ejemplo.json';
import type { BriefFramer, FramingRequest } from '../../domain/brief/framing';
import { createLocalFramer } from '../../domain/brief/local-framer';
import { kitCatalog } from '../../domain/capabilities/kit-catalog';
import { clickSkButton, skElement, skElements, typeIntoSk } from '../../test/sk';
import { BriefView } from './BriefView';

const NEED_LABEL = 'Tu necesidad';
const PRODUCT_QUESTION = '¿Sobre qué producto o servicio es?';
const localFramer = createLocalFramer(kitCatalog, () => Promise.resolve());

function sample(id: string): string {
  const found = sampleBriefs.encargos.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Sample brief ${id} is not in the kit`);
  return found.texto;
}

/** Wraps the local framer to record what the view actually sends. */
function recordingFramer() {
  const requests: FramingRequest[] = [];
  const framer: BriefFramer = {
    frame: (request) => {
      requests.push(request);
      return localFramer.frame(request);
    },
  };
  return { framer, requests };
}

function renderView(framer: BriefFramer = localFramer) {
  const onStart = vi.fn();
  render(<BriefView catalog={kitCatalog} framers={{ primary: framer }} onStart={onStart} />);
  return { onStart };
}

async function submitNeed(text: string) {
  typeIntoSk(NEED_LABEL, text);
  clickSkButton('Continuar');
  await screen.findByRole('heading', { name: 'Esto fue lo que entendimos' });
}

function planStepNames(): string[] {
  const plan = screen.getByRole('heading', { name: 'Este es el plan que te proponemos' });
  const list = plan.parentElement?.querySelector('ol');
  if (!list) throw new Error('The plan list is not rendered');
  return within(list)
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');
}

describe('BriefView: writing the need', () => {
  it('asks for a need before continuing and clears the message on typing', () => {
    renderView();

    clickSkButton('Continuar');
    expect(skElement('sk-textarea')).toHaveAttribute(
      'error-message',
      'Escribe tu necesidad para continuar.',
    );

    typeIntoSk(NEED_LABEL, 'Quiero un simulador');
    expect(skElement('sk-textarea')).toHaveAttribute('error-message', '');
    expect(skElement('sk-textarea')).toHaveAttribute('value', 'Quiero un simulador');
  });

  it('fills the need with a kit example', () => {
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Necesidad ambigua' }));

    expect(skElement('sk-textarea')).toHaveAttribute('value', sample('E2'));
  });

  it('tells the person it is working while the need is being read', async () => {
    let finish: (answer: unknown) => void = () => undefined;
    const slow: BriefFramer = {
      frame: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    renderView(slow);

    typeIntoSk(NEED_LABEL, sample('E1'));
    clickSkButton('Continuar');

    expect(screen.getByRole('status')).toHaveTextContent('Estamos leyendo tu necesidad');
    expect(skElement('sk-button[label="Continuar"]')).toHaveAttribute('loading');

    finish(await localFramer.frame({ text: sample('E1'), answers: {} }));
    expect(await screen.findByText(/Quieres saber si vale la pena/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('BriefView: a clear need', () => {
  it('plays back what it understood, flags assumptions and proposes the plan', async () => {
    renderView();

    await submitNeed(sample('E1'));

    expect(screen.getByText('Fondo Voluntario de Pensiones')).toBeInTheDocument();
    expect(screen.getByText('Lo supusimos')).toBeInTheDocument();
    expect(planStepNames()).toEqual([
      'Investigación',
      'Contenido',
      'Estrategia',
      'Prototipado',
      'Validación sintética',
    ]);
    expect(screen.getByText(/Tarda entre 9 y 22 min/)).toBeInTheDocument();
    expect(screen.getAllByText('Tú revisas el resultado')).toHaveLength(3);
    expect(skElements('sk-alert')).toHaveLength(0);
  });

  it('starts with the plan as the person left it', async () => {
    const { onStart } = renderView();
    await submitNeed(sample('E1'));

    clickSkButton('Quitar Validación sintética');
    clickSkButton('Empezar con este plan');

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      brief: expect.objectContaining({ questions: [] }) as unknown,
      stepIds: ['investigacion', 'contenido', 'estrategia', 'prototipado'],
      need: sample('E1'),
    });
  });
});

describe('BriefView: editing the plan', () => {
  it('removes a step with the steps that depend on it, and says so beforehand', async () => {
    renderView();
    await submitNeed(sample('E1'));

    expect(screen.getByText('Si lo quitas, también se quita: Prototipado.')).toBeInTheDocument();
    clickSkButton('Quitar Estrategia');

    expect(planStepNames()).toEqual(['Investigación', 'Contenido', 'Validación sintética']);
    expect(screen.getByRole('heading', { name: 'Pasos que puedes agregar' })).toBeInTheDocument();
    expect(screen.getByText('Necesita también: Estrategia.')).toBeInTheDocument();
  });

  it('adds a step back together with what it needs, in the natural order', async () => {
    renderView();
    await submitNeed(sample('E1'));
    clickSkButton('Quitar Estrategia');

    clickSkButton('Agregar Prototipado');

    expect(planStepNames()).toEqual([
      'Investigación',
      'Contenido',
      'Estrategia',
      'Prototipado',
      'Validación sintética',
    ]);
    expect(screen.queryByRole('heading', { name: 'Pasos que puedes agregar' })).toBeNull();
  });

  it('does not let an empty plan start', async () => {
    renderView();
    await submitNeed(sample('E1'));

    clickSkButton('Quitar Investigación');
    clickSkButton('Quitar Validación sintética');

    expect(screen.getByRole('status')).toHaveTextContent('Tu plan está vacío');
    expect(skElements('sk-button[label="Empezar con este plan"]')).toHaveLength(0);
  });
});

describe('BriefView: an ambiguous need', () => {
  it('asks what is missing instead of proposing a plan', async () => {
    renderView();

    await submitNeed(sample('E2'));

    expect(
      screen.getByRole('heading', { name: 'Ayúdanos con un poco más de contexto' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '¿Qué tienes en mente?' })).toBeInTheDocument();
    expect(skElement('sk-input-text')).toHaveAttribute('label', PRODUCT_QUESTION);
    expect(screen.queryByRole('heading', { name: /plan que te proponemos/ })).toBeNull();
  });

  it('points at the answers still missing', async () => {
    renderView();
    await submitNeed(sample('E2'));

    fireEvent.click(screen.getByRole('button', { name: 'Una herramienta nueva' }));
    clickSkButton('Continuar');

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Nos falta esta respuesta');
  });

  it('proposes the plan once every question is answered', async () => {
    renderView();
    await submitNeed(sample('E2'));

    fireEvent.click(screen.getByRole('button', { name: 'Una herramienta nueva' }));
    typeIntoSk(PRODUCT_QUESTION, 'Fondo Voluntario');
    clickSkButton('Continuar');

    expect(
      await screen.findByRole('heading', { name: 'Este es el plan que te proponemos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /un poco más de contexto/ })).toBeNull();
  });
});

describe('BriefView: client data', () => {
  it('hides it, says what it hid and frames only the redacted text', async () => {
    const { framer, requests } = recordingFramer();
    renderView(framer);

    await submitNeed(sample('E3'));

    const notice = skElement('sk-alert');
    expect(notice).toHaveAttribute('title', 'Ocultamos datos de clientes');
    expect(notice.getAttribute('message')).toContain('1 nombre, 1 cédula y 1 saldo');
    expect(screen.getByText(/\[nombre oculto\], cédula \[cédula oculta\]/)).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.text).not.toMatch(/Mariana|1\.234\.567\.890|48\.500\.000/);
  });

  it('gives answers the same treatment as the need', async () => {
    const { framer, requests } = recordingFramer();
    renderView(framer);
    await submitNeed(sample('E3'));

    typeIntoSk(PRODUCT_QUESTION, 'El fondo de ana@ejemplo.com');
    clickSkButton('Continuar');
    await screen.findByRole('heading', { name: 'Este es el plan que te proponemos' });

    expect(requests.at(-1)?.answers).toEqual({ product: 'El fondo de [correo oculto]' });
  });
});

describe('BriefView: when framing fails', () => {
  it('keeps the text, explains calmly and recovers on retry', async () => {
    let attempts = 0;
    const flaky: BriefFramer = {
      frame: (request) => {
        attempts += 1;
        return attempts === 1 ? Promise.resolve('not a brief') : localFramer.frame(request);
      },
    };
    renderView(flaky);

    typeIntoSk(NEED_LABEL, sample('E1'));
    clickSkButton('Continuar');

    const alert = await vi.waitFor(() => skElement('sk-alert[type="error"]'));
    expect(alert).toHaveAttribute('title', 'No pudimos leer tu necesidad esta vez');
    expect(skElement('sk-textarea')).toHaveAttribute('value', sample('E1'));

    clickSkButton('Intentar de nuevo');

    expect(
      await screen.findByRole('heading', { name: 'Este es el plan que te proponemos' }),
    ).toBeInTheDocument();
    expect(skElements('sk-alert[type="error"]')).toHaveLength(0);
  });

  it('ignores an answer that arrives after the view is gone', async () => {
    let finish: (answer: unknown) => void = () => undefined;
    const signals: (AbortSignal | undefined)[] = [];
    const slow: BriefFramer = {
      frame: ({ signal }) => {
        signals.push(signal);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    };
    const onStart = vi.fn();
    const view = render(
      <BriefView catalog={kitCatalog} framers={{ primary: slow }} onStart={onStart} />,
    );
    typeIntoSk(NEED_LABEL, sample('E1'));
    clickSkButton('Continuar');

    view.unmount();
    finish('late answer');
    await Promise.resolve();

    expect(signals[0]?.aborted).toBe(true);
  });
});

describe('BriefView: when the live model cannot be used', () => {
  const broken: BriefFramer = { frame: () => Promise.reject(new Error('quota exceeded')) };

  function renderWithFallback(primary: BriefFramer) {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <BriefView
        catalog={kitCatalog}
        framers={{ primary, fallback: localFramer }}
        onStart={vi.fn()}
      />,
    );
    return warn;
  }

  it('still frames the need with the local rules and says so plainly', async () => {
    const warn = renderWithFallback(broken);

    await submitNeed(sample('E1'));

    expect(skElement('sk-alert')).toHaveAttribute(
      'title',
      'Leímos tu necesidad con el modo básico',
    );
    expect(planStepNames()).toHaveLength(5);
    expect(warn).toHaveBeenCalledWith('Framing fell back to the local rules:', ['quota exceeded']);
    warn.mockRestore();
  });

  it('goes back to the model on retry and drops the notice when it works', async () => {
    let attempts = 0;
    const recovering: BriefFramer = {
      frame: (request) => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new Error('timeout')) : localFramer.frame(request);
      },
    };
    const warn = renderWithFallback(recovering);
    await submitNeed(sample('E1'));

    clickSkButton('Intentar de nuevo con IA');

    await vi.waitFor(() => {
      expect(skElements('sk-alert')).toHaveLength(0);
    });
    expect(attempts).toBe(2);
    warn.mockRestore();
  });

  it('tells the person when the platform added a step the plan needed', async () => {
    const skipsDependency: BriefFramer = {
      frame: () =>
        Promise.resolve({
          summary: 'Quieres saber si vale la pena un simulador.',
          facts: [],
          questions: [],
          steps: [
            { capabilityId: 'investigacion', reason: 'Reúne lo que ya se sabe.' },
            { capabilityId: 'estrategia', reason: 'Define qué tan riesgoso es.' },
          ],
        }),
    };
    renderView(skipsDependency);

    await submitNeed(sample('E1'));

    expect(planStepNames()).toEqual(['Investigación', 'Contenido', 'Estrategia']);
    expect(
      screen.getAllByText('Lo agregamos al plan porque un paso siguiente lo necesita.'),
    ).toHaveLength(1);
    expect(screen.getByText('Define qué tan riesgoso es.')).toBeInTheDocument();
  });
});
