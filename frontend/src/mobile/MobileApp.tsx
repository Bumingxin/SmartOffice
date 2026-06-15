import { useMemo, useState } from 'react';
import type { GroupSummary, MobileTab, SessionSummary, SettingsSection } from './types';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useMobileAuth } from './hooks/useMobileAuth';
import { useMobileData } from './hooks/useMobileData';
import { AgentEditor } from './components/AgentEditor';
import { ChatListPage } from './components/ChatListPage';
import { ChatPage } from './components/ChatPage';
import { GroupChatPage } from './components/GroupChatPage';
import { GroupEditor } from './components/GroupEditor';
import { GroupListPage } from './components/GroupListPage';
import { MobileHeader } from './components/MobileHeader';
import { MobileLoginScreen } from './components/MobileLoginScreen';
import { ErrorState, LoadingState } from './components/MobileStates';
import { SettingsPage } from './components/SettingsPage';
import { TabBar } from './components/TabBar';
import { AboutPage } from './components/settings/AboutPage';
import { CommandSettings } from './components/settings/CommandSettings';
import { GatewaySettings } from './components/settings/GatewaySettings';
import { GeneralSettings } from './components/settings/GeneralSettings';
import { ModelSettings } from './components/settings/ModelSettings';

type DetailView =
  | { type: 'chat'; id: string }
  | { type: 'group'; id: string }
  | { type: 'agent-editor'; session?: SessionSummary | null }
  | { type: 'group-editor'; group?: GroupSummary | null }
  | { type: 'settings'; section: SettingsSection }
  | null;

const tabTitles: Record<MobileTab, string> = {
  chat: '聊天',
  groups: '群聊',
  settings: '设置',
};

const settingsTitles: Record<SettingsSection, string> = {
  gateway: '网关设置',
  general: '通用设置',
  models: '模型设置',
  commands: '快捷命令',
  about: '关于',
};

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>(() => {
    const saved = localStorage.getItem('clawui_mobile_tab');
    return saved === 'groups' || saved === 'settings' ? saved : 'chat';
  });
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem('clawui_active_session') || '');
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem('clawui_active_group') || '');
  const [detail, setDetail] = useState<DetailView>(null);
  const { isAuthenticated, setIsAuthenticated } = useMobileAuth();
  const { isConnected } = useConnectionStatus();
  const mobileData = useMobileData();

  const activeSession = useMemo(
    () => mobileData.sessions.find((session) => session.id === activeSessionId) || mobileData.sessions[0],
    [activeSessionId, mobileData.sessions],
  );
  const activeGroup = useMemo(
    () => mobileData.groups.find((group) => group.id === activeGroupId) || mobileData.groups[0],
    [activeGroupId, mobileData.groups],
  );

  const changeTab = (tab: MobileTab) => {
    setActiveTab(tab);
    localStorage.setItem('clawui_mobile_tab', tab);
    setDetail(null);
  };

  const openSession = (id: string) => {
    setActiveSessionId(id);
    localStorage.setItem('clawui_active_session', id);
    setDetail({ type: 'chat', id });
  };

  const openGroup = (id: string) => {
    setActiveGroupId(id);
    localStorage.setItem('clawui_active_group', id);
    setDetail({ type: 'group', id });
  };

  const afterSaved = async () => {
    await mobileData.reload();
    setDetail(null);
  };

  if (isAuthenticated === null) {
    return <div className="flex h-[100dvh] bg-[#f6f4ef]"><LoadingState label="检查登录状态" /></div>;
  }

  if (isAuthenticated === false) {
    return <MobileLoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const detailContent = (() => {
    if (!detail) return null;

    if (detail.type === 'chat') {
      const session = mobileData.sessions.find((item) => item.id === detail.id);
      return session ? <ChatPage session={session} isConnected={isConnected} onBack={() => setDetail(null)} /> : null;
    }

    if (detail.type === 'group') {
      const group = mobileData.groups.find((item) => item.id === detail.id);
      return group ? <GroupChatPage group={group} isConnected={isConnected} onBack={() => setDetail(null)} /> : null;
    }

    if (detail.type === 'agent-editor') {
      return <AgentEditor session={detail.session} models={mobileData.models} onBack={() => setDetail(null)} onSaved={() => void afterSaved()} />;
    }

    if (detail.type === 'group-editor') {
      return <GroupEditor group={detail.group} sessions={mobileData.sessions} onBack={() => setDetail(null)} onSaved={() => void afterSaved()} />;
    }

    if (detail.type === 'settings') {
      return (
        <div className="flex h-full flex-col bg-[#f6f4ef]">
          <MobileHeader title={settingsTitles[detail.section]} showBack onBack={() => setDetail(null)} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {detail.section === 'gateway' ? <GatewaySettings config={mobileData.config} onSave={mobileData.saveConfig} /> : null}
            {detail.section === 'general' ? <GeneralSettings config={mobileData.config} onSave={mobileData.saveConfig} /> : null}
            {detail.section === 'models' ? (
              <ModelSettings
                models={mobileData.models}
                endpoints={mobileData.endpoints}
                config={mobileData.config}
                onAdd={mobileData.addModel}
                onDelete={mobileData.deleteModel}
                onDefault={mobileData.setDefaultModel}
              />
            ) : null}
            {detail.section === 'commands' ? (
              <CommandSettings commands={mobileData.commands} onSave={mobileData.saveCommand} onDelete={mobileData.deleteCommand} />
            ) : null}
            {detail.section === 'about' ? <AboutPage /> : null}
          </div>
        </div>
      );
    }

    return null;
  })();

  if (detailContent) {
    return <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[#f6f4ef] text-gray-950">{detailContent}</div>;
  }

  const rootContent = (() => {
    if (mobileData.error) {
      return <ErrorState message={mobileData.error} onRetry={mobileData.reload} />;
    }

    if (activeTab === 'chat') {
      return (
        <ChatListPage
          sessions={mobileData.sessions}
          isLoading={mobileData.isLoading}
          activeSessionId={activeSession?.id || ''}
          onSelect={openSession}
          onCreate={() => setDetail({ type: 'agent-editor', session: null })}
          onEdit={(session) => setDetail({ type: 'agent-editor', session })}
          onDelete={(id) => {
            if (window.confirm('确定删除这个智能体吗？')) void mobileData.deleteSession(id);
          }}
        />
      );
    }

    if (activeTab === 'groups') {
      return (
        <GroupListPage
          groups={mobileData.groups}
          isLoading={mobileData.isLoading}
          activeGroupId={activeGroup?.id || ''}
          onSelect={openGroup}
          onCreate={() => setDetail({ type: 'group-editor', group: null })}
          onEdit={(group) => setDetail({ type: 'group-editor', group })}
          onDelete={(id) => {
            if (window.confirm('确定删除这个群组吗？')) void mobileData.deleteGroup(id);
          }}
        />
      );
    }

    return (
      <SettingsPage
        config={mobileData.config}
        models={mobileData.models}
        commands={mobileData.commands}
        onOpen={(section) => setDetail({ type: 'settings', section })}
      />
    );
  })();

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f6f4ef] text-gray-950">
      <MobileHeader title={tabTitles[activeTab]} isConnected={isConnected} onRefresh={mobileData.reload} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{rootContent}</main>
      <TabBar activeTab={activeTab} onChange={changeTab} />
    </div>
  );
}
