import type { AudioProvider, AudioTranscriptionConfig, AudioTranscriptionRequest, AudioTranscriptionResult } from '../types';

export const openClawProvider: AudioProvider = {
  id: 'openclaw',
  async transcribe(_request: AudioTranscriptionRequest, config: AudioTranscriptionConfig): Promise<AudioTranscriptionResult | null> {
    if (!config.enableOpenClawProvider) {
      return null;
    }

    throw new Error('OpenClaw audio transcription provider is intentionally disabled in the stable architecture until a public CLI or API integration is wired.');
  },
};
