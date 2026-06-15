import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { fetchJsonWithTimeout } from './useConnectionStatus';
import { uploadMobileFiles } from './mobileApi';

function toGroupMessage(raw: any): ChatMessage {
  return {
    id: String(raw.id),
    role: raw.role || 'assistant',
    content: raw.content || '',
    processContent: raw.processContent || raw.process_content,
    processStreaming: raw.processStreaming ?? raw.process_streaming,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : raw.created_at ? new Date(raw.created_at) : new Date(),
    model: raw.model || raw.modelUsed || raw.model_used,
    agentId: raw.agentId || raw.agent_id,
    agentName: raw.agentName || raw.agent_name || raw.display_name,
    parentId: raw.parentId ? String(raw.parentId) : raw.parent_id ? String(raw.parent_id) : undefined,
  };
}

function mergeMessage(messages: ChatMessage[], incoming: ChatMessage) {
  const exists = messages.some((message) => message.id === incoming.id);
  if (exists) {
    return messages.map((message) => message.id === incoming.id ? { ...message, ...incoming } : message);
  }
  return [...messages, incoming];
}

export function useGroupChat(groupId: string) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    if (!groupId) return;
    setIsLoadingHistory(true);
    setError('');
    try {
      const data = await fetchJsonWithTimeout<{ messages?: any[] }>(`/api/groups/${encodeURIComponent(groupId)}/messages?limit=80`);
      setMessages((data.messages || []).map(toGroupMessage));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!groupId) return;

    eventSourceRef.current?.close();
    const source = new EventSource(`/api/groups/${encodeURIComponent(groupId)}/events`);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'message' && payload.data) {
          setMessages((current) => mergeMessage(current, toGroupMessage(payload.data)));
        }
        if (payload.type === 'reset') {
          void loadHistory();
        }
      } catch {}
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
    };

    return () => source.close();
  }, [groupId, loadHistory]);

  const sendMessage = useCallback(async (content: string, files: File[] = []) => {
    if (!groupId || (!content.trim() && files.length === 0) || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const uploadedContent = await uploadMobileFiles({ mode: 'group', id: groupId, files });
      const fullMessage = [uploadedContent, content.trim()].filter(Boolean).join('\n\n');
      if (!fullMessage) return;

      await fetchJsonWithTimeout<{ success?: boolean }>(`/api/groups/${encodeURIComponent(groupId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullMessage }),
      });
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSending(false);
    }
  }, [groupId, isSending, loadHistory]);

  const stop = useCallback(async () => {
    if (!groupId) return;
    await fetchJsonWithTimeout<{ success?: boolean }>(`/api/groups/${encodeURIComponent(groupId)}/stop`, { method: 'POST' }).catch(() => null);
  }, [groupId]);

  return { messages, isLoadingHistory, isSending, error, loadHistory, sendMessage, stop };
}
