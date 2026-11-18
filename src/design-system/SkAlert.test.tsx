import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkAlert } from './SkAlert';

function getAlert(container: HTMLElement) {
  const element = container.querySelector('sk-alert');
  if (!element) throw new Error('sk-alert was not rendered');
  return element;
}

describe('SkAlert', () => {
  it('renders a fixed informative alert when there is no close handler', () => {
    const { container } = render(<SkAlert title="Antes de seguir" message="Revisa este punto." />);
    const element = getAlert(container);

    expect(element).toHaveAttribute('type', 'info');
    expect(element).toHaveAttribute('title', 'Antes de seguir');
    expect(element).toHaveAttribute('message', 'Revisa este punto.');
    expect(element).toHaveAttribute('closable', 'false');
  });

  it('is closable and reports the dismissal when a close handler is given', () => {
    const onClose = vi.fn();
    const { container } = render(<SkAlert tone="warning" message="Aviso" onClose={onClose} />);
    const element = getAlert(container);

    element.dispatchEvent(new CustomEvent('skClose'));

    expect(element).toHaveAttribute('type', 'warning');
    expect(element).not.toHaveAttribute('closable');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
