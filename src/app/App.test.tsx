import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LOCAL_FRAMING_DELAY_MS } from '../domain/brief/local-framer';
import { clickSkButton, skElement, typeIntoSk } from '../test/sk';
import { App } from './App';

describe('App', () => {
  beforeAll(() => {
    customElements.define('sk-button', class extends HTMLElement {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on the brief view inside the page frame', () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuéntanos qué necesitas resolver hoy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(container.querySelector('header sk-logo')).not.toBeNull();
  });

  it('takes a clear need from the text box to a confirmed plan', async () => {
    vi.useFakeTimers();
    render(<App />);

    typeIntoSk('Tu necesidad', 'Quiero un simulador de aportes para el fondo voluntario.');
    clickSkButton('Continuar');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCAL_FRAMING_DELAY_MS);
    });
    clickSkButton('Empezar con este plan');

    expect(skElement('sk-alert[type="success"]')).toHaveAttribute(
      'message',
      'Tiene 5 pasos. Desde aquí seguirás su avance.',
    );
  });
});
