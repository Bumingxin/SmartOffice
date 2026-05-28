import axios from 'axios';
import type { AudioProvider, AudioTranscriptionConfig, AudioTranscriptionRequest, AudioTranscriptionResult } from '../types';

const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/audio/transcriptions';

export const siliconFlowProvider: AudioProvider = {
  id: 'siliconflow',
  async transcribe(request: AudioTranscriptionRequest, config: AudioTranscriptionConfig): Promise<AudioTranscriptionResult | null> {
    const apiKey = config.siliconFlowApiKey?.trim();
    if (!apiKey) return null;

    const form = new FormData();
    const fileBuffer = await (await import('fs/promises')).readFile(request.filePath);
    const blob = new Blob([fileBuffer]);
    form.append('file', blob, request.displayName || 'audio');
    form.append('model', config.siliconFlowModel || 'FunAudioLLM/SenseVoiceSmall');

    const response = await axios.post(SILICONFLOW_ENDPOINT, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: config.timeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const detail = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data || {});
      throw new Error(`SiliconFlow transcription failed (${response.status}): ${detail}`);
    }

    const text = typeof response.data?.text === 'string' ? response.data.text.trim() : '';
    if (!text) {
      throw new Error(`SiliconFlow returned no text for "${request.displayName}".`);
    }

    return {
      text,
      provider: 'siliconflow',
    };
  },
};
