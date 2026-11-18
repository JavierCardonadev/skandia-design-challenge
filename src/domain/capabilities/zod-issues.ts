import type { z } from 'zod';

/** Flattens a Zod error into one readable line per issue, e.g. `evidencia.nivel: Invalid option`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return `${path || '(root)'}: ${issue.message}`;
  });
}
