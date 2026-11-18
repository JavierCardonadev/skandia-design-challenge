import type { Framers } from '../domain/brief/framing';
import { createLocalFramer } from '../domain/brief/local-framer';
import { createRemoteFramer } from '../domain/brief/remote-framer';
import type { CapabilityCatalog } from '../domain/capabilities/types';

/**
 * Chooses how needs are framed. Live mode asks the model through the server function
 * and keeps the local rules as a safety net; otherwise the local rules run alone, which
 * is how the public preview works (no API key, no cost, no model to abuse).
 */
export function createFramers(catalog: CapabilityCatalog, isLive: boolean): Framers {
  const local = createLocalFramer(catalog);
  return isLive ? { primary: createRemoteFramer(), fallback: local } : { primary: local };
}
