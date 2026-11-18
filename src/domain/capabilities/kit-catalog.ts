import rawCatalog from '../../data/kit/capacidades.json';
import { parseCatalog } from './catalog';

/** The five capabilities shipped with the challenge kit, validated at start-up. */
export const kitCatalog = parseCatalog(rawCatalog);
