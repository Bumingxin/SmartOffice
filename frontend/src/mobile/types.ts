export type MobileTab = 'chat' | 'groups' | 'settings';
export type SettingsSection = 'gateway' | 'general' | 'models' | 'commands' | 'about';

export interface SessionSummary {
  id: string;
  name: string;
  agentId?: string;
  model?: string;
  process_start_tag?: string;
  process_end_tag?: string;
  runtimeMode?: string;
  systemPromptMode?: string;
  toolMode?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  processContent?: string;
  processStreaming?: boolean;
  timestamp: Date;
  model?: string;
  agentId?: string;
  agentName?: string;
  parentId?: string;
}

export interface GroupMember {
  agent_id?: string;
  agentId?: string;
  display_name?: string;
  displayName?: string;
  role_description?: string;
  roleDescription?: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  process_start_tag?: string;
  process_end_tag?: string;
  max_chain_depth?: number;
  members?: GroupMember[];
}

export interface ModelSummary {
  id?: string;
  name?: string;
  modelName?: string;
  endpoint?: string;
  provider?: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface AppConfig {
  gatewayUrl: string;
  token: string;
  defaultAgent: string;
  language: string;
  hasToken: boolean;
  hasPassword: boolean;
  aiName: string;
  loginEnabled: boolean;
  loginPassword: string;
  allowedHosts: string[];
  historyPageRounds: number;
  previewConversionTimeoutSeconds: number;
}

export interface QuickCommand {
  id: number;
  command: string;
  description: string;
}

export interface EndpointSummary {
  id: string;
  name?: string;
  api?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface CharacterConfig {
  id?: string;
  agentId: string;
  name: string;
  systemPrompt?: string;
  model?: string;
}

export interface MobileDataState {
  sessions: SessionSummary[];
  groups: GroupSummary[];
  models: ModelSummary[];
  endpoints: EndpointSummary[];
  commands: QuickCommand[];
  config: AppConfig | null;
  isLoading: boolean;
  error: string;
}
