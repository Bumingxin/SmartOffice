import { Plus, Trash2, Users } from 'lucide-react';
import type { GroupSummary } from '../types';
import { EmptyState, LoadingState } from './MobileStates';

interface GroupListPageProps {
  groups: GroupSummary[];
  isLoading: boolean;
  activeGroupId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (group: GroupSummary) => void;
  onDelete: (id: string) => void;
}

export function GroupListPage({ groups, isLoading, activeGroupId, onSelect, onCreate, onEdit, onDelete }: GroupListPageProps) {
  if (isLoading) return <LoadingState label="加载群组" />;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f4ef]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Teams</div>
        <button type="button" onClick={onCreate} className="grid h-10 w-10 place-items-center rounded-lg bg-gray-950 text-white" aria-label="新建群组">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {groups.length === 0 ? (
        <EmptyState title="还没有群聊" description="创建一个群组，把多个智能体放到同一个对话里。" />
      ) : (
        <div className="mobile-scroll-area min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-2">
            {groups.map((group) => {
              const active = activeGroupId === group.id;
              return (
                <div key={group.id} className={`rounded-lg border bg-white ${active ? 'border-gray-950' : 'border-gray-200'}`}>
                  <button type="button" onClick={() => onSelect(group.id)} className="w-full px-3 py-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-gray-950">{group.name || group.id}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">{group.members?.length || 0} 个成员 · {group.description || group.id}</div>
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-gray-100">
                    <button type="button" onClick={() => onEdit(group)} className="h-10 flex-1 text-sm font-medium text-gray-600">编辑</button>
                    <button type="button" onClick={() => onDelete(group.id)} className="grid h-10 w-12 place-items-center text-red-500" aria-label="删除">
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
