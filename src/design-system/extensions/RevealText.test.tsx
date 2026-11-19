import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevealText } from './RevealText';

function stubMotionPreference(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  );
}

function visiblePart(container: HTMLElement): string {
  const animated = container.querySelector('[aria-hidden="true"]');
  return animated?.firstChild?.nodeType === Node.TEXT_NODE
    ? (animated.firstChild.textContent ?? '')
    : '';
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('RevealText', () => {
  it('shows the text at once when motion preferences cannot be read', () => {
    const { container } = render(<RevealText text="Quieres un simulador." />);

    expect(container).toHaveTextContent('Quieres un simulador.');
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('shows the text at once for people who ask for reduced motion', () => {
    stubMotionPreference(true);
    const { container } = render(<RevealText text="Quieres un simulador." />);

    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(screen.getByText('Quieres un simulador.')).toBeInTheDocument();
  });

  it('reveals the text word by word, with the whole text available to screen readers', () => {
    stubMotionPreference(false);
    vi.useFakeTimers();
    const { container } = render(<RevealText text="Quieres un simulador." wordsPerSecond={10} />);

    expect(screen.getByText('Quieres un simulador.')).toBeInTheDocument();
    expect(visiblePart(container)).toBe('');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(visiblePart(container)).toBe('Quieres un ');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(visiblePart(container)).toBe('Quieres un simulador.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for its turn when several texts are revealed in sequence', () => {
    stubMotionPreference(false);
    vi.useFakeTimers();
    const { container } = render(
      <RevealText text="Segundo texto." delayMs={500} wordsPerSecond={10} />,
    );

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(visiblePart(container)).toBe('');

    act(() => {
      vi.advanceTimersByTime(101);
    });
    expect(visiblePart(container)).toBe('Segundo ');
  });

  it('starts over when the text changes and cleans up when it goes away', () => {
    stubMotionPreference(false);
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <RevealText text="Primer texto." wordsPerSecond={10} />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender(<RevealText text="Otro texto distinto." wordsPerSecond={10} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(visiblePart(container)).toBe('Otro ');

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
