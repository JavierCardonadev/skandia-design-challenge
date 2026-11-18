import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseContentShape } from '../../domain/capabilities/content-shape';
import type { EvidenceSource } from '../../domain/capabilities/types';
import { kitCapability, kitResult } from '../../test/fixtures';
import { describeFailure } from '../run/failure-messages';
import { ContentView, fieldLabel } from './ContentView';
import { EvidencePanel } from './EvidencePanel';
import { sourceOrigin } from './evidence-labels';

describe('fieldLabel', () => {
  it('turns a contract key into a readable label', () => {
    expect(fieldLabel('respuestaCorta')).toBe('Respuesta corta');
    expect(fieldLabel('decisionesPendientes')).toBe('Decisiones pendientes');
    expect(fieldLabel('pantallas')).toBe('Pantallas');
  });

  it('restores accents the contract keys cannot carry', () => {
    expect(fieldLabel('comprension')).toBe('Comprensión');
    expect(fieldLabel('justificacion')).toBe('Justificación');
    expect(fieldLabel('criteriosDeExito')).toBe('Criterios de éxito');
  });
});

describe('ContentView', () => {
  it('renders any content from its shape: text, choices, lists and nested records', () => {
    const shape = parseContentShape({
      titulo: 'texto',
      nivel: 'alta | baja',
      duracion: 'número',
      pasos: [{ nombre: 'texto', notas: ['texto'] }],
      pendientes: ['texto'],
    });
    render(
      <ContentView
        shape={shape}
        content={{
          titulo: 'Plan de prueba',
          nivel: 'alta',
          duracion: 3,
          pasos: [{ nombre: 'Primer paso', notas: ['Una nota'] }],
          pendientes: [],
        }}
      />,
    );

    expect(screen.getByText('Titulo').tagName).toBe('DT');
    expect(screen.getByText('Plan de prueba').tagName).toBe('DD');
    expect(screen.getByText('alta')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Primer paso')).toBeInTheDocument();
    expect(screen.getByText('Una nota').tagName).toBe('LI');
    expect(screen.getByText('Nada por ahora')).toBeInTheDocument();
  });

  it('renders the real output of every kit capability without a dedicated component', () => {
    for (const id of ['investigacion', 'contenido', 'estrategia', 'prototipado', 'validacion']) {
      const { container, unmount } = render(
        <ContentView shape={kitCapability(id).output.shape} content={kitResult(id).content} />,
      );
      expect(container.querySelectorAll('dt').length).toBeGreaterThan(2);
      unmount();
    }
  });

  it('tolerates content that does not match the shape instead of breaking the page', () => {
    const shape = parseContentShape({ titulo: 'texto', pasos: ['texto'], detalle: { a: 'texto' } });

    render(<ContentView shape={shape} content={{ titulo: { nested: true }, pasos: 'x' }} />);

    expect(screen.getByText('Nada por ahora')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('EvidencePanel', () => {
  it('names the level in words and labels each source by what backs it', () => {
    render(<EvidencePanel evidence={kitResult('contenido').evidence} />);

    expect(screen.getByRole('region', { name: 'Qué tan confiable es' })).toBeInTheDocument();
    expect(screen.getByText('Evidencia parcial')).toBeInTheDocument();
    expect(screen.getByText('Elaborado por IA')).toBeInTheDocument();
    expect(screen.getByText('Fuente real')).toBeInTheDocument();
    expect(screen.getByText(/Regla interna o regulatoria/)).toBeInTheDocument();
  });
});

describe('sourceOrigin', () => {
  const source: EvidenceSource = {
    id: 'F1',
    kind: 'benchmark',
    description: 'Revisión',
    isSynthetic: false,
  };

  it('tells real, simulated and AI-made sources apart', () => {
    expect(sourceOrigin(source).label).toBe('Fuente real');
    expect(sourceOrigin({ ...source, kind: 'synthetic', isSynthetic: true }).label).toBe(
      'Simulado',
    );
    expect(sourceOrigin({ ...source, kind: 'generated' }).label).toBe('Elaborado por IA');
  });
});

describe('describeFailure', () => {
  it('has a calm, jargon-free message for every failure code', () => {
    const codes = [
      'timeout',
      'incomplete-input',
      'dependency-not-approved',
      'source-unavailable',
      'unsupported-segment',
      'invalid-output',
      'provider-error',
      'unknown',
    ] as const;

    for (const code of codes) {
      const message = describeFailure(code);
      expect(message.title).not.toMatch(/error|timeout|null|undefined/i);
      expect(message.detail.length).toBeGreaterThan(20);
    }
  });
});
