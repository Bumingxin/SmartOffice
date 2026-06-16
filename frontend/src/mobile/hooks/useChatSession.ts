import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { fetchJsonWithTimeout } from './useConnectionStatus';
import { uploadMobileFiles } from './mobileApi';
import { readJsonEventStream } from './streamEvents';

function toChatMessage(raw: any): ChatMessage {
  return {
    id: String(raw.id),
    role: raw.role || 'assistant',
    content: raw.content || '',
    processContent: raw.processContent || raw.process_content,
    processStreaming: raw.processStreaming ?? raw.process_streaming,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
    model: raw.model || raw.modelUsed || raw.model_used,
    agentId: raw.agentId || raw.agent_id,
    agentName: raw.agentName || raw.agent_name,
    parentId: raw.parentId ? String(raw.parentId) : raw.parent_id ? String(raw.parent_id) : undefined,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

export function useChatSession(sessionId: string) {
  const sendControllerRef = useRef<AbortController | null>(null);
  const attachControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [attachAttempt, setAttachAttempt] = useState(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingHistory(true);
    setError('');
    try {
      const data = await fetchJsonWithTimeout<{ messages?: any[] }>(`/api/history/${encodeURIComponent(sessionId)}?limit=80`);
      setMessages((data.messages || []).map(toChatMessage));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadHistory();
    return () => {
      sendControllerRef.current?.abort();
      attachControllerRef.current?.abort();
    };
  }, [loadHistory]);

  const patchAssistantMessage = useCallback((messageId: string, patch: Partial<ChatMessage>) => {
    setMessages((current) => current.map((message) => (
      message.id === messageId ? { ...message, ...patch } : message
    )));
  }, []);

  const resolveAttachMessageId = useCallback((rawMessageId: unknown) => {
    if (rawMessageId !== null && rawMessageId !== undefined) return String(rawMessageId);
    const latestAssistant = [...messagesRef.current].reverse().find((message) => message.role !== 'user');
    return latestAssistant?.id || null;
  }, []);

  const recoverLatestIfBlank = useCallback(async () => {
    const latestAssistant = [...messagesRef.current].reverse().find((message) => message.role !== 'user');
    if (!latestAssistant || String(latestAssistant.content || latestAssistant.processContent || '').trim()) return;
    try {
      const data = await fetchJsonWithTimeout<{ messages?: any[] }>(`/api/history/${encodeURIComponent(sessionId)}?limit=80`);
      setMessages((data.messages || []).map(toChatMessage));
    } catch {
      // History recovery is best-effort; the visible stream error path handles user-facing errors.
    }
  }, [sessionId]);

  const applyStreamEvent = useCallback((
    event: any,
    state: { assistantId: string | null; userId?: string | null },
  ) => {
    if (event.type === 'ids') {
      const realUserId = String(event.userMsgId);
      const realAssistantId = String(event.assistantMsgId);
      const previousUserId = state.userId;
      const previousAssistantId = state.assistantId;

      setMessages((current) => current.map((message) => {
        if (previousUserId && message.id === previousUserId) return { ...message, id: realUserId };
        if (previousAssistantId && message.id === previousAssistantId) {
          return { ...message, id: realAssistantId, parentId: realUserId };
        }
        return message;
      }));

      state.userId = realUserId;
      state.assistantId = realAssistantId;
      return;
    }

    if (event.type === 'attached') {
      state.assistantId = resolveAttachMessageId(event.messageId);
      if (!state.assistantId) return;
      patchAssistantMessage(state.assistantId, {
        agentId: typeof event.agentId === 'string' ? event.agentId : undefined,
        agentName: typeof event.agentName === 'string' ? event.agentName : undefined,
        model: typeof event.modelUsed === 'string' ? event.modelUsed : undefined,
      });
      return;
    }

    if ((event.type === 'delta' || event.type === 'final') && state.assistantId) {
      const patch: Partial<ChatMessage> = {
        content: typeof event.text === 'string' ? event.text : '',
      };
      if (typeof event.process_content === 'string') patch.processContent = event.process_content;
      if (typeof event.process_streaming === 'boolean') {
        patch.processStreaming = event.process_streaming;
      } else if (event.type === 'final') {
        patch.processStreaming = false;
      }
      if (typeof event.modelUsed === 'string') {
        patch.model = event.modelUsed;
      } else if (typeof event.model_used === 'string') {
        patch.model = event.model_used;
      }
      patchAssistantMessage(state.assistantId, patch);
      return;
    }

    if (event.type === 'error') {
      throw new Error(event.error || event.text || 'Chat request failed');
    }
  }, [patchAssistantMessage, resolveAttachMessageId]);

  useEffect(() => {
    if (!sessionId || isLoadingHistory || sendControllerRef.current) return;

    attachControllerRef.current?.abort();
    const controller = new AbortController();
    attachControllerRef.current = controller;
    const streamState: { assistantId: string | null } = { assistantId: null };

    const attachActiveRun = async () => {
      try {
        const response = await fetch(`/api/chat/attach/${encodeURIComponent(sessionId)}`, {
          signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          await recoverLatestIfBlank();
          return;
        }
        if (!response.ok || !response.body) return;

        setIsSending(true);
        await readJsonEventStream(response, (event) => applyStreamEvent(event, streamState));
        await recoverLatestIfBlank();
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          setError(getErrorMessage(err));
        }
      } finally {
        if (attachControllerRef.current === controller) {
          attachControllerRef.current = null;
        }
        if (!controller.signal.aborted) {
          setIsSending(false);
        }
      }
    };

    void attachActiveRun();

    return () => {
      controller.abort();
      if (attachControllerRef.current === controller) {
        attachControllerRef.current = null;
      }
    };
  }, [applyStreamEvent, attachAttempt, isLoadingHistory, recoverLatestIfBlank, sessionId]);

  const stop = useCallback(async () => {
    sendControllerRef.current?.abort();
    attachControllerRef.current?.abort();
    sendControllerRef.current = null;
    attachControllerRef.current = null;
    setIsSending(false);
    if (sessionId) {
      await fetchJsonWithTimeout<{ success?: boolean }>('/api/chat/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
    }
  }, [sessionId]);

  const sendMessage = useCallback(async (content: string, files: File[] = []) => {
    if (!sessionId || (!content.trim() && files.length === 0) || isSending) return;

    const controller = new AbortController();
    attachControllerRef.current?.abort();
    sendControllerRef.current = controller;
    setIsSending(true);
    setError('');

    const userId = `mobile-user-${Date.now()}`;
    const assistantId = `mobile-assistant-${Date.now() + 1}`;
    let resolvedAssistantId = assistantId;
    let resolvedUserId = userId;

    try {
      const uploadedContent = await uploadMobileFiles({ mode: 'session', id: sessionId, files });
      const fullMessage = [uploadedContent, content.trim()].filter(Boolean).join('\n\n');
      if (!fullMessage) return;

      setMessages((current) => [
        ...current,
        { id: userId, role: 'user', content: fullMessage, timestamp: new Date() },
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: fullMessage }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const streamState = { assistantId: resolvedAssistantId, userId: resolvedUserId };
      await readJsonEventStream(response, (event) => applyStreamEvent(event, streamState));
      resolvedAssistantId = streamState.assistantId || resolvedAssistantId;
      resolvedUserId = streamState.userId || resolvedUserId;
      patchAssistantMessage(resolvedAssistantId, { processStreaming: false });
      await recoverLatestIfBlank();
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        const message = getErrorMessage(err);
        setError(message);
        setMessages((current) => current.map((entry) => (
          entry.id === resolvedAssistantId ? { ...entry, content: `Error: ${message}` } : entry
        )));
      }
    } finally {
      setIsSending(false);
      if (sendControllerRef.current === controller) {
        sendControllerRef.current = null;
      }
      setAttachAttempt((value) => value + 1);
    }
  }, [applyStreamEvent, isSending, patchAssistantMessage, recoverLatestIfBlank, sessionId]);

  return { messages, isLoadingHistory, isSending, error, loadHistory, sendMessage, stop };
}
