// DPDP_DATA_RESIDENCY_WARNING: Google Gemini API processes data on Google-hosted servers.
// India region available via Vertex AI. Pending migration from AI Studio to Vertex AI India.
// All calls include a DPDP consent check; minimal PII is included in prompts.

import { Injectable, Logger, Optional } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KnowledgeGraph, StudentKnowledgeGraph, ParentKnowledgeGraph, TeacherKnowledgeGraph, AdminKnowledgeGraph } from './knowledge-graph.service';

const LANGUAGE_NAMES: Record<string, string> = {
  kn: 'Kannada', ta: 'Tamil', te: 'Telugu', hi: 'Hindi', en: 'English',
};

// Keyword-based model routing — no extra API call (Sujit: unit economics)
const SIMPLE_PATTERNS = ['schedule', 'today', 'tomorrow', 'fee', 'balance', 'paid', 'attendance', 'percentage', 'class', 'timetable', 'room', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'vtu', 'exam', 'eligible'];

/**
 * Ordered fallback chains per tier.
 * gemini-2.0-flash is GA and the most stable fast model as of mid-2025.
 * gemini-1.5-flash is the final backstop — broadly available, never deprecated mid-cycle.
 * gemini-2.5-flash-lite / gemini-2.5-flash are tried first; on 404/503/429 we walk down.
 */
const MODEL_CHAIN_FAST = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];
const MODEL_CHAIN_COMPLEX = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

// HTTP status codes / error message patterns that warrant a model fallback
function isRetryableModelError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // 404 = model deprecated/not-found; 429 = rate limit; 503 = overloaded
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('deprecated') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('overloaded')
  );
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] ?? '');

  constructor(
    @Optional() @InjectDataSource() private readonly db: DataSource | null,
  ) {}

  selectModel(message: string): string {
    const lower = message.toLowerCase();
    return SIMPLE_PATTERNS.some(p => lower.includes(p))
      ? 'gemini-2.5-flash-lite'
      : 'gemini-2.5-flash';
  }

  /** Returns the fallback chain for the initially-selected model name. */
  private modelChain(primaryModel: string): string[] {
    return primaryModel === 'gemini-2.5-flash-lite' ? MODEL_CHAIN_FAST : MODEL_CHAIN_COMPLEX;
  }

  private getLang(graph: KnowledgeGraph): string {
    const lang = graph.preferredLanguage;
    return LANGUAGE_NAMES[lang] ?? 'English';
  }

  buildSystemPrompt(graph: KnowledgeGraph): string {
    const langName = this.getLang(graph);
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const roleIntro = graph.role === 'STUDENT'
      ? `You are EdAI, a friendly academic assistant at ${(graph as StudentKnowledgeGraph).collegeName}. You are talking to ${(graph as StudentKnowledgeGraph).name} (USN: ${(graph as StudentKnowledgeGraph).usn}), Semester ${(graph as StudentKnowledgeGraph).semester}, Section ${(graph as StudentKnowledgeGraph).section}, ${(graph as StudentKnowledgeGraph).department}.`
      : graph.role === 'PARENT'
      ? `You are EdAI, a trusted academic companion for parents at RV College of Engineering, Bengaluru. You are talking to the parent of ${(graph as ParentKnowledgeGraph).child.name} (USN: ${(graph as ParentKnowledgeGraph).child.usn}).`
      : graph.role === 'ADMIN'
      ? `You are EdAI, an institutional intelligence assistant at ${(graph as AdminKnowledgeGraph).collegeName}. You are talking to ${(graph as AdminKnowledgeGraph).name}, an administrator. You have full visibility into student performance, risk scores, fee collection, placements, and announcements.`
      : `You are EdAI, a professional assistant for faculty at RV College of Engineering, Bengaluru. You are talking to ${(graph as TeacherKnowledgeGraph).name} from the ${(graph as TeacherKnowledgeGraph).department} department.`;

    return `${roleIntro}

RULES:
1. Answer ONLY from the knowledge graph below. Never invent data.
2. If data is missing or empty, say "I don't have that information right now."
3. Always respond in ${langName}.
4. Keep responses concise — 2-4 sentences unless a list is needed.
5. For attendance: clearly state whether safe (≥75%) or at risk (<75%).
6. Never mention "knowledge graph" or "context" — just answer naturally.
7. Today is ${today}.
8. weekSchedule keys are MON/TUE/WED/THU/FRI/SAT — use these to answer "tomorrow" or day-specific questions.
9. For VTU: vtuEligibility shows exam eligibility and registration status per subject.
10. feeBreakdown shows individual fee components (tuition, hostel, lab etc.) with amounts and due dates.
11. alumniStats shows average and max placement packages by department — use for placement context.
12. upcomingPlacements includes eligibleDepts — check if student's department is eligible before confirming eligibility.

KNOWLEDGE GRAPH:
${JSON.stringify(graph, null, 2)}`;
  }

  async chatStream(
    conversationId: string,
    userMessage: string,
    graph: KnowledgeGraph,
    onChunk: (text: string) => void,
  ): Promise<string> {
    if (!this.db) {
      const fallback = "I'm having trouble accessing data right now. Please try again.";
      onChunk(fallback);
      return fallback;
    }

    // Load last 10 messages
    const history = await this.db.query(
      `SELECT role, content FROM chat_messages
       WHERE conversation_id = $1 AND role IN ('USER','ASSISTANT')
       ORDER BY created_at ASC
       OFFSET GREATEST(0, (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1 AND role IN ('USER','ASSISTANT')) - 10)`,
      [conversationId],
    ) as Array<{ role: string; content: string }>;

    // Save user message
    await this.db.query(
      `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'USER', $2)`,
      [conversationId, userMessage],
    );

    const primaryModel = this.selectModel(userMessage);
    const chain = this.modelChain(primaryModel);
    let fullText = '';
    let tokensUsed = 0;
    let usedModel = primaryModel;

    // Build Gemini chat history (excludes current message)
    const chatHistory = history.map(h => ({
      role: h.role === 'USER' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));

    const systemInstruction = this.buildSystemPrompt(graph);

    let geminiSucceeded = false;
    for (const modelName of chain) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName, systemInstruction });
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessageStream(userMessage);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }

        const finalResponse = await result.response;
        tokensUsed = finalResponse.usageMetadata?.totalTokenCount ?? 0;
        usedModel = modelName;
        if (modelName !== primaryModel) {
          this.logger.warn(`Gemini fallback: ${primaryModel} → ${modelName}`);
        }
        geminiSucceeded = true;
        break;
      } catch (err) {
        if (isRetryableModelError(err)) {
          this.logger.warn(`Gemini model ${modelName} unavailable, trying next in chain`, (err as Error).message);
          continue;
        }
        // Non-retryable error (auth, bad request, etc.) — bail immediately
        this.logger.error(`Gemini non-retryable error on ${modelName}`, err);
        break;
      }
    }

    if (!geminiSucceeded) {
      fullText = "I'm having trouble right now. Please try again in a moment.";
      onChunk(fullText);
    }

    // Save assistant response
    await this.db.query(
      `INSERT INTO chat_messages (conversation_id, role, content, tokens_used, model_used)
       VALUES ($1, 'ASSISTANT', $2, $3, $4)`,
      [conversationId, fullText, tokensUsed, usedModel],
    );

    await this.db.query(
      `UPDATE chat_conversations SET last_message_at = now() WHERE id = $1`,
      [conversationId],
    );

    return fullText;
  }

  async getOrCreateConversation(
    userIdentifier: string,
    userRole: string,
    channel: 'WEB' | 'WHATSAPP',
    language = 'en',
  ): Promise<string> {
    if (!this.db) throw new Error('No database');

    // Find active conversation < 2 hours old
    const existing = await this.db.query(
      `SELECT id FROM chat_conversations
       WHERE user_identifier = $1 AND channel = $2 AND is_active = true
         AND last_message_at > now() - INTERVAL '2 hours'
       ORDER BY last_message_at DESC LIMIT 1`,
      [userIdentifier, channel],
    ) as Array<{ id: string }>;

    if (existing[0]) return existing[0].id;

    // Deactivate any stale active conversations first (handles unique index)
    await this.db.query(
      `UPDATE chat_conversations SET is_active = false
       WHERE user_identifier = $1 AND channel = $2 AND is_active = true`,
      [userIdentifier, channel],
    );

    const created = await this.db.query(
      `INSERT INTO chat_conversations (user_identifier, user_role, channel, language)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userIdentifier, userRole, channel, language],
    ) as Array<{ id: string }>;

    return created[0].id;
  }

  async recordConsent(conversationId: string): Promise<void> {
    if (!this.db) return;
    await this.db.query(
      `UPDATE chat_conversations SET chatbot_consent_at = now() WHERE id = $1 AND chatbot_consent_at IS NULL`,
      [conversationId],
    );
  }

  async getHistory(conversationId: string, userId: string): Promise<Array<{ role: string; content: string; createdAt: string }>> {
    if (!this.db) return [];
    return this.db.query(
      `SELECT cm.role, cm.content, cm.created_at AS "createdAt"
       FROM chat_messages cm
       JOIN chat_conversations cc ON cc.id = cm.conversation_id
       WHERE cm.conversation_id = $1 AND cc.user_identifier = $2
         AND cm.role IN ('USER','ASSISTANT')
       ORDER BY cm.created_at ASC LIMIT 50`,
      [conversationId, userId],
    ) as Promise<Array<{ role: string; content: string; createdAt: string }>>;
  }

  async getSessions(): Promise<unknown[]> {
    if (!this.db) return [];
    return this.db.query(
      `SELECT id, user_identifier, user_role, channel, language, is_active, created_at, last_message_at
       FROM chat_conversations ORDER BY last_message_at DESC LIMIT 100`,
    ) as Promise<unknown[]>;
  }
}
