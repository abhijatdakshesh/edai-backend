import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_FAST = 'claude-haiku-4-5-20251001';
export const CLAUDE_SMART = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is required');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export async function claudeGenerate(
  prompt: string,
  model: string = CLAUDE_SMART,
  maxTokens = 2048,
): Promise<string> {
  const msg = await getAnthropicClient().messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content[0];
  return (block.type === 'text' ? block.text : '').trim();
}
