import { GoogleGenAI } from '@google/genai';

export const GEMINI_FAST = 'gemini-2.5-flash';
export const GEMINI_SMART = 'gemini-2.5-pro';

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    const key = process.env['GEMINI_API_KEY'];
    if (!key) throw new Error('GEMINI_API_KEY environment variable is required');
    _client = new GoogleGenAI({ apiKey: key });
  }
  return _client;
}

export async function geminiGenerate(
  prompt: string,
  model: string = GEMINI_SMART,
  maxTokens = 2048,
): Promise<string> {
  const res = await getGeminiClient().models.generateContent({
    model,
    contents: prompt,
    config: { maxOutputTokens: maxTokens },
  });
  return res.text ?? '';
}
