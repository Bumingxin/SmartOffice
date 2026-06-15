import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJsonWithTimeout } from './useConnectionStatus';
import type { AppConfig, EndpointSummary, GroupSummary, MobileDataState, ModelSummary, QuickCommand, SessionSummary } from '../types';

const initialState: MobileDataState = {
  sessions: [],
  groups: [],
  models: [],
  endpoints: [],
  commands: [],
  config: null,
  isLoading: true,
  error: '',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

export function useMobileData() {
  const [state, setState] = useState<MobileDataState>(initialState);

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: '' }));
    try {
      const [sessions, groupsResponse, modelsResponse, endpointsResponse, commandsResponse, config] = await Promise.all([
        fetchJsonWithTimeout<SessionSummary[]>('/api/sessions'),
        fetchJsonWithTimeout<{ success?: boolean; groups?: GroupSummary[] }>('/api/groups'),
        fetchJsonWithTimeout<{ success?: boolean; models?: ModelSummary[] }>('/api/models'),
        fetchJsonWithTimeout<{ success?: boolean; endpoints?: EndpointSummary[] }>('/api/endpoints'),
        fetchJsonWithTimeout<{ success?: boolean; commands?: QuickCommand[] }>('/api/commands'),
        fetchJsonWithTimeout<AppConfig>('/api/config'),
      ]);

      setState({
        sessions: Array.isArray(sessions) ? sessions : [],
        groups: Array.isArray(groupsResponse.groups) ? groupsResponse.groups : [],
        models: Array.isArray(modelsResponse.models) ? modelsResponse.models : [],
        endpoints: Array.isArray(endpointsResponse.endpoints) ? endpointsResponse.endpoints : [],
        commands: Array.isArray(commandsResponse.commands) ? commandsResponse.commands : [],
        config,
        isLoading: false,
        error: '',
      });
    } catch (error) {
      setState((current) => ({ ...current, isLoading: false, error: getErrorMessage(error) }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const actions = useMemo(() => ({
    reload,
    saveConfig: async (config: Partial<AppConfig>) => {
      await fetchJsonWithTimeout<{ success?: boolean }>('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      await reload();
    },
    deleteSession: async (id: string) => {
      await fetchJsonWithTimeout<{ success?: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await reload();
    },
    deleteGroup: async (id: string) => {
      await fetchJsonWithTimeout<{ success?: boolean }>(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await reload();
    },
    saveCommand: async (command: { id?: number; command: string; description: string }) => {
      const isEdit = typeof command.id === 'number';
      await fetchJsonWithTimeout<{ success?: boolean }>(isEdit ? `/api/commands/${command.id}` : '/api/commands', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.command, description: command.description }),
      });
      await reload();
    },
    deleteCommand: async (id: number) => {
      await fetchJsonWithTimeout<{ success?: boolean }>(`/api/commands/${id}`, { method: 'DELETE' });
      await reload();
    },
    addModel: async (model: { endpoint: string; modelName: string; alias?: string }) => {
      await fetchJsonWithTimeout<{ success?: boolean }>('/api/models/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      });
      await reload();
    },
    deleteModel: async (id: string) => {
      await fetchJsonWithTimeout<{ success?: boolean }>('/api/models/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await reload();
    },
    setDefaultModel: async (id: string) => {
      await fetchJsonWithTimeout<{ success?: boolean }>('/api/models/manage/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await reload();
    },
  }), [reload]);

  return { ...state, ...actions };
}
