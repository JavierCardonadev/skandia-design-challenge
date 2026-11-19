import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickSkButton, skElement, typeIntoSk } from '../test/sk';
import { App } from './App';

const NEED = 'Quiero un simulador de aportes para el fondo voluntario.';

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

/** Writes a clear need and waits for the proposed plan. */
async function frameNeed() {
  typeIntoSk('Tu necesidad', NEED);
  clickSkButton('Continuar');
  await advance(1000);
}

/** Runs a plan reduced to its only step without review, up to the result view. */
async function reachResult() {
  await frameNeed();
  clickSkButton('Quitar Investigación');
  clickSkButton('Empezar con este plan');
  await advance(5000);
  clickSkButton('Ver el resultado');
}

function currentStage(): string | null {
  return document.querySelector('[aria-current="step"]')?.textContent ?? null;
}

describe('App', () => {
  beforeAll(() => {
    customElements.define('sk-button', class extends HTMLElement {});
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on the brief view inside the page frame', () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuéntanos qué necesitas resolver hoy' }),
    ).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Etapas' })).toBeInTheDocument();
    expect(currentStage()).toBe('1Encargo');
    expect(container.querySelector('header sk-logo')).not.toBeNull();
  });

  it('moves from the brief to the run and back without losing what was written', async () => {
    render(<App />);
    await frameNeed();

    clickSkButton('Empezar con este plan');

    expect(screen.getByRole('heading', { level: 1, name: 'Tu plan está en marcha' })).toBeVisible();
    expect(screen.getByText('Cuéntanos qué necesitas resolver hoy')).not.toBeVisible();
    expect(currentStage()).toBe('2Ejecución');
    expect(screen.getByRole('main')).toHaveFocus();

    clickSkButton('Cambiar el plan');

    expect(screen.queryByText('Tu plan está en marcha')).not.toBeInTheDocument();
    expect(skElement('sk-textarea')).toHaveAttribute('value', NEED);
    expect(currentStage()).toBe('1Encargo');
  });

  it('runs a plan to its result, with the need as context', async () => {
    render(<App />);

    await reachResult();

    expect(currentStage()).toBe('3Resultado');
    expect(screen.queryByText('Tu plan terminó')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Aún falta respaldo para decidir con confianza',
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Tu encargo: Quieres saber si vale la pena un simulador/),
    ).toBeVisible();
  });

  it('goes back from the result to the plan, keeping the need', async () => {
    render(<App />);
    await reachResult();

    clickSkButton('Volver al plan');

    expect(currentStage()).toBe('1Encargo');
    expect(skElement('sk-textarea')).toHaveAttribute('value', NEED);
  });

  it('starts a new brief from the result with a clean slate', async () => {
    render(<App />);
    await reachResult();

    clickSkButton('Empezar otro encargo');

    expect(currentStage()).toBe('1Encargo');
    expect(skElement('sk-textarea')).toHaveAttribute('value', '');
    expect(screen.queryByText('Esto fue lo que entendimos')).not.toBeInTheDocument();
  });

  it('runs the plan under the demo scenario the reviewer picked', async () => {
    render(<App />);
    await frameNeed();
    clickSkButton('Quitar Investigación');
    fireEvent.click(screen.getByRole('button', { name: 'Un paso falla' }));

    clickSkButton('Empezar con este plan');
    await advance(5000);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Todavía no podemos simular ese grupo de clientes',
    );
  });

  it('keeps the brief and its plan when the page is reloaded', async () => {
    const firstLoad = render(<App />);
    await frameNeed();
    clickSkButton('Quitar Validación sintética');
    firstLoad.unmount();

    render(<App />);

    expect(skElement('sk-textarea')).toHaveAttribute('value', NEED);
    expect(screen.getByText('Esto fue lo que entendimos')).toBeVisible();
    expect(screen.queryByRole('heading', { level: 3, name: 'Validación sintética' })).toBeNull();
    expect(currentStage()).toBe('1Encargo');
  });

  it('never keeps client data: a reload brings back the redacted text', async () => {
    const firstLoad = render(<App />);
    typeIntoSk('Tu necesidad', 'Simulador para el fondo voluntario. Escribir a ana@ejemplo.com');
    clickSkButton('Continuar');
    await advance(1000);
    firstLoad.unmount();

    expect(window.localStorage.getItem('skandia-platform')).not.toContain('ana@ejemplo.com');
    render(<App />);

    expect(skElement('sk-textarea').getAttribute('value')).toContain('[correo oculto]');
  });

  it('continues a run after a reload, with the review that was waiting', async () => {
    const firstLoad = render(<App />);
    await frameNeed();
    clickSkButton('Empezar con este plan');
    await advance(5000);
    expect(screen.getByText('Espera tu revisión')).toBeInTheDocument();
    firstLoad.unmount();

    render(<App />);

    expect(currentStage()).toBe('2Ejecución');
    expect(screen.getByText('Espera tu revisión')).toBeInTheDocument();
    expect(screen.getByText('Evidencia sólida')).toBeInTheDocument();
  });

  it('opens on the result after a reload once the plan has finished', async () => {
    const firstLoad = render(<App />);
    await reachResult();
    firstLoad.unmount();

    render(<App />);

    expect(currentStage()).toBe('3Resultado');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Aún falta respaldo para decidir con confianza',
      }),
    ).toBeVisible();
  });

  it('keeps finished results in a history that can be opened and cleared', async () => {
    render(<App />);
    await reachResult();
    clickSkButton('Empezar otro encargo');

    const history = screen.getByRole('region', { name: 'Tus resultados anteriores' });
    expect(history).toBeVisible();

    clickSkButton(
      'Ver resultado: Quieres saber si vale la pena un simulador de aportes. Producto: Fondo Voluntario de Pensiones.',
    );
    expect(currentStage()).toBe('3Resultado');
    expect(screen.getByRole('table')).toBeInTheDocument();

    clickSkButton('Volver al plan');
    expect(currentStage()).toBe('1Encargo');

    clickSkButton('Borrar resultados guardados');
    expect(screen.queryByRole('region', { name: 'Tus resultados anteriores' })).toBeNull();
  });
});
