import { useEffect, useState } from 'react';

export function AboutPage() {
  const [version, setVersion] = useState<{ version?: string; openclawVersion?: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/version').then((response) => response.json()).then(setVersion).catch(() => null);
  }, []);

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-2xl font-black text-gray-950">SmartOffice</div>
        <div className="mt-1 text-sm text-gray-500">OpenClaw Web Client Mobile</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <div className="flex justify-between border-b border-gray-100 py-2">
          <span className="text-gray-500">客户端版本</span>
          <span className="font-semibold text-gray-950">{version?.version || '未知'}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-500">OpenClaw</span>
          <span className="font-semibold text-gray-950">{version?.openclawVersion || '未知'}</span>
        </div>
      </div>
    </div>
  );
}
