import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Bot, UserRound } from 'lucide-react';
import type { ChatMessage } from '../types';

interface MobileMessageBubbleProps {
  message: ChatMessage;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MobileMessageBubble({ message }: MobileMessageBubbleProps) {
  const isUser = message.role === 'user';
  const title = isUser ? '你' : message.agentName || message.model || 'AI';

  return (
    <article className={`flex gap-2 px-3 py-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isUser ? 'bg-gray-950 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
        {isUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`min-w-0 max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`mb-1 flex max-w-full items-center gap-2 text-[11px] text-gray-400 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="truncate">{title}</span>
          <span>{formatTime(message.timestamp)}</span>
        </div>
        {message.processContent ? (
          <details className="mb-1 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <summary className="cursor-pointer font-semibold">执行过程</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5">{message.processContent}</pre>
          </details>
        ) : null}
        <div className={`max-w-full rounded-lg px-3 py-2 text-[15px] leading-6 ${
          isUser ? 'bg-gray-950 text-white' : 'border border-gray-200 bg-white text-gray-950'
        }`}>
          {message.content ? (
            <div className="prose prose-sm max-w-none break-words prose-p:my-1 prose-pre:overflow-x-auto prose-code:break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              正在思考
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
