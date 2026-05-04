import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_FAST = 'claude-haiku-4-5-20251001';
export const CLAUDE_SMART = 'claude-sonnet-4-6';

const key = process.env['ANTHROPIC_API_KEY'];
if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is required');
const _client = new Anthropic({ apiKey: key });

export function getAnthropicClient(): Anthropic {
  return _client;
}

export async function claudeGenerate(
  prompt: string,
  model: string = CLAUDE_SMART,
  maxTokens = 2048,
): Promise<string> {
  const msg = await _client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content[0];
  return (block.type === 'text' ? block.text : '').trim();
}
