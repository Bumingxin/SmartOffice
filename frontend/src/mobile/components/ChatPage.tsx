import { useEffect, useRef } from 'react';
import type { SessionSummary } from '../types';
import { useChatSession } from '../hooks/useChatSession';
import { MobileChatInput } from './MobileChatInput';
import { MobileHeader } from './MobileHeader';
import { ErrorState, LoadingState } from './MobileStates';
import { MobileMessageBubble } from './MobileMessageBubble';

interface ChatPageProps {
  session: SessionSummary;
  isConnected: boolean;
  onBack: () => void;
}

export function ChatPage({ session, isConnected, onBack }: ChatPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoadingHistory, isSending, error, loadHistory, sendMessage, stop } = useChatSession(session.id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isSending]);

  return (
    <div className="flex h-full flex-col bg-[#f6f4ef]">
      <MobileHeader
        title={session.name || session.id}
        subtitle={session.model || session.agentId || '智能体'}
        isConnected={isConnected}
        showBack
        onBack={onBack}
        onRefresh={loadHistory}
      />
      {isLoadingHistory ? (
        <LoadingState label="加载历史消息" />
      ) : error && messages.length === 0 ? (
        <ErrorState message={error} onRetry={loadHistory} />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-2">
          {messages.map((message) => <MobileMessageBubble key={message.id} message={message} />)}
        </div>
      )}
      {error && messages.length > 0 ? <div className="bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}
      <MobileChatInput isSending={isSending} onSend={sendMessage} onStop={stop} placeholder={`给 ${session.name || session.id} 发消息`} />
    </div>
  );
}
