import WebSocket from 'ws';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const CHAT_SEND_START_TIMEOUT_MS = 5 * 60 * 1000;
const CHAT_HISTORY_TIMEOUT_MS = 90 * 1000;
const GATEWAY_CONNECT_TIMEOUT_MS = 15000;

interface OpenClawConfig {
  gatewayUrl: string;
  token?: string;
  password?: string;
}

type Pending = {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

type SessionToolEventPayload = {
  sessionKey?: string;
  parentSessionKey?: string;
  runId?: string;
  ts?: number;
  stream?: string;
  data?: any;
  session?: any;
};

// ── Ed25519 device identity helpers (OpenClaw 2026.6+) ──

const ED25519_SPKI_PREFIX = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
const ED25519_PKCS8_PREFIX = Buffer.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function extractRawPublicKey(spkiDer: Buffer): Buffer {
  return spkiDer.subarray(ED25519_SPKI_PREFIX.length);
}

function extractRawPrivateKey(pkcs8Der: Buffer): Buffer {
  return pkcs8Der.subarray(ED25519_PKCS8_PREFIX.length);
}

function buildRawPublicKey(rawPub: Buffer): crypto.KeyObject {
  const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, rawPub]);
  return crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
}

function buildRawPrivateKey(rawPriv: Buffer): crypto.KeyObject {
  const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, rawPriv]);
  return crypto.createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
}

function ed25519Sign(payload: string, privateKey: crypto.KeyObject): string {
  const sig = crypto.sign(null, Buffer.from(payload), privateKey);
  return base64UrlEncode(sig);
}

interface DeviceIdentityState {
  deviceId: string;
  publicKey: string;
  privateKey: string;
  deviceToken?: string;
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string | null;
}): string {
  const version = params.nonce ? 'v2' : 'v1';
  const parts = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token,
  ];
  if (params.nonce) parts.push(params.nonce);
  return parts.join('|');
}

class DeviceIdentityManager {
  private statePath: string;
  private state: DeviceIdentityState | null = null;
  private privateKeyObj: crypto.KeyObject | null = null;

  constructor(baseDir: string) {
    this.statePath = path.join(baseDir, '.openclaw-device-identity.json');
  }

  load(): { deviceId: string; publicKey: string; privateKeyObj: crypto.KeyObject; deviceToken?: string } {
    if (this.state && this.privateKeyObj) {
      return {
        deviceId: this.state.deviceId,
        publicKey: this.state.publicKey,
        privateKeyObj: this.privateKeyObj,
        deviceToken: this.state.deviceToken,
      };
    }

    try {
      if (fs.existsSync(this.statePath)) {
        const raw = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
        if (raw && typeof raw.deviceId === 'string' && typeof raw.privateKey === 'string') {
          const privKey = buildRawPrivateKey(Buffer.from(raw.privateKey, 'hex'));
          this.state = raw;
          this.privateKeyObj = privKey;
          return {
            deviceId: raw.deviceId,
            publicKey: raw.publicKey,
            privateKeyObj: privKey,
            deviceToken: raw.deviceToken,
          };
        }
      }
    } catch {
      // fall through to generate new identity
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
    const rawPub = extractRawPublicKey(pubDer);
    const deviceId = crypto.createHash('sha256').update(rawPub).digest('hex');
    const pubBase64Url = base64UrlEncode(rawPub);
    const privHex = extractRawPrivateKey(privDer).toString('hex');

    this.state = {
      deviceId,
      publicKey: pubBase64Url,
      privateKey: privHex,
    };
    this.privateKeyObj = privateKey;

    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch {
      // non-fatal
    }

    return { deviceId, publicKey: pubBase64Url, privateKeyObj: privateKey };
  }

  saveDeviceToken(token: string): void {
    if (this.state) {
      this.state.deviceToken = token;
      try {
        fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
      } catch {
        // non-fatal
      }
    }
  }
}

// ── Gateway error with structured code ──

export class GatewayError extends Error {
  code: string;
  detail: any;
  constructor(code: string, message: string, detail?: any) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.detail = detail;
  }
}

// ── Message parsing helpers ──

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeOpenClawMessageRecord(message: any): any {
  let current = message;
  const seen = new Set<object>();

  while (current && typeof current === 'object' && !Array.isArray(current)) {
    if (seen.has(current)) {
      break;
    }
    seen.add(current);

    const nested = current.message;
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      break;
    }

    const currentHasRole = typeof current.role === 'string';
    const currentHasContent = current.content !== undefined;
    const nestedLooksLikeMessage = (
      typeof nested.role === 'string'
      || nested.content !== undefined
      || typeof nested.stopReason === 'string'
      || typeof nested.stop_reason === 'string'
      || nested.error !== undefined
      || nested.errorMessage !== undefined
    );

    if (!nestedLooksLikeMessage) {
      break;
    }

    if (current.type === 'message' || (!currentHasRole && !currentHasContent)) {
      current = {
        ...nested,
        timestamp: nested.timestamp ?? current.timestamp,
        createdAt: nested.createdAt ?? current.createdAt,
        created_at: nested.created_at ?? current.created_at,
      };
      continue;
    }

    break;
  }

  return current;
}

function extractContentTextParts(content: unknown, seen = new Set<object>()): string[] {
  if (!content) return [];
  if (typeof content === 'string') {
    return content.trim() ? [content] : [];
  }

  if (Array.isArray(content)) {
    return content.flatMap((item) => extractContentTextParts(item, seen));
  }

  if (typeof content !== 'object') {
    return [];
  }

  if (seen.has(content)) {
    return [];
  }
  seen.add(content);

  const record = content as Record<string, unknown>;
  const directText = [record.text, record.content].find(isNonEmptyString);
  if (directText) {
    return [directText];
  }

  if (record.message) {
    return extractContentTextParts(record.message, seen);
  }

  return [];
}

export function extractOpenClawMessageText(message: any): string {
  if (!message) return '';
  const normalizedMessage = normalizeOpenClawMessageRecord(message);

  const contentText = extractContentTextParts(normalizedMessage?.content);
  if (contentText.length > 0) {
    return contentText.join('\n');
  }

  const directText = [
    normalizedMessage?.text,
    normalizedMessage?.content,
  ].find(isNonEmptyString);

  return directText || '';
}

export function extractOpenClawMessageError(message: any): string {
  if (!message) return '';
  const normalizedMessage = normalizeOpenClawMessageRecord(message);

  const candidates = [
    normalizedMessage?.errorMessage,
    normalizedMessage?.error_message,
    normalizedMessage?.error,
    normalizedMessage?.detail,
    normalizedMessage?.reason,
    normalizedMessage?.description,
    normalizedMessage?.stderr,
    normalizedMessage?.stdout,
    normalizedMessage?.message?.errorMessage,
    normalizedMessage?.message?.error,
    normalizedMessage?.message?.detail,
    normalizedMessage?.message?.reason,
    normalizedMessage?.metadata?.errorMessage,
    normalizedMessage?.metadata?.error,
    normalizedMessage?.metadata?.detail,
    normalizedMessage?.metadata?.reason,
  ];

  for (const candidate of candidates) {
    const detail = extractErrorDetail(candidate);
    if (detail) return detail;
  }

  return '';
}

function extractChatEventText(payload: any): string {
  const messageText = extractOpenClawMessageText(payload?.message);
  if (messageText) return messageText;

  const directText = [
    payload?.text,
    payload?.delta?.text,
  ].find(isNonEmptyString);

  return directText || '';
}

function safeSerializeDetail(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized === '{}' || serialized === '[]') {
      return '';
    }
    return serialized.length > 2000 ? `${serialized.slice(0, 2000)}...` : serialized;
  } catch {
    return '';
  }
}

function extractErrorDetail(value: unknown, seen = new Set<object>()): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const detail = extractErrorDetail(item, seen);
      if (detail) return detail;
    }
    return '';
  }
  if (typeof value !== 'object') {
    return '';
  }

  if (seen.has(value)) {
    return '';
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  const preferredKeys = ['message', 'detail', 'error', 'reason', 'text', 'description', 'stderr', 'stdout'];
  for (const key of preferredKeys) {
    const detail = extractErrorDetail(record[key], seen);
    if (detail) return detail;
  }

  return safeSerializeDetail(record);
}

function extractChatEventError(payload: any, frameError?: unknown): string {
  const candidates = [
    payload?.error,
    payload?.detail,
    payload?.reason,
    payload?.message?.error,
    payload?.message?.detail,
    payload?.message?.reason,
    frameError,
    extractChatEventText(payload),
  ];

  for (const candidate of candidates) {
    const detail = extractErrorDetail(candidate);
    if (detail) return detail;
  }

  return 'Unknown stream error';
}

export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: OpenClawConfig;
  private connected = false;
  private pending = new Map<string, Pending>();
  private connectPromise: Promise<void> | null = null;
  private sessionEventSubscriptionRefs = 0;
  private identityManager: DeviceIdentityManager;

  constructor(config: OpenClawConfig) {
    super();
    this.config = config;
    this.identityManager = new DeviceIdentityManager(process.cwd());
  }

  private hasOpenSocket(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  isConnected(): boolean {
    return this.hasOpenSocket();
  }

  async connect(): Promise<void> {
    if (this.hasOpenSocket()) return;
    if (this.connectPromise) return this.connectPromise;
    if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
      this.connected = false;
      this.sessionEventSubscriptionRefs = 0;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      const connectTimer = setTimeout(() => {
        fail(new Error('OpenClaw gateway connect timeout'));
      }, GATEWAY_CONNECT_TIMEOUT_MS);

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        resolve();
      };

      const wsUrl = this.config.gatewayUrl.replace(/^http/, 'ws');
      const wsOptions: any = {};
      if (this.config.gatewayUrl.includes('localhost') || this.config.gatewayUrl.includes('127.0.0.1')) {
        wsOptions.headers = { Origin: this.config.gatewayUrl };
      }
      this.ws = new WebSocket(wsUrl, wsOptions);

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        this.connected = false;
        this.connectPromise = null;
        try {
          this.ws?.close();
        } catch {}
        this.ws = null;
        this.rejectPendingRequests(err);
        reject(err);
      };

      this.ws.on('open', () => {
        // wait for connect.challenge event
      });

      this.ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          console.log(JSON.stringify(msg, null, 2));

          // challenge from gateway
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            try {
              const identity = this.identityManager.load();
              const nonce = crypto.randomBytes(16).toString('hex');
              const signedAt = Date.now();

              const payload = buildDeviceAuthPayload({
                deviceId: identity.deviceId,
                clientId: 'openclaw-control-ui',
                clientMode: 'webchat',
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                signedAtMs: signedAt,
                token: this.config.token || 'openclaw',
                nonce,
              });
              const signature = ed25519Sign(payload, identity.privateKeyObj);

              const connectParams: any = {
                minProtocol: 4,
                maxProtocol: 4,

                client: {
                  id: 'openclaw-control-ui',
                  version: '1.0.0',
                  mode: 'webchat',
                  platform: process.platform,
                },

                device: {
                  id: identity.deviceId,
                  publicKey: identity.publicKey,
                  signature,
                  signedAt,
                  nonce,
                },

                auth: {
                  token: this.config.token,
                  password: this.config.password,
                },

                role: 'operator',
                scopes: [
                  'operator.read',
                  'operator.write',
                ],
              };

              if (identity.deviceToken) {
                connectParams.deviceToken = identity.deviceToken;
              }

              const result = await this.request('connect', connectParams);

              if (result?.deviceToken) {
                this.identityManager.saveDeviceToken(result.deviceToken);
              }

              this.connected = true;
              this.connectPromise = null;
              this.emit('connected');
              resolveOnce();
            } catch (err: any) {
              fail(new Error(err?.message || 'Gateway connect failed'));
            }
            return;
          }

          // response frame
          if (msg.type === 'res' && msg.id) {
            const pending = this.pending.get(msg.id);
            if (!pending) return;
            this.pending.delete(msg.id);
            clearTimeout(pending.timer);

            if (msg.ok) {
              pending.resolve(msg.payload);
            } else {
              const errorCode = msg?.error?.code || '';
              const errorMsg = msg?.error?.message || 'Request failed';
              const err = new GatewayError(errorCode, errorMsg, msg?.error?.detail);
              pending.reject(err);
            }
            return;
          }

          // Chat streaming events from gateway
          if (msg.type === 'event' && msg.event === 'chat') {
            const payload = msg.payload || msg.data;
            if (!payload) return;

            const state = payload.state; // 'delta' | 'final' | 'aborted' | 'error'
            const sessionKey = payload.sessionKey;
            const text = extractChatEventText(payload);
            const runId = payload.runId;

            if (state === 'delta') {
              this.emit('chat.delta', { sessionKey, runId, text });
            } else if (state === 'final') {
              this.emit('chat.final', { sessionKey, runId, text, message: payload.message });
            } else if (state === 'aborted') {
              this.emit('chat.aborted', { sessionKey, runId, text, message: payload.message });
            } else if (state === 'error') {
              this.emit('chat.error', { sessionKey, runId, error: extractChatEventError(payload, msg.error) });
            }
            return;
          }

          if (msg.type === 'event' && msg.event === 'session.tool') {
            const payload = msg.payload || msg.data;
            if (!payload) return;

            const sessionPayload: SessionToolEventPayload = {
              sessionKey: isNonEmptyString(payload.sessionKey) ? payload.sessionKey : undefined,
              parentSessionKey: isNonEmptyString(payload.parentSessionKey) ? payload.parentSessionKey : undefined,
              runId: isNonEmptyString(payload.runId) ? payload.runId : undefined,
              ts: typeof payload.ts === 'number' ? payload.ts : undefined,
              stream: isNonEmptyString(payload.stream) ? payload.stream : undefined,
              data: payload.data,
              session: payload.session,
            };

            this.emit('session.tool', sessionPayload);
            return;
          }

          if (msg.type === 'event' && msg.event === 'session.message') {
            const payload = msg.payload || msg.data;
            if (!payload) return;

            this.emit('session.message', {
              sessionKey: isNonEmptyString(payload.sessionKey) ? payload.sessionKey : undefined,
              message: payload.message,
              messageId: isNonEmptyString(payload.messageId) ? payload.messageId : undefined,
              messageSeq: typeof payload.messageSeq === 'number' ? payload.messageSeq : undefined,
              session: payload.session,
            });
            return;
          }

        } catch (err: any) {
          this.emit('error', new Error(err?.message || 'Failed to parse message'));
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.connectPromise = null;
        this.sessionEventSubscriptionRefs = 0;
        this.rejectPendingRequests(new Error('Client disconnected'));
        this.emit('disconnected');
      });

      this.ws.on('error', (err) => {
        if (this.listenerCount('error') > 0) {
          this.emit('error', err as Error);
        }
        if (!this.connected) fail(err as Error);
      });
    });

    return this.connectPromise;
  }

  private rejectPendingRequests(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private async request(method: string, params?: any, timeoutMs = 60000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('OpenClaw gateway connection is not open');
    }

    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timeout`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(frame), (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        this.connected = false;
        this.sessionEventSubscriptionRefs = 0;
        reject(error);
      });
    });
  }

  async call(method: string, params?: any, timeoutMs = 60000): Promise<any> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    return this.request(method, params, timeoutMs);
  }

  async subscribeSessionEvents(): Promise<void> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    this.sessionEventSubscriptionRefs += 1;
    if (this.sessionEventSubscriptionRefs > 1) {
      return;
    }

    try {
      await this.request('sessions.subscribe', {}, 15000);
    } catch (error) {
      this.sessionEventSubscriptionRefs = 0;
      throw error;
    }
  }

  async unsubscribeSessionEvents(): Promise<void> {
    if (this.sessionEventSubscriptionRefs <= 0) {
      return;
    }

    this.sessionEventSubscriptionRefs -= 1;
    if (this.sessionEventSubscriptionRefs > 0) {
      return;
    }

    if (!this.hasOpenSocket()) {
      return;
    }

    try {
      await this.request('sessions.unsubscribe', {}, 15000);
    } catch (error) {
      this.sessionEventSubscriptionRefs = 1;
      throw error;
    }
  }

  async waitForRun(runId: string, timeoutMs = 90000): Promise<void> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    await this.request('agent.wait', { runId, timeoutMs }, timeoutMs + 5000);
  }

  async getLatestAssistantText(sessionKey: string, limit = 20): Promise<string> {
    const history = await this.getChatHistory(sessionKey, limit);
    return this.extractLatestAssistantText(history);
  }

  async getChatHistory(sessionKey: string, limit = 20): Promise<any> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    return this.request('chat.history', {
      sessionKey,
      limit,
    }, CHAT_HISTORY_TIMEOUT_MS);
  }

  async getGatewayStatus(timeoutMs = 10000): Promise<any> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    return this.request('status', {}, timeoutMs);
  }

  async getGatewayHealth(timeoutMs = 10000): Promise<any> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    return this.request('health', { probe: true }, timeoutMs);
  }

  private extractLatestAssistantText(historyPayload: any): string {
    const messages = Array.isArray(historyPayload?.messages) ? historyPayload.messages : [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = normalizeOpenClawMessageRecord(messages[i]);
      if (m?.role !== 'assistant') continue;
      const text = extractOpenClawMessageText(m);
      if (text) return text;
    }
    return '';
  }

  // Non-blocking: sends message and returns immediately. 
  // Listen on 'chat.delta' and 'chat.final' events for the response.
  async sendChatMessageStreaming(params: {
    sessionKey: string;
    message: string;
    agentId?: string;
    attachments?: { type: string; mimeType: string; content: string }[];
  }): Promise<{ runId: string; sessionKey: string }> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    const agentId = params.agentId || 'main';
    const finalSessionKey = params.sessionKey.startsWith('agent:') 
      ? params.sessionKey 
      : `agent:${agentId}:chat:${params.sessionKey}`;

    const started = await this.request('chat.send', {
      sessionKey: finalSessionKey,
      message: params.message,
      attachments: params.attachments && params.attachments.length > 0 ? params.attachments : undefined,
      idempotencyKey: crypto.randomUUID(),
    }, CHAT_SEND_START_TIMEOUT_MS);

    const runId = started?.runId;
    if (!runId) throw new Error('chat.send did not return runId');

    return { runId, sessionKey: finalSessionKey };
  }

  // Blocking: sends message and waits for full response (legacy)
  async sendChatMessage(params: {
    sessionKey: string;
    message: string;
    agentId?: string;
  }): Promise<string> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    const agentId = params.agentId || 'main';
    const finalSessionKey = params.sessionKey.startsWith('agent:') 
      ? params.sessionKey 
      : `agent:${agentId}:chat:${params.sessionKey}`;

    const started = await this.request('chat.send', {
      sessionKey: finalSessionKey,
      message: params.message,
      idempotencyKey: crypto.randomUUID(),
    }, CHAT_SEND_START_TIMEOUT_MS);

    const runId = started?.runId;
    if (!runId) throw new Error('chat.send did not return runId');

    await this.request('agent.wait', { runId, timeoutMs: 90000 }, 95000);

    const history = await this.request('chat.history', {
      sessionKey: finalSessionKey,
      limit: 20,
    }, CHAT_HISTORY_TIMEOUT_MS);

    const text = this.extractLatestAssistantText(history);
    return text || 'No assistant text found in response.';
  }

  async abortChat(params: {
    sessionKey: string;
    runId?: string;
    timeoutMs?: number;
  }): Promise<{ aborted: boolean; runIds?: string[] }> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }

    const response = await this.request('chat.abort', {
      sessionKey: params.sessionKey,
      ...(params.runId ? { runId: params.runId } : {}),
    }, params.timeoutMs ?? 10000);

    return {
      aborted: response?.aborted !== false,
      runIds: Array.isArray(response?.runIds)
        ? response.runIds.filter((runId: unknown): runId is string => typeof runId === 'string')
        : undefined,
    };
  }

  async testConnection(): Promise<boolean> {
    if (!this.hasOpenSocket()) {
      await this.connect();
    }
    return this.hasOpenSocket();
  }

  disconnect(): void {
    this.rejectPendingRequests(new Error('Client disconnected'));

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connectPromise = null;
    this.sessionEventSubscriptionRefs = 0;
  }
}

export default OpenClawClient;