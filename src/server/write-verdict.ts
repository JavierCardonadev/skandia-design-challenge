import { z } from 'zod';
import { modelVerdictSchema, ALLOWED_DECISIONS } from '../domain/result/verdict';
import { failure, MAX_NEED_LENGTH, redact, type ServerTask } from './generation';
import { VOICE_RULES } from './voice-rules';

const requestSchema = z.object({
  need: z.string().trim().min(1).max(MAX_NEED_LENGTH),
  /** What the fixed rules concluded from the evidence. The model may not go beyond it. */
  ruleVerdict: z.enum(['ready-to-share', 'validate-first', 'incomplete']),
  evidence: z.object({
    level: z.enum(['high', 'medium', 'low']),
    realSourceCount: z.number().int().nonnegative(),
    syntheticSourceCount: z.number().int().nonnegative(),
  }),
  skippedSteps: z.array(z.string()).max(12),
  sections: z
    .array(
      z.object({
        step: z.string().min(1),
        content: z.record(z.string(), z.unknown()),
        warnings: z.array(z.string()),
      }),
    )
    .min(1)
    .max(12),
  sources: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string(),
        origin: z.enum(['real', 'simulated', 'ai-made']),
      }),
    )
    .max(40),
});

type VerdictRequest = z.infer<typeof requestSchema>;

function buildSystemPrompt(request: VerdictRequest): string {
  const allowed = ALLOWED_DECISIONS[request.ruleVerdict];

  return `You write the recommendation that opens a result on Skandia's internal UX platform. The reader is not a UX specialist: typically a product owner deciding whether an idea deserves their team's time. They want a clear answer and to know how far to trust it. They are frustrated by "it depends" with no explanation.

You receive the person's need, what each step produced, and every source behind the result. Each source is labelled real (people, data, other companies, internal rules), simulated (clients played by an AI) or ai-made (text an AI derived from other steps).

Decide one of:
- "go": the evidence supports going ahead.
- "validate-first": there are signs, but something has to be checked before committing time or money.
- "no-go": the evidence points against it.

The platform already measured the evidence with fixed rules, and you cannot claim more than it supports. For this result you may only decide: ${allowed.join(', ')}.${
    request.ruleVerdict === 'incomplete'
      ? ' Some planned steps did not run, so the result is incomplete: say so.'
      : ''
  }

Write:
- headline: the answer in one sentence of at most 14 words, addressed to the person.
- reasons: two or three reasons, each one sentence, each citing in sourceIds the ids of the sources that back it. Use only ids from the list you were given. Lean on real sources; if a reason rests only on simulated or ai-made sources, say in the sentence that it is a sign, not a confirmation.
- nextStep: one concrete thing the person can do next, in one sentence.

Do not add facts, figures or sources that are not in what you received. The decision belongs to the person: describe what the evidence supports, do not order them.

${VOICE_RULES}`;
}

function buildUserMessage(request: VerdictRequest): string {
  return [
    `<need>\n${redact(request.need)}\n</need>`,
    `<evidence level="${request.evidence.level}" real_sources="${request.evidence.realSourceCount}" simulated_sources="${request.evidence.syntheticSourceCount}" />`,
    request.skippedSteps.length > 0
      ? `<steps_not_run>\n${request.skippedSteps.join('\n')}\n</steps_not_run>`
      : null,
    `<sources>\n${request.sources.map((s) => `${s.id} [${s.origin}] ${s.description}`).join('\n')}\n</sources>`,
    `<steps>\n${request.sections
      .map(
        (section) =>
          `<step name="${section.step}">\n${JSON.stringify(section.content)}${
            section.warnings.length > 0 ? `\nwarnings: ${section.warnings.join(' | ')}` : ''
          }\n</step>`,
      )
      .join('\n')}\n</steps>`,
  ]
    .filter((part) => part !== null)
    .join('\n\n');
}

/**
 * Asks the model to write the recommendation of a result. The answer goes back
 * untrusted: the client checks it against the evidence rules and the real source list.
 */
export const writeVerdict: ServerTask = async (rawBody, generate) => {
  const request = requestSchema.safeParse(rawBody);
  if (!request.success) return failure('invalid-request');
  if (!generate) return failure('not-configured');

  const result = await generate({
    system: buildSystemPrompt(request.data),
    user: buildUserMessage(request.data),
    schema: modelVerdictSchema,
  });

  return result.ok ? { status: 200, body: { verdict: result.output } } : failure(result.code);
};
