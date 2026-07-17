import Anthropic from '@anthropic-ai/sdk';

/**
 * AI triage step: an LLM looks at each submitted photo (+ the reporter's
 * description) and judges whether it's genuine hazard/emergency footage,
 * same call a human moderator would eventually make in
 * /api/moderation/reports, just run automatically at submission time.
 *
 * Deliberately bounded: this never deletes a report, bans a reporter, or
 * removes anything from the public feed — that stays human-only, via the
 * existing moderation endpoints. All the triage result is allowed to do is
 * (a) get stored alongside the report so admins can prioritize their review
 * queue, and (b) suppress the responder-notification email when the model is
 * confident the submission isn't a real hazard, since paging real first
 * responders about a meme or a selfie has a real-world cost that an
 * unreviewed report sitting in the queue doesn't.
 */
export interface TriageResult {
  legitimate: boolean;
  severity: 'low' | 'medium' | 'high';
  reasoning: string;
}

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    legitimate: {
      type: 'boolean',
      description:
        'True if the photo shows genuine hazard/emergency footage (fire, flood, accident, structural damage, etc). False for selfies, memes, nudity, unrelated everyday photos, or anything that isn’t an emergency.',
    },
    severity: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description:
        'Only meaningful when legitimate is true: how severe the depicted hazard appears. Use "low" when legitimate is false.',
    },
    reasoning: {
      type: 'string',
      description: 'One or two sentences explaining the verdict, for a human moderator to read.',
    },
  },
  required: ['legitimate', 'severity', 'reasoning'],
  additionalProperties: false,
} as const;

// Vision only handles still images — video frames aren't extracted here, so
// video submissions skip triage entirely and fall back to human-only review
// (same as today).
const TRIAGEABLE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Best-effort, like notifyResponders: a missing API key, an unsupported
 * media type, or a provider error should never block or delay a report the
 * reporter has already been debited for. Returns null when triage didn't run
 * or couldn't be completed — callers should treat that as "unknown" rather
 * than "illegitimate".
 */
export async function triageReport(media: File, description: string | null): Promise<TriageResult | null> {
  if (!TRIAGEABLE_MEDIA_TYPES.has(media.type)) return null;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured — skipping AI triage');
    return null;
  }

  try {
    const client = new Anthropic();
    const imageData = Buffer.from(await media.arrayBuffer()).toString('base64');

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: TRIAGE_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media.type as 'image/jpeg' | 'image/png' | 'image/webp', data: imageData },
            },
            {
              type: 'text',
              text:
                'This photo was submitted to Whizpr, a public-safety app for reporting genuine hazards ' +
                '(fire, flood, accident, structural damage, etc). Users are told the app is for real emergencies ' +
                'only, not selfies, memes, nudity, or unrelated content.\n\n' +
                `Reporter's description: ${description ? JSON.stringify(description) : '(none provided)'}\n\n` +
                'Assess whether this is genuine hazard footage and, if so, how severe it looks.',
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      console.error('AI triage refused to classify the submission — skipping');
      return null;
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const parsed = JSON.parse(textBlock.text) as TriageResult;
    return parsed;
  } catch (err) {
    console.error('AI triage failed', err);
    return null;
  }
}
