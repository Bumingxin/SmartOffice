export const CHAT_AUDIO_TRANSCRIPTION_UNAVAILABLE_ERROR_CODE = 'chat.audioTranscriptionUnavailable';
export const CHAT_AUDIO_TRANSCRIPTION_FAILED_ERROR_CODE = 'chat.audioTranscriptionFailed';

export class AudioPreparationError extends Error {
  readonly messageCode: string;
  readonly rawDetail: string;

  constructor(messageCode: string, rawDetail: string) {
    super(rawDetail);
    this.name = 'AudioPreparationError';
    this.messageCode = messageCode;
    this.rawDetail = rawDetail;
  }
}
