import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeAll(() => {
    customElements.define('sk-button', class extends HTMLElement {});
  });

  it('opens on the brief view inside the page frame', () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuéntanos qué necesitas resolver hoy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(container.querySelector('header sk-logo')).not.toBeNull();
  });
});
