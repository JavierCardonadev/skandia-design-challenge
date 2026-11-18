import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DemoScenarioPicker } from './DemoScenarioPicker';
import { buildSimulationScript } from './scenarios';

const PLAN = ['investigacion', 'contenido'];

describe('buildSimulationScript', () => {
  it('answers normally in the default scenario', () => {
    expect(buildSimulationScript('normal', PLAN)('investigacion', 1)).toEqual({
      outcome: 'normal',
    });
  });

  it('answers every step with weak evidence', () => {
    const script = buildSimulationScript('weak-evidence', PLAN);

    expect(script('investigacion', 1)).toEqual({ outcome: 'weakEvidence' });
    expect(script('contenido', 2)).toEqual({ outcome: 'weakEvidence' });
  });

  it('fails only the first step on its first attempt', () => {
    const script = buildSimulationScript('failure', PLAN);

    expect(script('investigacion', 1)).toEqual({ outcome: 'error' });
    expect(script('investigacion', 2)).toEqual({ outcome: 'normal' });
    expect(script('contenido', 1)).toEqual({ outcome: 'normal' });
  });

  it('slows down only the first step on its first attempt', () => {
    const script = buildSimulationScript('delay', PLAN);

    expect(script('investigacion', 1)).toEqual({ outcome: 'normal', isSlow: true });
    expect(script('investigacion', 2)).toEqual({ outcome: 'normal', isSlow: false });
    expect(script('contenido', 1)).toEqual({ outcome: 'normal', isSlow: false });
  });
});

describe('DemoScenarioPicker', () => {
  it('marks the current scenario and reports a new choice', () => {
    const onChange = vi.fn();
    render(<DemoScenarioPicker scenario="normal" isLiveFraming={false} onChange={onChange} />);

    expect(screen.getByRole('complementary', { name: 'Modo demostración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todo sale bien' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Un paso falla' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('failure');
  });

  it('says whether a real model or the example rules read the need', () => {
    const { rerender } = render(
      <DemoScenarioPicker scenario="normal" isLiveFraming={false} onChange={vi.fn()} />,
    );
    expect(screen.getByText(/usa respuestas de ejemplo en todos los pasos/)).toBeInTheDocument();

    rerender(<DemoScenarioPicker scenario="normal" isLiveFraming onChange={vi.fn()} />);
    expect(screen.getByText(/Un modelo de IA real lee tu necesidad/)).toBeInTheDocument();
  });
});
