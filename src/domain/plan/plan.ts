import type { CapabilityCatalog } from '../capabilities/types';

export interface ResolvedPlan {
  /** Capability ids in an order that respects every dependency. */
  stepIds: string[];
  /** Steps nobody asked for, added because a requested step needs them. */
  addedDependencyIds: string[];
  /** Requested ids that are not in the catalog; dropped from the plan. */
  unknownIds: string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Turns a proposed list of capabilities (from the framing model or from the person
 * editing the plan) into a runnable plan: known steps only, dependencies included,
 * dependencies first. The requested order is kept wherever dependencies allow it.
 */
export function resolvePlan(
  catalog: CapabilityCatalog,
  requestedIds: readonly string[],
): ResolvedPlan {
  const dependenciesById = new Map(catalog.capabilities.map((c) => [c.id, c.dependsOn]));
  const requested = unique(requestedIds.filter((id) => dependenciesById.has(id)));
  const stepIds: string[] = [];
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (stepIds.includes(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dependency of dependenciesById.get(id) ?? []) visit(dependency);
    stepIds.push(id);
  };
  requested.forEach(visit);

  return {
    stepIds,
    addedDependencyIds: stepIds.filter((id) => !requested.includes(id)),
    unknownIds: unique(requestedIds.filter((id) => !dependenciesById.has(id))),
  };
}

/** Steps of the plan that cannot run without `id`, directly or through another step. */
export function dependentsOf(
  catalog: CapabilityCatalog,
  stepIds: readonly string[],
  id: string,
): string[] {
  const affected = new Set([id]);
  // stepIds is dependency-ordered, so a single pass reaches transitive dependents.
  for (const stepId of stepIds) {
    const dependencies = catalog.capabilities.find((c) => c.id === stepId)?.dependsOn ?? [];
    if (dependencies.some((dependency) => affected.has(dependency))) affected.add(stepId);
  }
  affected.delete(id);
  return [...affected];
}

/** Removes a step together with the steps that depend on it, so the plan stays runnable. */
export function removeStep(
  catalog: CapabilityCatalog,
  stepIds: readonly string[],
  id: string,
): { stepIds: string[]; removedIds: string[] } {
  if (!stepIds.includes(id)) return { stepIds: [...stepIds], removedIds: [] };

  const removedIds = [id, ...dependentsOf(catalog, stepIds, id)];
  return { stepIds: stepIds.filter((stepId) => !removedIds.includes(stepId)), removedIds };
}
