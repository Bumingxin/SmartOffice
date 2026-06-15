import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { QuickCommand } from '../../types';

interface CommandSettingsProps {
  commands: QuickCommand[];
  onSave: (command: { id?: number; command: string; description: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function CommandSettings({ commands, onSave, onDelete }: CommandSettingsProps) {
  const [editing, setEditing] = useState<QuickCommand | null>(null);
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCommand(editing?.command || '');
    setDescription(editing?.description || '');
  }, [editing]);

  const save = async () => {
    if (!command.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: editing?.id, command, description });
      setEditing(null);
      setCommand('');
      setDescription('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-center gap-2 font-semibold text-gray-950">
          <Plus className="h-4 w-4" />
          {editing ? '编辑命令' : '新建命令'}
        </div>
        <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="命令" className="mb-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明" rows={3} className="mb-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" />
        <button type="button" onClick={save} disabled={saving || !command.trim() || !description.trim()} className="h-11 w-full rounded-lg bg-gray-950 text-sm font-bold text-white disabled:opacity-45">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
      <div className="space-y-2">
        {commands.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <button type="button" onClick={() => setEditing(item)} className="block w-full text-left">
              <div className="font-semibold text-gray-950">{item.command}</div>
              <div className="mt-1 text-sm text-gray-500">{item.description}</div>
            </button>
            <button type="button" onClick={() => void onDelete(item.id)} className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-red-50 px-3 text-sm font-semibold text-red-600">
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
