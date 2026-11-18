import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SkButton } from './SkButton';

function renderButton(ui: ReactElement) {
  const view = render(ui);
  const element = view.container.querySelector('sk-button');
  if (!element) throw new Error('sk-button was not rendered');
  return { ...view, element };
}

describe('SkButton', () => {
  it('maps props to the attributes documented by the design system', () => {
    const { element } = renderButton(
      <SkButton
        label="Continuar"
        variant="secondary"
        icon="pi pi-arrow-right"
        iconPosition="right"
      />,
    );

    expect(element).toHaveAttribute('label', 'Continuar');
    expect(element).toHaveAttribute('sk-type', 'secondary');
    expect(element).toHaveAttribute('icon', 'pi pi-arrow-right');
    expect(element).toHaveAttribute('icon-pos', 'right');
  });

  it('defaults to a large primary button', () => {
    const { element } = renderButton(<SkButton label="Continuar" />);

    expect(element).toHaveAttribute('sk-type', 'primary');
    expect(element).toHaveAttribute('size', 'large');
  });

  it('calls the latest onClick handler when the component emits skClick', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { element, rerender } = renderButton(<SkButton label="Continuar" onClick={first} />);

    rerender(<SkButton label="Continuar" onClick={second} />);
    element.dispatchEvent(new CustomEvent('skClick'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', () => {
    const onClick = vi.fn();
    const { element, unmount } = renderButton(<SkButton label="Continuar" onClick={onClick} />);

    unmount();
    element.dispatchEvent(new CustomEvent('skClick'));

    expect(onClick).not.toHaveBeenCalled();
  });
});
