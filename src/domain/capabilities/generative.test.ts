import { describe, expect, it } from 'vitest';
import { kitCapability, rawCapability } from '../../test/fixtures';
import { parseCatalog } from './catalog';
import { canRunOnModel, gathersRealEvidence, simulatesClients } from './generative';

describe('which capabilities a model can run honestly', () => {
  it('keeps the capability that stands for real evidence away from the model', () => {
    expect(gathersRealEvidence(kitCapability('investigacion'))).toBe(true);
    expect(canRunOnModel(kitCapability('investigacion'))).toBe(false);
  });

  it.each(['contenido', 'estrategia', 'prototipado', 'validacion'])(
    'lets the model run %s, which works from earlier steps',
    (id) => {
      expect(canRunOnModel(kitCapability(id))).toBe(true);
    },
  );

  it('recognises the capability that plays the part of clients', () => {
    expect(simulatesClients(kitCapability('validacion'))).toBe(true);
    expect(simulatesClients(kitCapability('contenido'))).toBe(false);
  });

  it('decides from the catalog, so a new capability needs no code', () => {
    const [added] = parseCatalog({ capacidades: [rawCapability('nueva')] }).capabilities;
    if (!added) throw new Error('Fixture catalog is empty');

    expect(canRunOnModel(added)).toBe(true);
  });

  it('treats a capability without a usable reference response as runnable', () => {
    const broken = {
      ...kitCapability('investigacion'),
      simulatedResponses: {
        normal: 'not a response',
        weakEvidence: null,
        error: null,
      },
    };

    expect(gathersRealEvidence(broken)).toBe(false);
  });
});
