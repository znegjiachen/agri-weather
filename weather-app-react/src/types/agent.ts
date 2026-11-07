import type { Dispatch, SetStateAction } from 'react';

/** 视觉模型返回的结构化识别结果（字段可能缺失） */
export interface VisionIssue {
  type?: string;
  name?: string;
  confidence?: number;
  symptoms?: string;
  suggestion?: string;
}

export interface VisionResult {
  plantName?: string;
  scientificName?: string;
  growthStage?: string;
  healthStatus?: string;
  issues?: VisionIssue[];
  overallAssessment?: string;
  careAdvice?: string[];
  confidence?: number;
  [key: string]: unknown;
}

export interface KnowledgeRef {
  title?: string;
  source?: string;
  [key: string]: unknown;
}

export interface ToolCallTrace {
  round: number;
  tool: string;
  arguments?: string;
  resultSummary?: string;
  elapsedMs?: number | null;
}

export interface ThoughtTrace {
  round: number;
  content: string;
}

export interface ChatDocument {
  documentId?: number;
  filename: string;
  preview?: string;
  charCount?: number;
  chunkCount?: number;
  truncated?: boolean;
  text?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  liveContent?: string;
  images?: string[];
  vision?: VisionResult | null;
  documents?: ChatDocument[];
  document?: ChatDocument | null;
  toolCalls?: ToolCallTrace[];
  thoughts?: ThoughtTrace[];
  knowledgeUsed?: KnowledgeRef[];
  truncated?: boolean;
  rounds?: number;
  liveThought?: string;
  liveThoughtRound?: number | null;
  currentRound?: number | null;
  feedback?: string;
}

export interface AgentHistory {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  clearHistory: () => Promise<void> | void;
  clearMessages?: () => void;
  loading: boolean;
  error: string;
  retry: () => void;
}

export interface AgentStatus {
  configured?: boolean;
  asrConfigured?: boolean;
  model?: string;
  [key: string]: unknown;
}

export interface AgentSummary {
  id: number;
  name?: string;
  farmlandId?: number;
  farmlandName?: string;
  cropName?: string;
  avatar?: string;
  welcome?: string;
  [key: string]: unknown;
}

export interface FieldContext {
  id?: number;
  agentId?: number;
  name?: string;
  cropName?: string;
  agentName?: string;
  [key: string]: unknown;
}

export interface PhotoAttachment {
  file: File;
  preview: string;
}

export interface VoiceInput {
  recording: boolean;
  processing: boolean;
  toggle: () => void;
  mode?: string | null;
  supported: boolean;
}

export interface ChatDone {
  reply: string;
  toolCalls?: ToolCallTrace[];
  thoughts?: ThoughtTrace[];
  knowledgeUsed?: KnowledgeRef[];
  truncated?: boolean;
  rounds?: number;
  model?: string;
}

export interface ChatStreamHandlers {
  signal?: AbortSignal;
  onRound?: (payload: { round: number }) => void;
  onReasoningDelta?: (payload: { round: number; delta: string }) => void;
  onContentDelta?: (payload: { round: number; delta: string }) => void;
  onThought?: (payload: { round: number; content: string }) => void;
  onToolStarted?: (payload: { round: number; tool: string; arguments: string }) => void;
  onToolFinished?: (payload: {
    round: number;
    tool: string;
    arguments: string;
    resultSummary: string;
    elapsedMs: number;
  }) => void;
}
