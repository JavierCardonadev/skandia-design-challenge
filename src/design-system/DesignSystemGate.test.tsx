import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemGate } from './DesignSystemGate';

// Custom elements cannot be undefined again, so the "ready" cases run last in this file.
describe('DesignSystemGate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading message while the components are not defined', () => {
    render(
      <DesignSystemGate>
        <p>Contenido</p>
      </DesignSystemGate>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Estamos preparando todo');
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });

  it('offers a retry when the components do not load in time', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(
      <DesignSystemGate timeoutMs={1000} onRetry={onRetry}>
        <p>Contenido</p>
      </DesignSystemGate>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Puedes intentarlo de nuevo');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders its children once the components are defined, even after the timeout', async () => {
    vi.useFakeTimers();
    render(
      <DesignSystemGate timeoutMs={1000}>
        <p>Contenido</p>
      </DesignSystemGate>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();

    customElements.define('sk-button', class extends HTMLElement {});

    expect(await screen.findByText('Contenido')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders immediately when the components are already defined', () => {
    render(
      <DesignSystemGate>
        <p>Contenido</p>
      </DesignSystemGate>,
    );

    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });
});
