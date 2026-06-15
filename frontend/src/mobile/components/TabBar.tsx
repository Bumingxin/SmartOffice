import { MessageCircle, Settings, Users } from 'lucide-react';
import type { MobileTab } from '../types';

interface TabBarProps {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
}

const tabs: Array<{ id: MobileTab; label: string; Icon: typeof MessageCircle }> = [
  { id: 'chat', label: '聊天', Icon: MessageCircle },
  { id: 'groups', label: '群聊', Icon: Users },
  { id: 'settings', label: '设置', Icon: Settings },
];

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="safe-area-bottom shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="grid h-16 grid-cols-3">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                active ? 'text-gray-950' : 'text-gray-400'
              }`}
            >
              <span className={`grid h-8 w-12 place-items-center rounded-lg ${active ? 'bg-gray-950 text-white' : ''}`}>
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
