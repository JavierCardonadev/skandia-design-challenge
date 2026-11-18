import { useState } from 'react';
import { DesignSystemGate, SkAlert } from '../design-system';
import { createLocalFramer } from '../domain/brief/local-framer';
import { kitCatalog } from '../domain/capabilities/kit-catalog';
import { BriefView, type ConfirmedBrief } from '../features/brief/BriefView';
import { AppShell } from './AppShell';

const framer = createLocalFramer(kitCatalog);

export function App() {
  const [confirmed, setConfirmed] = useState<ConfirmedBrief | null>(null);

  return (
    <DesignSystemGate>
      <AppShell>
        <BriefView catalog={kitCatalog} framer={framer} onStart={setConfirmed} />
        {confirmed && (
          // Interim confirmation until the run view takes over from here.
          <SkAlert
            tone="success"
            title="Tu plan quedó listo"
            message={`Tiene ${confirmed.stepIds.length} pasos. Desde aquí seguirás su avance.`}
          />
        )}
      </AppShell>
    </DesignSystemGate>
  );
}
