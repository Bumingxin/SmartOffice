import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import type { AudioProvider, AudioTranscriptionConfig, AudioTranscriptionRequest, AudioTranscriptionResult } from '../types';

const MANAGED_AUDIO_RUNTIME_DIR = path.join(os.homedir(), '.openclaw', 'host-tools', 'audio-transcription');
const MANAGED_AUDIO_RUNTIME_VENV_DIR = path.join(MANAGED_AUDIO_RUNTIME_DIR, 'venv');
const MANAGED_AUDIO_RUNTIME_PYTHON_PATH = path.join(MANAGED_AUDIO_RUNTIME_VENV_DIR, 'bin', 'python');
const MANAGED_AUDIO_RUNTIME_BOOTSTRAP_TIMEOUT_MS = 20 * 60 * 1000;
const LOCAL_AUDIO_DISCOVERY_TIMEOUT_MS = 15_000;
const LOCAL_AUDIO_DURATION_PROBE_TIMEOUT_MS = 15_000;
const LOCAL_AUDIO_TRANSCRIPTION_MIN_TIMEOUT_MS = 10 * 60 * 1000;
const LOCAL_AUDIO_TRANSCRIPTION_MAX_TIMEOUT_MS = 90 * 60 * 1000;
const LOCAL_AUDIO_TRANSCRIPTION_TIMEOUT_MULTIPLIER = 1.5;
const LOCAL_AUDIO_TRANSCRIPTION_TIMEOUT_BUFFER_MS = 5 * 60 * 1000;
const LOCAL_AUDIO_RUNTIME_PACKAGE = 'faster-whisper';
const SCRIPT_PATH = '/root/SmartOffice/backend/tools/transcribe_audio.py';

const LOCAL_AUDIO_BACKEND_DISCOVERY_SCRIPT = [
  'import importlib.util',
  'backend = ""',
  'if importlib.util.find_spec("faster_whisper") is not None:',
  '    backend = "faster_whisper"',
  'elif importlib.util.find_spec("whisper") is not None:',
  '    backend = "whisper"',
  'print(backend)',
].join('\n');

type CachedLocalAudioBackendAvailability = {
  checkedAt: number;
  pythonCommand: string | null;
  backend: 'faster_whisper' | 'whisper' | null;
  detail: string;
};

let localAudioBackendCache: CachedLocalAudioBackendAvailability | null = null;
let managedLocalAudioRuntimeBootstrapPromise: Promise<CachedLocalAudioBackendAvailability> | null = null;

function execFileText(
  file: string,
  args: string[],
  timeoutMs: number,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      cwd: options.cwd,
      env: options.env,
    }, (error, stdout, stderr) => {
      if (error) {
        const enrichedError = error as Error & { stdout?: string; stderr?: string; killed?: boolean; signal?: string };
        enrichedError.stdout = typeof stdout === 'string' ? stdout : String(stdout || '');
        enrichedError.stderr = typeof stderr === 'string' ? stderr : String(stderr || '');
        reject(enrichedError);
        return;
      }

      resolve({
        stdout: typeof stdout === 'string' ? stdout : String(stdout || ''),
        stderr: typeof stderr === 'string' ? stderr : String(stderr || ''),
      });
    });
  });
}

function extractLastNonEmptyLine(value: string): string {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

async function probeAudioDurationMs(filePath: string): Promise<number | null> {
  try {
    const result = await execFileText('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ], LOCAL_AUDIO_DURATION_PROBE_TIMEOUT_MS);
    const payload = JSON.parse(result.stdout) as { format?: { duration?: string | number } };
    const durationSeconds = Number(payload?.format?.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
    return Math.ceil(durationSeconds * 1000);
  } catch {
    return null;
  }
}

function computeLocalAudioTranscriptionTimeoutMs(durationMs: number | null): number {
  if (!durationMs || durationMs <= 0) return LOCAL_AUDIO_TRANSCRIPTION_MIN_TIMEOUT_MS;
  const scaledTimeout = Math.ceil((durationMs * LOCAL_AUDIO_TRANSCRIPTION_TIMEOUT_MULTIPLIER) + LOCAL_AUDIO_TRANSCRIPTION_TIMEOUT_BUFFER_MS);
  return Math.max(LOCAL_AUDIO_TRANSCRIPTION_MIN_TIMEOUT_MS, Math.min(LOCAL_AUDIO_TRANSCRIPTION_MAX_TIMEOUT_MS, scaledTimeout));
}

async function inspectLocalAudioBackendWithPython(pythonCommand: string): Promise<CachedLocalAudioBackendAvailability | null> {
  try {
    const result = await execFileText(pythonCommand, ['-c', LOCAL_AUDIO_BACKEND_DISCOVERY_SCRIPT], LOCAL_AUDIO_DISCOVERY_TIMEOUT_MS);
    const backend = extractLastNonEmptyLine(result.stdout);
    if (backend === 'faster_whisper' || backend === 'whisper') {
      return {
        checkedAt: Date.now(),
        pythonCommand,
        backend,
        detail: `${backend} via ${pythonCommand}`,
      };
    }
  } catch {}
  return null;
}

async function bootstrapManagedLocalAudioRuntime(): Promise<CachedLocalAudioBackendAvailability> {
  if (managedLocalAudioRuntimeBootstrapPromise) return managedLocalAudioRuntimeBootstrapPromise;

  managedLocalAudioRuntimeBootstrapPromise = (async () => {
    fs.mkdirSync(MANAGED_AUDIO_RUNTIME_DIR, { recursive: true });
    if (!fs.existsSync(MANAGED_AUDIO_RUNTIME_PYTHON_PATH)) {
      await execFileText('python3', ['-m', 'venv', MANAGED_AUDIO_RUNTIME_VENV_DIR], MANAGED_AUDIO_RUNTIME_BOOTSTRAP_TIMEOUT_MS);
    }

    const managedEnv = {
      ...process.env,
      PIP_DISABLE_PIP_VERSION_CHECK: '1',
      PYTHONUNBUFFERED: '1',
    };

    await execFileText(MANAGED_AUDIO_RUNTIME_PYTHON_PATH, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'], MANAGED_AUDIO_RUNTIME_BOOTSTRAP_TIMEOUT_MS, { env: managedEnv });
    await execFileText(MANAGED_AUDIO_RUNTIME_PYTHON_PATH, ['-m', 'pip', 'install', '--upgrade', '--prefer-binary', LOCAL_AUDIO_RUNTIME_PACKAGE], MANAGED_AUDIO_RUNTIME_BOOTSTRAP_TIMEOUT_MS, { env: managedEnv });

    const detected = await inspectLocalAudioBackendWithPython(MANAGED_AUDIO_RUNTIME_PYTHON_PATH);
    if (!detected?.backend) {
      throw new Error(`Managed audio transcription runtime was installed at ${MANAGED_AUDIO_RUNTIME_VENV_DIR}, but no usable backend was detected afterwards.`);
    }
    localAudioBackendCache = detected;
    return detected;
  })().finally(() => {
    managedLocalAudioRuntimeBootstrapPromise = null;
  });

  return managedLocalAudioRuntimeBootstrapPromise;
}

export async function detectLocalAudioBackend(
  config?: Partial<AudioTranscriptionConfig>,
  options: { allowAutoBootstrap?: boolean } = {}
): Promise<CachedLocalAudioBackendAvailability> {
  if (localAudioBackendCache && (Date.now() - localAudioBackendCache.checkedAt) < 30_000) {
    return localAudioBackendCache;
  }

  const pythonCommands = [
    config?.localPythonPath,
    MANAGED_AUDIO_RUNTIME_PYTHON_PATH,
    'python3',
    'python',
  ].filter((value): value is string => !!value);

  for (const pythonCommand of pythonCommands) {
    const detected = await inspectLocalAudioBackendWithPython(pythonCommand);
    if (detected) {
      localAudioBackendCache = detected;
      return detected;
    }
  }

  if (options.allowAutoBootstrap) {
    try {
      return await bootstrapManagedLocalAudioRuntime();
    } catch (error: any) {
      localAudioBackendCache = {
        checkedAt: Date.now(),
        pythonCommand: MANAGED_AUDIO_RUNTIME_PYTHON_PATH,
        backend: null,
        detail: typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Managed audio transcription runtime bootstrap failed.',
      };
      return localAudioBackendCache;
    }
  }

  localAudioBackendCache = {
    checkedAt: Date.now(),
    pythonCommand: null,
    backend: null,
    detail: 'No local whisper or faster-whisper runtime detected.',
  };
  return localAudioBackendCache;
}

export async function ensureManagedLocalAudioRuntimeReady(config?: Partial<AudioTranscriptionConfig>): Promise<CachedLocalAudioBackendAvailability> {
  return detectLocalAudioBackend(config, { allowAutoBootstrap: true });
}

export const localWhisperProvider: AudioProvider = {
  id: 'local',
  async transcribe(request: AudioTranscriptionRequest, config: AudioTranscriptionConfig): Promise<AudioTranscriptionResult | null> {
    const localBackend = await detectLocalAudioBackend(config, { allowAutoBootstrap: true });
    if (!localBackend.backend || !localBackend.pythonCommand) return null;

    const durationMs = await probeAudioDurationMs(request.filePath);
    const timeoutMs = computeLocalAudioTranscriptionTimeoutMs(durationMs);
    const result = await execFileText(
      localBackend.pythonCommand,
      [SCRIPT_PATH, request.filePath, config.localModel || 'base'],
      timeoutMs,
      {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      }
    );

    const payload = JSON.parse(result.stdout) as { ok?: boolean; text?: string; provider?: string; error?: string };
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!payload?.ok || !text) {
      throw new Error(payload?.error || `Local audio transcription returned no text for "${request.displayName}".`);
    }

    return {
      text,
      provider: payload.provider || `local-${localBackend.backend}`,
    };
  },
};
