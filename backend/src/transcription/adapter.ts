import type { AudioTranscriptionConfig, AudioTranscriptionRequest, AudioTranscriptionResult, AudioProvider } from './types';
import { localWhisperProvider } from './providers/local-whisper';
import { siliconFlowProvider } from './providers/siliconflow';
import { openClawProvider } from './providers/openclaw';
import { AudioPreparationError } from './errors';

const providers: Record<string, AudioProvider> = {
  local: localWhisperProvider,
  siliconflow: siliconFlowProvider,
  openclaw: openClawProvider,
};

export async function transcribeWithAdapter(
  request: AudioTranscriptionRequest,
  config: AudioTranscriptionConfig
): Promise<AudioTranscriptionResult> {
  const orderedProviderIds = [
    config.defaultProvider,
    ...config.fallbackProviders.filter((providerId) => providerId !== config.defaultProvider),
  ];

  const failures: string[] = [];

  for (const providerId of orderedProviderIds) {
    const provider = providers[providerId];
    if (!provider) continue;

    try {
      const result = await provider.transcribe(request, config);
      if (result?.text?.trim()) return result;
      failures.push(`${providerId}: unavailable`);
    } catch (error: any) {
      const detail = typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'unknown error';
      failures.push(`${providerId}: ${detail}`);
    }
  }

  throw new AudioPreparationError(
    'chat.audioTranscriptionFailed',
    `Audio transcription failed for "${request.displayName}". Attempts: ${failures.join(' | ') || 'none'}`
  );
}
