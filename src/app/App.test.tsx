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

function currentStage(): string | null {
  return document.querySelector('[aria-current="step"]')?.textContent ?? null;
}

describe('App', () => {
  beforeAll(() => {
    customElements.define('sk-button', class extends HTMLElement {});
  });

  beforeEach(() => {
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

    clickSkButton('Cambiar el plan');

    expect(screen.queryByText('Tu plan está en marcha')).not.toBeInTheDocument();
    expect(skElement('sk-textarea')).toHaveAttribute('value', NEED);
    expect(currentStage()).toBe('1Encargo');
  });

  it('runs a one-step plan to its result', async () => {
    render(<App />);
    await frameNeed();
    clickSkButton('Quitar Investigación');

    clickSkButton('Empezar con este plan');
    await advance(5000);
    clickSkButton('Ver el resultado');

    expect(skElement('sk-alert[type="success"]')).toHaveAttribute(
      'message',
      'Pasos que aportaron al resultado: 1.',
    );
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
});
