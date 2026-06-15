import { useEffect, useState } from 'react';
import type { AppConfig } from '../../types';

interface GeneralSettingsProps {
  config: AppConfig | null;
  onSave: (config: Partial<AppConfig>) => Promise<void>;
}

export function GeneralSettings({ config, onSave }: GeneralSettingsProps) {
  const [form, setForm] = useState({
    aiName: '',
    language: 'zh-CN',
    defaultAgent: '',
    loginEnabled: false,
    loginPassword: '',
    historyPageRounds: 30,
    previewConversionTimeoutSeconds: 60,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      aiName: config.aiName || '',
      language: config.language || 'zh-CN',
      defaultAgent: config.defaultAgent || '',
      loginEnabled: !!config.loginEnabled,
      loginPassword: config.loginPassword || '',
      historyPageRounds: config.historyPageRounds || 30,
      previewConversionTimeoutSeconds: config.previewConversionTimeoutSeconds || 60,
    });
  }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">AI 名称</span>
        <input value={form.aiName} onChange={(event) => setForm({ ...form, aiName: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">语言</span>
        <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3">
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">默认智能体</span>
        <input value={form.defaultAgent} onChange={(event) => setForm({ ...form, defaultAgent: event.target.value })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-800">启用登录</span>
          <input type="checkbox" checked={form.loginEnabled} onChange={(event) => setForm({ ...form, loginEnabled: event.target.checked })} className="h-5 w-5" />
        </label>
        <input value={form.loginPassword} onChange={(event) => setForm({ ...form, loginPassword: event.target.value })} placeholder="登录密码" className="mt-3 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </div>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">历史轮数</span>
        <input type="number" value={form.historyPageRounds} onChange={(event) => setForm({ ...form, historyPageRounds: Number(event.target.value) })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">预览转换超时秒数</span>
        <input type="number" value={form.previewConversionTimeoutSeconds} onChange={(event) => setForm({ ...form, previewConversionTimeoutSeconds: Number(event.target.value) })} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <button type="button" onClick={save} disabled={saving} className="h-12 w-full rounded-lg bg-gray-950 font-bold text-white disabled:opacity-50">
        {saving ? '保存中...' : '保存通用设置'}
      </button>
    </div>
  );
}
