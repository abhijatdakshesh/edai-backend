// HORIZONTAL_SCALE_GAP: in-memory; move to Redis when ACA scale > 1
import { Injectable, Logger } from '@nestjs/common';

export type TurnRole = 'AI' | 'PARENT';

export interface Turn {
  turn: number;
  role: TurnRole;
  text: string;
  language: string;
  ts: string;
}

export interface ConversationContext {
  usn: string;
  language: string;
  callType: string;
  parentName?: string;
  parentPhone?: string;
  institutionId: string;
  knowledgeGraph?: unknown;
}

export interface ConversationState extends ConversationContext {
  callId: string;
  turns: Turn[];
  startedAt: number;
  lastTurnAt: number;
}

const TTL_MS = 5 * 60 * 1000;

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly states = new Map<string, ConversationState>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  init(callId: string, ctx: ConversationContext): ConversationState {
    const now = Date.now();
    const state: ConversationState = {
      callId,
      ...ctx,
      turns: [],
      startedAt: now,
      lastTurnAt: now,
    };
    this.states.set(callId, state);
    this.resetTimer(callId);
    return state;
  }

  get(callId: string): ConversationState | undefined {
    return this.states.get(callId);
  }

  setKnowledgeGraph(callId: string, kg: unknown): void {
    const s = this.states.get(callId);
    if (s) s.knowledgeGraph = kg;
  }

  pushTurn(callId: string, role: TurnRole, text: string, language: string): Turn | undefined {
    const s = this.states.get(callId);
    if (!s) return undefined;
    const turn: Turn = {
      turn: s.turns.length,
      role,
      text,
      language,
      ts: new Date().toISOString(),
    };
    s.turns.push(turn);
    s.lastTurnAt = Date.now();
    this.resetTimer(callId);
    return turn;
  }

  count(callId: string): number {
    return this.states.get(callId)?.turns.length ?? 0;
  }

  evict(callId: string): void {
    const t = this.timers.get(callId);
    if (t) clearTimeout(t);
    this.timers.delete(callId);
    this.states.delete(callId);
  }

  private resetTimer(callId: string): void {
    const existing = this.timers.get(callId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.logger.debug(`Evicting expired conversation ${callId}`);
      this.states.delete(callId);
      this.timers.delete(callId);
    }, TTL_MS);
    // Don't keep Node alive on dangling state timers in tests
    if (typeof t.unref === 'function') t.unref();
    this.timers.set(callId, t);
  }
}
