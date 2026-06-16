import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { fetchJsonWithTimeout } from './useConnectionStatus';
import { uploadMobileFiles } from './mobileApi';

function toGroupMessage(raw: any): ChatMessage {
  const senderType = raw.sender_type || raw.senderType;
  const senderId = raw.sender_id || raw.senderId;
  return {
    id: String(raw.id),
    role: raw.role || (senderType === 'user' ? 'user' : senderId === 'system' ? 'system' : 'assistant'),
    content: raw.content || '',
    processContent: raw.processContent || raw.process_content,
    processStreaming: raw.processStreaming ?? raw.process_streaming,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : raw.created_at ? new Date(raw.created_at) : new Date(),
    model: raw.model || raw.modelUsed || raw.model_used,
    agentId: raw.agentId || raw.agent_id || senderId,
    agentName: raw.agentName || raw.agent_name || raw.sender_name || raw.display_name,
    parentId: raw.parentId ? String(raw.parentId) : raw.parent_id ? String(raw.parent_id) : undefined,
    messageCode: raw.messageCode,
    messageParams: raw.messageParams,
    rawDetail: raw.rawDetail,
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
  const messagesRef = useRef<ChatMessage[]>([]);
  const recoveryAtRef = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isGroupActive, setIsGroupActive] = useState(false);
  const [error, setError] = useState('');
  const isSending = isPosting || isGroupActive;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((current) => mergeMessage(current, incoming));
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage>, fallbackRaw?: any) => {
    setMessages((current) => {
      if (current.some((message) => message.id === id)) {
        return current.map((message) => message.id === id ? { ...message, ...patch } : message);
      }
      if (!fallbackRaw) return current;
      return mergeMessage(current, toGroupMessage(fallbackRaw));
    });
  }, []);

  const recoverActiveRun = useCallback(async (signal?: AbortSignal) => {
    if (!groupId) return;
    try {
      const data = await fetchJsonWithTimeout<{ success?: boolean; active?: boolean; runState?: any; message?: any }>(
        `/api/groups/${encodeURIComponent(groupId)}/active-run`,
        { signal },
      );
      if (!data.success) return;
      setIsGroupActive(!!data.active || !!data.runState?.active);
      if (data.message) {
        upsertMessage(toGroupMessage(data.message));
      }
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [groupId, upsertMessage]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!groupId) return;

    eventSourceRef.current?.close();
    const source = new EventSource(`/api/groups/${encodeURIComponent(groupId)}/events`);
    eventSourceRef.current = source;
    void recoverActiveRun();

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'message' && payload.data) {
          upsertMessage(toGroupMessage(payload.data));
        }
        if (payload.type === 'delta') {
          const id = payload.id !== undefined && payload.id !== null ? String(payload.id) : '';
          if (!id) return;
          const patch: Partial<ChatMessage> = {
            content: typeof payload.content === 'string' ? payload.content : '',
          };
          if (typeof payload.process_content === 'string') patch.processContent = payload.process_content;
          if (typeof payload.process_streaming === 'boolean') patch.processStreaming = payload.process_streaming;
          if (typeof payload.model_used === 'string') patch.model = payload.model_used;
          if (typeof payload.sender_id === 'string') patch.agentId = payload.sender_id;
          if (typeof payload.sender_name === 'string') patch.agentName = payload.sender_name;
          if (typeof payload.messageCode === 'string') patch.messageCode = payload.messageCode;
          if (payload.messageParams && typeof payload.messageParams === 'object') patch.messageParams = payload.messageParams;
          if (typeof payload.rawDetail === 'string') patch.rawDetail = payload.rawDetail;
          if (payload.sender_id === 'system') patch.role = 'system';
          patchMessage(id, patch, payload);
        } else if (payload.type === 'edit') {
          if (payload.id !== undefined && payload.id !== null) {
            upsertMessage(toGroupMessage(payload));
          }
        } else if (payload.type === 'delete') {
          const deletedIds = Array.isArray(payload.deletedIds)
            ? payload.deletedIds.map((id: number | string) => String(id))
            : payload.id !== undefined && payload.id !== null
              ? [String(payload.id)]
              : [];
          if (deletedIds.length > 0) {
            const deleted = new Set(deletedIds);
            setMessages((current) => current.filter((message) => !deleted.has(message.id)));
          }
        } else if (payload.type === 'run_state') {
          setIsGroupActive(!!payload.data?.active);
        } else if (payload.type === 'typing_done') {
          setIsGroupActive((current) => current && !!payload.data?.runId);
        } else if (payload.type === 'reset') {
          void loadHistory();
        }
      } catch {}
    };

    source.onerror = () => {
      const now = Date.now();
      if (now - recoveryAtRef.current < 2000) return;
      recoveryAtRef.current = now;
      void recoverActiveRun();
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [groupId, loadHistory, patchMessage, recoverActiveRun, upsertMessage]);

  const sendMessage = useCallback(async (content: string, files: File[] = []) => {
    if (!groupId || (!content.trim() && files.length === 0) || isSending) return;
    setIsPosting(true);
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
      setIsGroupActive(true);
      window.setTimeout(() => {
        void recoverActiveRun();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPosting(false);
    }
  }, [groupId, isSending, recoverActiveRun]);

  const stop = useCallback(async () => {
    if (!groupId) return;
    await fetchJsonWithTimeout<{ success?: boolean }>(`/api/groups/${encodeURIComponent(groupId)}/stop`, { method: 'POST' }).catch(() => null);
    setIsGroupActive(false);
    await loadHistory();
  }, [groupId, loadHistory]);

  return { messages, isLoadingHistory, isSending, error, loadHistory, sendMessage, stop };
}
