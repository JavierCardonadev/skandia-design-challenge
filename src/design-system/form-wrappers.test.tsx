import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emit, skElement } from '../test/sk';
import { ChoiceChips } from './extensions/ChoiceChips';
import { SkButton } from './SkButton';
import { SkInputText } from './SkInputText';

describe('SkInputText', () => {
  it('maps props to attributes and forwards the text the component emits', () => {
    const onValueChange = vi.fn();
    render(
      <SkInputText
        label="Producto"
        value="Fondo"
        helpText="Lo puedes cambiar después"
        errorMessage="Escribe un producto"
        onValueChange={onValueChange}
      />,
    );
    const input = skElement('sk-input-text');

    emit(input, 'valueChange', 'Fondo Voluntario');
    emit(input, 'valueChange', { value: 'ignored' });

    expect(input).toHaveAttribute('label', 'Producto');
    expect(input).toHaveAttribute('value', 'Fondo');
    expect(input).toHaveAttribute('help-text', 'Lo puedes cambiar después');
    expect(input).toHaveAttribute('error-message', 'Escribe un producto');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('Fondo Voluntario');
  });
});

describe('SkButton sizing and naming', () => {
  it('fills its container unless told otherwise', () => {
    render(<SkButton label="Continuar" />);

    expect(skElement('sk-button')).not.toHaveAttribute('data-width');
  });

  it('sizes to its label and takes a contextual accessible name', () => {
    render(<SkButton label="Quitar" ariaLabel="Quitar Estrategia" fullWidth={false} />);

    expect(skElement('sk-button')).toHaveAttribute('data-width', 'auto');
    expect(skElement('sk-button')).toHaveAttribute('aria-label', 'Quitar Estrategia');
  });
});

describe('ChoiceChips', () => {
  it('renders a named group and marks the selected option', () => {
    render(
      <ChoiceChips
        label="¿Qué tienes en mente?"
        options={['Una herramienta', 'Un mensaje']}
        selected="Un mensaje"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: '¿Qué tienes en mente?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Un mensaje' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Una herramienta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the option the person picks', () => {
    const onSelect = vi.fn();
    render(<ChoiceChips label="Opciones" options={['Uno', 'Dos']} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dos' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Dos');
  });
});
