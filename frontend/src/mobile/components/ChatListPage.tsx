import { Plus, Trash2 } from 'lucide-react';
import type { SessionSummary } from '../types';
import { EmptyState, LoadingState } from './MobileStates';

interface ChatListPageProps {
  sessions: SessionSummary[];
  isLoading: boolean;
  activeSessionId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (session: SessionSummary) => void;
  onDelete: (id: string) => void;
}

export function ChatListPage({ sessions, isLoading, activeSessionId, onSelect, onCreate, onEdit, onDelete }: ChatListPageProps) {
  if (isLoading) return <LoadingState label="加载会话" />;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f4ef]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Agents</div>
        <button type="button" onClick={onCreate} className="grid h-10 w-10 place-items-center rounded-lg bg-gray-950 text-white" aria-label="新建智能体">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {sessions.length === 0 ? (
        <EmptyState title="还没有会话" description="创建一个智能体后即可在手机端开始聊天。" />
      ) : (
        <div className="mobile-scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-2">
            {sessions.map((session) => {
              const active = activeSessionId === session.id;
              return (
                <div key={session.id} className={`rounded-lg border bg-white ${active ? 'border-gray-950' : 'border-gray-200'}`}>
                  <button type="button" onClick={() => onSelect(session.id)} className="w-full px-3 py-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-950 text-sm font-black text-white">
                        {(session.name || session.id).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-gray-950">{session.name || session.id}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">{session.model || session.agentId || session.id}</div>
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-gray-100">
                    <button type="button" onClick={() => onEdit(session)} className="h-10 flex-1 text-sm font-medium text-gray-600">编辑</button>
                    <button type="button" onClick={() => onDelete(session.id)} className="grid h-10 w-12 place-items-center text-red-500" aria-label="删除">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
