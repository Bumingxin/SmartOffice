import { CheckCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AppConfig, EndpointSummary, ModelSummary } from '../../types';
import { EmptyState } from '../MobileStates';

function modelDisplayName(model: ModelSummary) {
  return String(model.displayName || model.name || model.modelName || model.id || 'Unnamed model');
}

function modelIdentifier(model: ModelSummary) {
  return String(model.id || model.modelName || model.name || model.displayName || '');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '设置失败');
}

interface ModelSettingsProps {
  models: ModelSummary[];
  endpoints: EndpointSummary[];
  config: AppConfig | null;
  onAdd: (model: { endpoint: string; modelName: string; alias?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDefault: (id: string) => Promise<void>;
}

export function ModelSettings({ models, endpoints, config, onAdd, onDelete, onDefault }: ModelSettingsProps) {
  const [endpoint, setEndpoint] = useState('');
  const [modelName, setModelName] = useState('');
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);
  const [defaultSuccessId, setDefaultSuccessId] = useState('');
  const [defaultError, setDefaultError] = useState('');

  const add = async () => {
    if (!endpoint.trim() || !modelName.trim()) return;
    setSaving(true);
    try {
      await onAdd({ endpoint, modelName, alias });
      setModelName('');
      setAlias('');
    } finally {
      setSaving(false);
    }
  };

  const setAsDefault = async (model: ModelSummary) => {
    const id = modelIdentifier(model);
    if (!id || defaultingId) return;

    setDefaultingId(id);
    setDefaultError('');
    setDefaultSuccessId('');
    try {
      await onDefault(id);
      setDefaultSuccessId(id);
    } catch (error) {
      setDefaultError(getErrorMessage(error));
    } finally {
      setDefaultingId(null);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">默认智能体</div>
        <div className="mt-1 break-all font-semibold text-gray-950">{config?.defaultAgent || '未设置'}</div>
      </div>
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-3 text-sm font-semibold text-gray-950">添加模型</div>
        <label className="mb-2 block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">模型端点（必选）</span>
          <select value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3">
            <option value="">选择端点</option>
            {endpoints.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            ))}
          </select>
        </label>
        <label className="mb-2 block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">模型名称（必填）</span>
          <input
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
            placeholder="例如 gpt-5.4"
            className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3"
          />
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600">显示别名（可选）</span>
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="例如 办公主力模型"
            className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3"
          />
        </label>
        <button type="button" onClick={add} disabled={saving || !endpoint || !modelName.trim()} className="h-11 w-full rounded-lg bg-gray-950 text-sm font-bold text-white disabled:opacity-45">
          {saving ? '添加中...' : '添加模型'}
        </button>
      </div>
      {defaultError ? (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {defaultError}
        </div>
      ) : null}
      {models.length === 0 ? (
        <EmptyState title="未发现模型" description="请先在桌面端或网关配置模型端点。" />
      ) : (
        <div className="space-y-2">
          {models.map((model, index) => {
            const id = modelIdentifier(model);
            const displayName = modelDisplayName(model);
            const isDefaulting = defaultingId === id;
            const isSuccess = defaultSuccessId === id;

            return (
              <div key={`${id || displayName}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="break-all font-semibold text-gray-950">{displayName}</div>
                <div className="mt-1 break-all text-xs text-gray-500">{String(model.endpoint || model.provider || id)}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void setAsDefault(model)}
                    disabled={!!defaultingId || !id}
                    className={`h-9 flex-1 rounded-lg text-sm font-semibold disabled:opacity-60 ${
                      isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isDefaulting ? '设置中...' : isSuccess ? '已设为默认' : '设为默认'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(id)}
                    disabled={!id}
                    className="grid h-9 w-11 place-items-center rounded-lg bg-red-50 text-red-600 disabled:opacity-45"
                    aria-label="删除模型"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isSuccess ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700" role="status">
                    <CheckCircle className="h-3.5 w-3.5" />
                    默认模型已更新
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
