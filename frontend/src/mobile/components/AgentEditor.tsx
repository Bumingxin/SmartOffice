import { useEffect, useState } from 'react';
import { fetchJsonWithTimeout } from '../hooks/useConnectionStatus';
import type { ModelSummary, SessionSummary } from '../types';
import { saveSession } from '../hooks/mobileApi';
import { MobileHeader } from './MobileHeader';

interface AgentEditorProps {
  session?: SessionSummary | null;
  models: ModelSummary[];
  onBack: () => void;
  onSaved: () => void;
}

function modelLabel(model: ModelSummary) {
  return String(model.id || model.name || model.modelName || model.displayName || '');
}

export function AgentEditor({ session, models, onBack, onSaved }: AgentEditorProps) {
  const [form, setForm] = useState({
    id: '',
    name: '',
    model: '',
    soulContent: '',
    userContent: '',
    agentsContent: '',
    toolsContent: '',
    heartbeatContent: '',
    identityContent: '',
    process_start_tag: '',
    process_end_tag: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      id: session?.id || '',
      name: session?.name || '',
      model: session?.model || '',
      soulContent: '',
      userContent: '',
      agentsContent: '',
      toolsContent: '',
      heartbeatContent: '',
      identityContent: '',
      process_start_tag: session?.process_start_tag || '',
      process_end_tag: session?.process_end_tag || '',
    });

    if (!session?.id) return;
    let disposed = false;
    fetchJsonWithTimeout<{ success?: boolean; configs?: Partial<typeof form> }>(`/api/sessions/${encodeURIComponent(session.id)}/configs`)
      .then((data) => {
        if (disposed || !data.configs) return;
        setForm((current) => ({
          ...current,
          soulContent: data.configs?.soulContent || '',
          userContent: data.configs?.userContent || '',
          agentsContent: data.configs?.agentsContent || '',
          toolsContent: data.configs?.toolsContent || '',
          heartbeatContent: data.configs?.heartbeatContent || '',
          identityContent: data.configs?.identityContent || '',
          model: data.configs?.model || current.model,
        }));
      })
      .catch(() => null);

    return () => {
      disposed = true;
    };
  }, [session]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await saveSession({
        originalId: session?.id,
        ...form,
        name: form.name || form.id,
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
      <MobileHeader title={session ? '编辑智能体' : '新建智能体'} showBack onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">智能体 ID</span>
            <input disabled={!!session} value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 disabled:text-gray-400" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">显示名称</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
          </label>
          <label className="block rounded-lg border border-gray-200 bg-white p-3">
            <span className="mb-2 block text-sm font-semibold text-gray-800">模型</span>
            <select value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3">
              <option value="">继承默认模型</option>
              {models.map((model, index) => {
                const label = modelLabel(model);
                return <option key={`${label}-${index}`} value={label}>{label}</option>;
              })}
            </select>
          </label>
          {[
            ['soulContent', 'SOUL.md'],
            ['userContent', 'USER.md'],
            ['agentsContent', 'AGENTS.md'],
            ['toolsContent', 'TOOLS.md'],
            ['heartbeatContent', 'HEARTBEAT.md'],
            ['identityContent', 'IDENTITY.md'],
          ].map(([key, label]) => (
            <label key={key} className="block rounded-lg border border-gray-200 bg-white p-3">
              <span className="mb-2 block text-sm font-semibold text-gray-800">{label}</span>
              <textarea
                value={(form as any)[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                rows={5}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm"
              />
            </label>
          ))}
          <div className="grid grid-cols-1 gap-3">
            <label className="block rounded-lg border border-gray-200 bg-white p-3">
              <span className="mb-2 block text-sm font-semibold text-gray-800">执行开始标签</span>
              <input value={form.process_start_tag} onChange={(event) => setForm({ ...form, process_start_tag: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
            </label>
            <label className="block rounded-lg border border-gray-200 bg-white p-3">
              <span className="mb-2 block text-sm font-semibold text-gray-800">执行结束标签</span>
              <input value={form.process_end_tag} onChange={(event) => setForm({ ...form, process_end_tag: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
            </label>
          </div>
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
          <button type="button" disabled={saving || !form.id.trim()} onClick={save} className="h-12 w-full rounded-lg bg-gray-950 font-bold text-white disabled:opacity-45">
            {saving ? '保存中...' : '保存智能体'}
          </button>
        </div>
      </div>
    </div>
  );
}
