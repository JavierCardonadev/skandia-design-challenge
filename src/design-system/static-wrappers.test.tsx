import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkCard } from './SkCard';
import { SkLogo } from './SkLogo';
import { SkTag } from './SkTag';

describe('SkCard', () => {
  it('keeps its children inside a single stable wrapper', () => {
    const { container } = render(
      <SkCard header="Resumen" subheader="Actualizado hoy">
        <p>Primero</p>
        <p>Segundo</p>
      </SkCard>,
    );
    const card = container.querySelector('sk-card');

    expect(card).toHaveAttribute('header', 'Resumen');
    expect(card).toHaveAttribute('subheader', 'Actualizado hoy');
    expect(card?.children).toHaveLength(1);
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });
});

describe('SkTag', () => {
  it('renders a small informative tag by default', () => {
    const { container } = render(<SkTag>En revisión</SkTag>);
    const tag = container.querySelector('sk-tag');

    expect(tag).toHaveAttribute('sk-style', 'info');
    expect(tag).toHaveAttribute('size', 'small');
    expect(tag?.querySelector('span')).toHaveTextContent('En revisión');
  });

  it('applies the requested tone', () => {
    const { container } = render(<SkTag tone="success">Aprobado</SkTag>);

    expect(container.querySelector('sk-tag')).toHaveAttribute('sk-style', 'success');
  });
});

describe('SkLogo', () => {
  it('renders at the default height and stays visible to assistive tech', () => {
    const { container } = render(<SkLogo />);
    const logo = container.querySelector('sk-logo');

    expect(logo).toHaveStyle({ height: '34px' });
    expect(logo).not.toHaveAttribute('decorativo');
  });

  it('can be marked as decorative', () => {
    const { container } = render(<SkLogo height={24} decorative />);
    const logo = container.querySelector('sk-logo');

    expect(logo).toHaveStyle({ height: '24px' });
    expect(logo).toHaveAttribute('decorativo');
  });
});
