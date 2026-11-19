import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { clickSkButton } from '../../test/sk';
import { HistoryList } from './HistoryList';

const entries = [
  { id: 'b', finishedAt: '2026-11-19T15:00:00.000Z', needSummary: 'Quieres un simulador.' },
  { id: 'a', finishedAt: '2026-11-18T10:30:00.000Z', needSummary: 'Quieres un mensaje claro.' },
];

describe('HistoryList', () => {
  it('shows nothing when there are no past results', () => {
    const { container } = render(<HistoryList entries={[]} onOpen={vi.fn()} onClear={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists past results with their date and says where they are kept', () => {
    const { container } = render(
      <HistoryList entries={entries} onOpen={vi.fn()} onClear={vi.fn()} />,
    );

    expect(screen.getByRole('region', { name: 'Tus resultados anteriores' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/solo en este navegador y sin datos de clientes/)).toBeInTheDocument();
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-11-19T15:00:00.000Z');
  });

  it('opens the result the person picks and clears them on request', () => {
    const onOpen = vi.fn();
    const onClear = vi.fn();
    render(<HistoryList entries={entries} onOpen={onOpen} onClear={onClear} />);

    clickSkButton('Ver resultado: Quieres un mensaje claro.');
    clickSkButton('Borrar resultados guardados');

    expect(onOpen).toHaveBeenCalledExactlyOnceWith('a');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
