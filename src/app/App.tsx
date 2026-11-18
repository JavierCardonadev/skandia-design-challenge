import { DesignSystemGate } from '../design-system';
import { AppShell } from './AppShell';

export function App() {
  return (
    <DesignSystemGate>
      <AppShell>
        <h1>Cuéntanos qué necesitas resolver hoy</h1>
        <p>Escríbelo con tus palabras. Aquí verás qué entendimos y qué pasos puedes seguir.</p>
      </AppShell>
    </DesignSystemGate>
  );
}
