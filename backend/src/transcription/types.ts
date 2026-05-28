export type TranscriptionProviderId = 'local' | 'siliconflow' | 'openclaw';

export type PreparedAudioTranscript = {
  displayName: string;
  absolutePath: string;
  mimeType: string | null;
  text: string;
  provider?: string;
};

export type AudioTranscriptionConfig = {
  defaultProvider: TranscriptionProviderId;
  fallbackProviders: TranscriptionProviderId[];
  localModel: string;
  localPythonPath?: string;
  timeoutMs: number;
  enableOpenClawProvider: boolean;
  siliconFlowApiKey?: string;
  siliconFlowModel: string;
};

export type AudioTranscriptionRequest = {
  filePath: string;
  displayName: string;
  mimeType: string | null;
  agentId?: string;
};

export type AudioTranscriptionResult = {
  text: string;
  provider: string;
};

export type AudioProvider = {
  id: TranscriptionProviderId;
  transcribe: (request: AudioTranscriptionRequest, config: AudioTranscriptionConfig) => Promise<AudioTranscriptionResult | null>;
};
