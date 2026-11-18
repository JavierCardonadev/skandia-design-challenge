import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkTextarea } from './SkTextarea';

function renderTextarea(onValueChange = vi.fn()) {
  const view = render(
    <SkTextarea
      label="Describe lo que necesitas"
      value="Quiero un simulador"
      helpText="Puedes cambiarlo después"
      errorMessage="Escribe tu necesidad"
      onValueChange={onValueChange}
    />,
  );
  const element = view.container.querySelector('sk-textarea');
  if (!element) throw new Error('sk-textarea was not rendered');
  return { element, onValueChange };
}

describe('SkTextarea', () => {
  it('maps props to the attributes documented by the design system', () => {
    const { element } = renderTextarea();

    expect(element).toHaveAttribute('label', 'Describe lo que necesitas');
    expect(element).toHaveAttribute('value', 'Quiero un simulador');
    expect(element).toHaveAttribute('help-text', 'Puedes cambiarlo después');
    expect(element).toHaveAttribute('error-message', 'Escribe tu necesidad');
    expect(element).toHaveAttribute('auto-resize');
  });

  it('forwards text emitted through valueChange', () => {
    const { element, onValueChange } = renderTextarea();

    element.dispatchEvent(new CustomEvent('valueChange', { detail: 'Nuevo texto' }));

    expect(onValueChange).toHaveBeenCalledWith('Nuevo texto');
  });

  it('ignores payloads that are not text', () => {
    const { element, onValueChange } = renderTextarea();

    element.dispatchEvent(new CustomEvent('valueChange', { detail: { value: 'x' } }));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
