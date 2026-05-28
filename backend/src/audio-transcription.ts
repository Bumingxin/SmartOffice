import type { WorkspaceUploadLink } from './message-upload-rewrite';
import ConfigManager from './config-manager';
import {
  AudioPreparationError,
  CHAT_AUDIO_TRANSCRIPTION_FAILED_ERROR_CODE,
  CHAT_AUDIO_TRANSCRIPTION_UNAVAILABLE_ERROR_CODE,
} from './transcription/errors';
import type { PreparedAudioTranscript, AudioTranscriptionConfig } from './transcription/types';
import { transcribeWithAdapter } from './transcription/adapter';
import { ensureManagedLocalAudioRuntimeReady as ensureLocalRuntimeReady } from './transcription/providers/local-whisper';

function dedupeAudioUploads(uploads: WorkspaceUploadLink[]): WorkspaceUploadLink[] {
  const seen = new Set<string>();
  const deduped: WorkspaceUploadLink[] = [];

  for (const upload of uploads) {
    if (upload.kind !== 'audio') continue;
    if (seen.has(upload.absolutePath)) continue;
    seen.add(upload.absolutePath);
    deduped.push(upload);
  }

  return deduped;
}

function resolveAudioTranscriptionConfig(): AudioTranscriptionConfig {
  const stored = new ConfigManager().getConfig().audioTranscription || {};
  const timeoutMsRaw = Number(process.env.SMARTOFFICE_AUDIO_TRANSCRIPTION_TIMEOUT_MS || stored.timeoutMs || '900000');
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 900000;
  const defaultProvider = (process.env.SMARTOFFICE_AUDIO_PROVIDER || stored.defaultProvider || 'local').trim().toLowerCase();
  const fallbackProviders = (process.env.SMARTOFFICE_AUDIO_FALLBACKS || (stored.fallbackProviders || ['siliconflow', 'openclaw']).join(','))
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) as Array<'local' | 'siliconflow' | 'openclaw'>;

  return {
    defaultProvider: (defaultProvider === 'siliconflow' || defaultProvider === 'openclaw' ? defaultProvider : 'local'),
    fallbackProviders,
    localModel: process.env.SMARTOFFICE_LOCAL_WHISPER_MODEL || stored.localModel || 'base',
    localPythonPath: process.env.SMARTOFFICE_LOCAL_PYTHON_PATH || stored.localPythonPath || undefined,
    timeoutMs,
    enableOpenClawProvider: process.env.SMARTOFFICE_ENABLE_OPENCLAW_AUDIO_PROVIDER === '1' || stored.enableOpenClawProvider === true,
    siliconFlowApiKey: process.env.SILICONFLOW_API_KEY || process.env.SMARTOFFICE_SILICONFLOW_API_KEY || stored.siliconFlowApiKey || undefined,
    siliconFlowModel: process.env.SMARTOFFICE_SILICONFLOW_MODEL || stored.siliconFlowModel || 'FunAudioLLM/SenseVoiceSmall',
  };
}

export {
  AudioPreparationError,
  CHAT_AUDIO_TRANSCRIPTION_FAILED_ERROR_CODE,
  CHAT_AUDIO_TRANSCRIPTION_UNAVAILABLE_ERROR_CODE,
};
export type { PreparedAudioTranscript };

export async function prepareAudioTranscriptsFromUploads(
  uploads: WorkspaceUploadLink[],
  agentId: string
): Promise<PreparedAudioTranscript[]> {
  const audioUploads = dedupeAudioUploads(uploads);
  if (audioUploads.length === 0) {
    return [];
  }

  const config = resolveAudioTranscriptionConfig();
  const transcripts: PreparedAudioTranscript[] = [];

  try {
    for (const upload of audioUploads) {
      const displayName = upload.altText || upload.filename;
      const result = await transcribeWithAdapter({
        filePath: upload.absolutePath,
        displayName,
        mimeType: upload.mimeType,
        agentId,
      }, config);

      transcripts.push({
        displayName,
        absolutePath: upload.absolutePath,
        mimeType: upload.mimeType,
        text: result.text,
        provider: result.provider,
      });
    }

    return transcripts;
  } catch (error) {
    if (error instanceof AudioPreparationError) throw error;

    const detail = error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Audio transcription failed before the model request started.';

    throw new AudioPreparationError(CHAT_AUDIO_TRANSCRIPTION_FAILED_ERROR_CODE, detail);
  }
}

export async function ensureManagedLocalAudioRuntimeReady() {
  return ensureLocalRuntimeReady(resolveAudioTranscriptionConfig());
}

export function buildAudioTranscriptContext(transcripts: PreparedAudioTranscript[]): string {
  if (transcripts.length === 0) {
    return '';
  }

  const sections = transcripts.map((transcript, index) => [
    `[System audio transcript ${index + 1}: ${transcript.displayName}]`,
    'The following text was automatically transcribed from an uploaded audio file. It may contain recognition mistakes, so use it together with the original file path when analyzing the audio.',
    transcript.text,
  ].join('\n\n'));

  return [
    '[System note: audio attachments were automatically transcribed before this turn was sent to the model.]',
    ...sections,
  ].join('\n\n');
}
