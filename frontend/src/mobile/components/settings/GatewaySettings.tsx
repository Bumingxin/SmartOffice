import { useEffect, useState } from 'react';
import type { AppConfig } from '../../types';

interface GatewaySettingsProps {
  config: AppConfig | null;
  onSave: (config: Partial<AppConfig>) => Promise<void>;
}

export function GatewaySettings({ config, onSave }: GatewaySettingsProps) {
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [token, setToken] = useState('');
  const [allowedHosts, setAllowedHosts] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGatewayUrl(config?.gatewayUrl || '');
    setToken(config?.token || '');
    setAllowedHosts((config?.allowedHosts || []).join('\n'));
  }, [config]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        gatewayUrl,
        token,
        allowedHosts: allowedHosts.split('\n').map((item) => item.trim()).filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">网关地址</span>
        <input value={gatewayUrl} onChange={(event) => setGatewayUrl(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">Token</span>
        <input value={token} onChange={(event) => setToken(event.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3" />
      </label>
      <label className="block rounded-lg border border-gray-200 bg-white p-3">
        <span className="mb-2 block text-sm font-semibold text-gray-800">允许访问的 Host</span>
        <textarea value={allowedHosts} onChange={(event) => setAllowedHosts(event.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" />
      </label>
      <button type="button" onClick={save} disabled={saving} className="h-12 w-full rounded-lg bg-gray-950 font-bold text-white disabled:opacity-50">
        {saving ? '保存中...' : '保存网关设置'}
      </button>
    </div>
  );
}
