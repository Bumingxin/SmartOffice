import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { fetchJsonWithTimeout } from './useConnectionStatus';
import { uploadMobileFiles } from './mobileApi';

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

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
    return () => abortControllerRef.current?.abort();
  }, [loadHistory]);

  const stop = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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
    abortControllerRef.current = controller;
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'ids') {
            const realUserId = String(event.userMsgId);
            const realAssistantId = String(event.assistantMsgId);
            setMessages((current) => current.map((message) => {
              if (message.id === resolvedUserId) return { ...message, id: realUserId };
              if (message.id === resolvedAssistantId) return { ...message, id: realAssistantId, parentId: realUserId };
              return message;
            }));
            resolvedUserId = realUserId;
            resolvedAssistantId = realAssistantId;
          }
          if (event.type === 'delta' || event.type === 'final') {
            setMessages((current) => current.map((message) => (
              message.id === resolvedAssistantId
                ? {
                    ...message,
                    content: typeof event.text === 'string' ? event.text : message.content,
                    processContent: typeof event.process_content === 'string' ? event.process_content : message.processContent,
                    processStreaming: event.type === 'final' ? false : event.process_streaming ?? message.processStreaming,
                    model: event.modelUsed || event.model_used || message.model,
                  }
                : message
            )));
          }
          if (event.type === 'error') {
            throw new Error(event.error || 'Chat request failed');
          }
        }
      }
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
      abortControllerRef.current = null;
    }
  }, [isSending, sessionId]);

  return { messages, isLoadingHistory, isSending, error, loadHistory, sendMessage, stop };
}
