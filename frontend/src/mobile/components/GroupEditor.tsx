import { useEffect, useMemo, useState } from 'react';
import type { GroupSummary, SessionSummary } from '../types';
import { saveGroup } from '../hooks/mobileApi';
import { MobileHeader } from './MobileHeader';

interface GroupEditorProps {
  group?: GroupSummary | null;
  sessions: SessionSummary[];
  onBack: () => void;
  onSaved: () => void;
}

export function GroupEditor({ group, sessions, onBack, onSaved }: GroupEditorProps) {
  const [form, setForm] = useState({
    id: '',
    name: '',
    description: '',
    system_prompt: '',
    process_start_tag: '',
    process_end_tag: '',
    max_chain_depth: 6,
    memberIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentMemberIds = useMemo(() => new Set(form.memberIds), [form.memberIds]);

  useEffect(() => {
    setForm({
      id: group?.id || '',
      name: group?.name || '',
      description: group?.description || '',
      system_prompt: group?.system_prompt || '',
      process_start_tag: group?.process_start_tag || '',
      process_end_tag: group?.process_end_tag || '',
      max_chain_depth: group?.max_chain_depth || 6,
      memberIds: (group?.members || []).map((member) => member.agent_id || member.agentId || '').filter(Boolean),
    });
  }, [group]);

  const toggleMember = (id: string) => {
    setForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(id)
        ? current.memberIds.filter((memberId) => memberId !== id)
        : [...current.memberIds, id],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveGroup({
        originalId: group?.id,
        id: form.id,
        name: form.name || form.id,
        description: form.description,
        system_prompt: form.system_prompt,
        process_start_tag: form.process_start_tag,
        process_end_tag: form.process_end_tag,
        max_chain_depth: form.max_chain_depth,
        members: form.memberIds.map((id) => ({
          agentId: id,
          displayName: sessions.find((session) => session.id === id)?.name || id,
        })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f6f4ef]">
      <MobileHeader title={group ? '编辑群组' : '新建群组'} showBack onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">群组 ID</span>
            <input disabled={!!group} value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 disabled:text-gray-400" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">名称</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">描述</span>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">系统提示词</span>
            <textarea value={form.system_prompt} onChange={(event) => setForm({ ...form, system_prompt: event.target.value })} rows={5} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">最大链路深度</span>
            <input type="number" value={form.max_chain_depth} onChange={(event) => setForm({ ...form, max_chain_depth: Number(event.target.value) })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
          </label>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 text-sm font-semibold text-gray-800">成员</div>
            <div className="mobile-scroll-panel space-y-2 pr-1">
              {sessions.map((session) => (
                <label key={session.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{session.name || session.id}</span>
                    <span className="block text-xs text-gray-500">{session.model || session.id}</span>
                  </span>
                  <input type="checkbox" checked={currentMemberIds.has(session.id)} onChange={() => toggleMember(session.id)} className="h-5 w-5" />
                </label>
              ))}
            </div>
          </div>
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
          <button type="button" disabled={saving || !form.id.trim()} onClick={save} className="h-12 w-full rounded-lg bg-gray-950 font-bold text-white disabled:opacity-45">
            {saving ? '保存中...' : '保存群组'}
          </button>
        </div>
      </div>
    </div>
  );
}
