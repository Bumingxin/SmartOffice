import { fetchJsonWithTimeout } from './useConnectionStatus';

export async function uploadMobileFiles(params: {
  files: File[];
  mode: 'session' | 'group';
  id: string;
}) {
  if (params.files.length === 0) return '';

  const formData = new FormData();
  formData.append('contextType', params.mode);
  formData.append(params.mode === 'session' ? 'sessionId' : 'groupId', params.id);
  params.files.forEach((file) => formData.append('files', file));

  const response = await fetch('/api/files/upload', { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!data?.success || !Array.isArray(data.files)) return '';

  return data.files.map((file: any) => {
    const name = file.name || file.originalname || 'file';
    const url = file.url || '';
    return String(file.mimeType || '').startsWith('image/') ? `![${name}](${url})` : `[${name}](${url})`;
  }).join('\n');
}

export async function saveSession(payload: {
  originalId?: string;
  id: string;
  name: string;
  soulContent: string;
  userContent?: string;
  agentsContent?: string;
  toolsContent?: string;
  heartbeatContent?: string;
  identityContent?: string;
  model?: string;
  process_start_tag?: string;
  process_end_tag?: string;
}) {
  const editId = payload.originalId;
  const isEdit = typeof editId === 'string' && editId.length > 0;
  const { originalId: _originalId, ...body } = payload;
  return fetchJsonWithTimeout<{ success?: boolean; session?: any }>(
    isEdit ? `/api/sessions/${encodeURIComponent(editId)}` : '/api/sessions',
    {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function saveGroup(payload: {
  originalId?: string;
  id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  process_start_tag?: string;
  process_end_tag?: string;
  max_chain_depth?: number;
  members?: Array<{ agentId: string; displayName?: string; roleDescription?: string }>;
}) {
  const editId = payload.originalId;
  const isEdit = typeof editId === 'string' && editId.length > 0;
  const { originalId: _originalId, ...body } = payload;
  return fetchJsonWithTimeout<{ success?: boolean; id?: string }>(
    isEdit ? `/api/groups/${encodeURIComponent(editId)}` : '/api/groups',
    {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}
